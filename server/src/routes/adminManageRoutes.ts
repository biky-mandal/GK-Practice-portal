import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { requireAdmin, requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { ContactMessage } from '../models/ContactMessage.js';
import { Question } from '../models/Question.js';
import { QuestionVerification } from '../models/QuestionVerification.js';
import { verificationInputSchema, verifyQuestion } from '../services/questionVerificationService.js';
import { FLAG_STATUSES, QuestionFlag } from '../models/QuestionFlag.js';
import { PackageReview } from '../models/PackageReview.js';
import { AdminActivity } from '../models/AdminActivity.js';
import { AdminChatMessage } from '../models/AdminChatMessage.js';
import { broadcastChat } from '../ws/adminPresence.js';
import { getCategoryNames } from '../models/questionCategories.js';
import { createCategory, deleteCategory, listCategories, refreshCategories, renameCategory } from '../services/categoryService.js';
import { getExamNames } from '../models/questionExams.js';
import { createQuestionExam, deleteQuestionExam, listQuestionExams, renameQuestionExam } from '../services/questionExamService.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { User } from '../models/User.js';
import { resolveEntitlements } from '../services/entitlementService.js';
import { deleteUserAccount } from '../services/accountDeletionService.js';
import { hashPassword } from '../services/passwordService.js';
import { listPrices, setPrice, packageIdSchema, packageSchema, requirePackage, savePackage } from '../services/pricingService.js';
import { contentIdSchema, contentSchema, listPackageContent, savePackageContent } from '../services/packageContentService.js';
import { PACKS } from '../models/packages.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import { revokeAllSessions } from '../services/tokenService.js';
import { ApiError } from '../utils/ApiError.js';
import { listAvailableSimulationQuestions, listSimulationCategories, reserveSimulationQuestions, resetSimulationHistory } from '../services/simulationService.js';
import { referenceImageSchema } from '../models/referenceImage.js';
import { bilingualQuestion } from '../services/questionI18n.js';
import { translationService } from '../services/translationService.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const letter = (index: number) => String.fromCharCode(65 + index);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const objectId = (value: unknown) => {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(400, 'Invalid id.');
  return String(value);
};
const paging = (query: Record<string, unknown>, maxPageSize = 50) => {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
};
const wrap = (handler: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => handler(req, res).catch(next);

const passwordRule = z.string().min(4).max(72);

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  keyGenerator: (req) => req.user!.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Verification limit reached (6 requests per 15 minutes). Try again later.' }
});

router.get('/questions/:id/verification', wrap(async (req, res) => {
  const id = objectId(req.params.id);
  if (!await Question.exists({ _id: id })) throw new ApiError(404, 'Question not found.');
  const report = await QuestionVerification.findOne({ questionId: id }).lean().exec();
  return res.json({
    success: true,
    data: { configured: Boolean(config.OPENAI_API_KEY.trim()), report: report ? { input: report.input, result: report.result } : null }
  });
}));

router.post('/questions/:id/verification', verificationLimiter, wrap(async (req, res) => {
  const id = objectId(req.params.id);
  const parsed = verificationInputSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Provide a question, 2-6 non-empty options, a valid selected answer and reference date.');
  if (!await Question.exists({ _id: id })) throw new ApiError(404, 'Question not found.');
  const result = await verifyQuestion(parsed.data);
  const report = await QuestionVerification.findOneAndUpdate(
    { questionId: id },
    { $set: { input: parsed.data, result, checkedBy: req.user.id } },
    { upsert: true, new: true, runValidators: true }
  ).exec();
  return res.json({ success: true, data: { input: report.input, result: report.result } });
}));

/* ---------- translation (English -> Assamese) ---------- */

const translateSchema = z.object({ texts: z.array(z.string().max(5000)).max(60) });

router.post('/translate', wrap(async (req, res) => {
  const parsed = translateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid translation request.');
  const translations = await translationService.translate(parsed.data.texts);
  return res.json({ success: true, data: { translations } });
}));

/* ---------- overview ---------- */

router.get('/stats', wrap(async (_req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [users, admins, payers, questions, activeQuestions, attempts, completed, today, byLanguage, revenue, byCategory] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: { $in: ['admin', 'superadmin'] } }),
    User.countDocuments({ 'purchases.0': { $exists: true } }),
    Question.countDocuments(),
    Question.countDocuments({ isActive: { $ne: false } }),
    TestAttempt.countDocuments(),
    TestAttempt.countDocuments({ status: 'submitted' }),
    TestAttempt.countDocuments({ startedAt: { $gte: startOfDay } }),
    Question.aggregate([{ $unwind: '$languages' }, { $group: { _id: '$languages', count: { $sum: 1 } } }]),
    User.aggregate([{ $unwind: '$purchases' }, { $group: { _id: null, total: { $sum: '$purchases.amount' }, count: { $sum: 1 } } }]),
    Question.aggregate([{ $unwind: '$categories' }, { $group: { _id: '$categories', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }])
  ]);

  return res.json({
    success: true,
    data: {
      users: { total: users, admins, payers, guests: users - admins - payers },
      questions: { total: questions, active: activeQuestions, byLanguage: Object.fromEntries(byLanguage.map((entry) => [entry._id, entry.count])), byCategory: byCategory.map((entry) => ({ name: entry._id, count: entry.count })) },
      attempts: { total: attempts, completed, today },
      revenue: { total: revenue[0]?.total ?? 0, purchases: revenue[0]?.count ?? 0 }
    }
  });
}));

const TREND_DAYS = 30;

// Daily series for the overview line charts, in India time. Time spent is the attempt's tracked duration, bucketed by the day it started.
router.get('/stats/trends', wrap(async (_req, res) => {
  const days: string[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    days.push(new Date(Date.now() - i * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  }
  const since = new Date(Date.now() - (TREND_DAYS + 1) * 86_400_000);
  const day = (field: string) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: 'Asia/Kolkata' } });
  const fill = (rows: Array<{ _id: string }>, pick: (row: any) => number) => {
    const map = new Map(rows.map((row) => [row._id, pick(row)]));
    return days.map((d) => map.get(d) ?? 0);
  };

  const [signups, signupsBefore, purchases, purchasesBefore, attempts, activity] = await Promise.all([
    User.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: day('$createdAt'), n: { $sum: 1 } } }]),
    User.countDocuments({ createdAt: { $lt: since } }),
    User.aggregate([
      { $unwind: '$purchases' }, { $match: { 'purchases.purchasedAt': { $gte: since } } },
      { $group: { _id: day('$purchases.purchasedAt'), amount: { $sum: '$purchases.amount' }, n: { $sum: 1 } } }
    ]),
    User.aggregate([{ $unwind: '$purchases' }, { $match: { 'purchases.purchasedAt': { $lt: since } } }, { $group: { _id: null, amount: { $sum: '$purchases.amount' } } }]),
    TestAttempt.aggregate([
      { $match: { startedAt: { $gte: since } } },
      { $group: { _id: day('$startedAt'), attempts: { $sum: 1 }, seconds: { $sum: '$elapsedSeconds' }, users: { $addToSet: '$userId' } } }
    ]),
    AdminActivity.find({ day: { $in: days } }).lean().exec()
  ]);

  const adminMap = new Map<string, { name: string; minutes: number[] }>();
  for (const row of activity) {
    const key = String(row.userId);
    const entry = adminMap.get(key) ?? { name: row.name, minutes: days.map(() => 0) };
    entry.name = row.name;
    entry.minutes[days.indexOf(row.day)] += Math.round(row.seconds / 60);
    adminMap.set(key, entry);
  }
  const adminTime = [...adminMap.values()]
    .sort((a, b) => b.minutes.reduce((x, y) => x + y, 0) - a.minutes.reduce((x, y) => x + y, 0))
    .slice(0, 8);

  const cumulative = (values: number[], base: number) => values.reduce<number[]>((acc, v) => [...acc, (acc[acc.length - 1] ?? base) + v], []);
  return res.json({
    success: true,
    data: {
      days,
      newUsers: cumulative(fill(signups, (r) => r.n), signupsBefore),
      revenue: cumulative(fill(purchases, (r) => r.amount), purchasesBefore[0]?.amount ?? 0),
      purchases: fill(purchases, (r) => r.n),
      minutesSpent: fill(attempts, (r) => Math.round(r.seconds / 60)),
      activeUsers: fill(attempts, (r) => r.users.length),
      attempts: fill(attempts, (r) => r.attempts),
      adminTime
    }
  });
}));

/* ---------- questions ---------- */

router.get('/questions', wrap(async (req, res) => {
  const loadAll = req.query.pageSize === 'all';
  const { page, pageSize, skip } = loadAll ? { page: 1, pageSize: 0, skip: 0 } : paging(req.query, 500);
  const filter: Record<string, unknown> = {};
  const search = String(req.query.search ?? '').trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ questionText: pattern }, { questionId: pattern }, { 'localized.as.questionText': pattern }];
  }
  if (req.query.language) filter.languages = String(req.query.language);
  if (req.query.exam) filter.exams = String(req.query.exam);
  if (req.query.category) filter.categories = String(req.query.category);
  if (req.query.status === 'active') filter.isActive = { $ne: false };
  if (req.query.status === 'inactive') filter.isActive = false;

  const [items, total] = await Promise.all([
    Question.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(pageSize)
      .select('questionId questionText localized.en.questionText localized.as.questionText languages categories exams difficulty isActive updatedAt').lean().exec(),
    Question.countDocuments(filter)
  ]);

  return res.json({
    success: true,
    data: {
      page, pageSize: loadAll ? Math.max(total, 1) : pageSize, total,
      items: items.map((question: any) => ({
        id: String(question._id),
        questionId: question.questionId ?? null,
        questionText: question.questionText,
        questionTextEn: question.localized?.en?.questionText ?? ((question.languages ?? ['en']).includes('en') ? question.questionText : null),
        questionTextAs: question.localized?.as?.questionText ?? (question.languages?.length === 1 && question.languages[0] === 'as' ? question.questionText : null),
        languages: question.languages ?? ['en'],
        categories: question.categories ?? [],
        exams: question.exams ?? [],
        difficulty: question.difficulty,
        isActive: question.isActive !== false,
        updatedAt: question.updatedAt
      }))
    }
  });
}));

router.get('/questions/:id', wrap(async (req, res) => {
  const question: any = await Question.findById(objectId(req.params.id)).lean().exec();
  if (!question) throw new ApiError(404, 'Question not found.');

  // Older questions have no localized block, so build one from the plain fields.
  const localized = Object.keys(question.localized ?? {}).length
    ? question.localized
    : { en: { questionText: question.questionText, options: question.options ?? [], explanation: question.explanation ?? '', optionExplanations: [], commonMisconceptions: [] } };

  return res.json({
    success: true,
    data: {
      id: String(question._id),
      questionId: question.questionId ?? null,
      localized,
      referenceImage: question.referenceImage ?? null,
      correctOption: question.correctOption ?? 0,
      categories: question.categories ?? [],
      exams: question.exams ?? [],
      difficulty: question.difficulty ?? 'Medium',
      subject: question.subject ?? '',
      topic: question.topic ?? '',
      tags: question.tags ?? [],
      isActive: question.isActive !== false
    }
  });
}));

const localizedSchema = z.object({
  questionText: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  explanation: z.string().trim().max(3000).default(''),
  commonMisconceptions: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
  optionExplanations: z.array(z.string().max(1000)).max(6).optional()
});

const questionUpdateSchema = z.object({
  referenceImage: referenceImageSchema,
  localized: z.object({ en: localizedSchema.optional(), as: localizedSchema.optional() }),
  correctOption: z.number().int().min(0).max(5),
  categories: z.array(z.string().trim().min(1).max(100)).max(100),
  exams: z.array(z.string().trim().min(1).max(100)).max(10),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  subject: z.string().trim().max(100).default(''),
  topic: z.string().trim().max(100).default(''),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  isActive: z.boolean()
});

const questionBulkUpdateSchema = z.object({
  ids: z.array(z.string().refine(mongoose.isValidObjectId, 'Invalid question id.'))
    .min(1).max(500).refine((ids) => new Set(ids).size === ids.length, 'Question ids must be unique.'),
  updates: z.object({
    categories: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    exams: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
    isActive: z.boolean().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(30).optional()
  }).strict().refine((updates) => Object.keys(updates).length > 0, 'Choose at least one metadata field to update.')
});

const chatSchema = z.object({ text: z.string().trim().min(1).max(1000) });
const serializeChat = (doc: any) => ({ id: String(doc._id), userId: String(doc.userId), name: doc.name, text: doc.text, createdAt: new Date(doc.createdAt).toISOString() });

router.get('/broadcast', wrap(async (_req, res) => {
  const docs = await AdminChatMessage.find().sort({ createdAt: -1 }).limit(100).lean().exec();
  res.json({ success: true, data: docs.reverse().map(serializeChat) });
}));

router.post('/broadcast', validateRequest(chatSchema), wrap(async (req, res) => {
  const name = req.user?.name?.trim() || req.user?.email?.split('@')[0] || 'Admin';
  const doc = await AdminChatMessage.create({ userId: req.user.id, name, text: req.body.text });
  const message = serializeChat(doc);
  broadcastChat(message);
  res.status(201).json({ success: true, data: message });
}));

const categoryNameSchema = z.object({ name: z.string().trim().min(1).max(100) });

router.get('/exams', wrap(async (_req, res) => {
  const docs = await listQuestionExams();
  const counts = await Question.aggregate([
    { $unwind: '$exams' },
    { $group: { _id: '$exams', count: { $sum: 1 } } }
  ]);
  const byName = new Map<string, number>(counts.map((entry) => [entry._id, entry.count]));
  res.json({ success: true, data: docs.map((doc) => ({ id: String(doc._id), name: doc.name, count: byName.get(doc.name) ?? 0 })) });
}));

router.post('/exams', validateRequest(categoryNameSchema), wrap(async (req, res) => {
  const doc = await createQuestionExam(req.body.name);
  res.status(201).json({ success: true, data: { id: String(doc._id), name: doc.name, count: 0 } });
}));

router.put('/exams/:id', validateRequest(categoryNameSchema), wrap(async (req, res) => {
  const doc = await renameQuestionExam(objectId(req.params.id), req.body.name);
  res.json({ success: true, data: { id: String(doc._id), name: doc.name } });
}));

router.delete('/exams/:id', wrap(async (req, res) => {
  await deleteQuestionExam(objectId(req.params.id));
  res.json({ success: true });
}));

router.get('/categories', wrap(async (_req, res) => {
  const docs = await listCategories();
  const counts = await Question.aggregate([
    { $unwind: '$categories' },
    { $group: { _id: '$categories', count: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 0, 1] } } } }
  ]);
  const byName = new Map<string, { count: number; active: number }>(counts.map((entry) => [entry._id, { count: entry.count, active: entry.active }]));
  res.json({ success: true, data: docs.map((doc) => ({ id: String(doc._id), name: doc.name, count: byName.get(doc.name)?.count ?? 0, active: byName.get(doc.name)?.active ?? 0 })) });
}));

router.post('/categories', validateRequest(categoryNameSchema), wrap(async (req, res) => {
  const doc = await createCategory(req.body.name);
  res.status(201).json({ success: true, data: { id: String(doc._id), name: doc.name, count: 0 } });
}));

router.put('/categories/:id', validateRequest(categoryNameSchema), wrap(async (req, res) => {
  const doc = await renameCategory(objectId(req.params.id), req.body.name);
  res.json({ success: true, data: { id: String(doc._id), name: doc.name } });
}));

router.delete('/categories/:id', wrap(async (req, res) => {
  await deleteCategory(objectId(req.params.id));
  res.json({ success: true });
}));

/* ---------- simulation ---------- */

const simulationModeSchema = z.enum(['landscape', 'portrait']).default('landscape');
const simulationSchema = z.object({
  category: z.string().trim().min(1).max(100),
  count: z.coerce.number().int().min(1).max(500),
  language: z.enum(['en', 'as', 'both']).default('both'),
  mode: simulationModeSchema,
  questionIds: z.array(z.string().regex(/^[a-f\d]{24}$/i).transform((id) => id.toLowerCase())).min(1).max(500)
    .refine((ids) => new Set(ids).size === ids.length, 'Question IDs must be unique.')
    .optional()
});

router.get('/simulation/questions', requireSuperAdmin, wrap(async (req, res) => {
  const parsedMode = simulationModeSchema.safeParse(req.query.mode);
  const category = z.string().trim().min(1).max(100).safeParse(req.query.category);
  if (!parsedMode.success || !category.success) throw new ApiError(400, 'Choose a valid simulation subject and mode.');
  res.json({ success: true, data: await listAvailableSimulationQuestions(category.data, parsedMode.data) });
}));

router.get('/simulation/categories', requireSuperAdmin, wrap(async (req, res) => {
  const parsed = simulationModeSchema.safeParse(req.query.mode);
  if (!parsed.success) throw new ApiError(400, 'Choose a valid simulation mode.');
  res.json({ success: true, data: await listSimulationCategories(parsed.data) });
}));

router.post('/simulation/reset', requireSuperAdmin, validateRequest(simulationSchema.pick({ category: true, mode: true })), wrap(async (req, res) => {
  await resetSimulationHistory(req.body.category, req.body.mode);
  res.json({ success: true });
}));

// Starting reserves the batch in the mode's shared history, including ended-early sessions.
router.post('/simulation', requireSuperAdmin, wrap(async (req, res) => {
  const parsed = simulationSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Choose a category and a valid number of questions.');
  const { category, count, language, mode, questionIds } = parsed.data;
  if (questionIds && questionIds.length !== count) throw new ApiError(400, 'Question count must match the selected questions.');

  const docs = await reserveSimulationQuestions(category, count, mode, questionIds);

  const items = docs.map((doc) => {
    const bilingual = language === 'both' ? bilingualQuestion(doc) : null;
    const value = bilingual ?? doc.localized?.[language] ?? doc.localized?.en;
    const local = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const localOptions = Array.isArray(local.options) && local.options.every((option) => typeof option === 'string') ? local.options : [];
    const options: string[] = localOptions.length ? localOptions : doc.options ?? [];
    return {
      id: String(doc._id),
      questionId: doc.questionId ?? null,
      ...(mode === 'landscape' ? { referenceImage: doc.referenceImage ?? null } : {}),
      questionText: typeof local.questionText === 'string' && local.questionText ? local.questionText : doc.questionText,
      options,
      language: bilingual?.language ?? (language === 'as' ? 'as' : 'en'),
      translation: bilingual?.translation ? {
        questionText: bilingual.translation.questionText,
        options: bilingual.translation.options,
        explanation: bilingual.translation.explanation
      } : null,
      correctOption: Math.min(Math.max(0, doc.correctOption ?? 0), Math.max(0, options.length - 1)),
      explanation: typeof local.explanation === 'string' && local.explanation ? local.explanation : doc.explanation || ''
    };
  });

  return res.json({ success: true, data: { category, items } });
}));

router.put('/questions/:id', validateRequest(questionUpdateSchema), wrap(async (req, res) => {
  await listQuestionExams();
  if ((req.body.exams as string[]).some((name) => !getExamNames().includes(name))) throw new ApiError(400, 'Unknown exam.');
  if ((req.body.categories as string[]).some((name) => !getCategoryNames().includes(name))) throw new ApiError(400, 'Unknown category.');
  const body = req.body as z.infer<typeof questionUpdateSchema>;
  const existing: any = await Question.findById(objectId(req.params.id)).lean().exec();
  if (!existing) throw new ApiError(404, 'Question not found.');

  const languages = (['en', 'as'] as const).filter((language) => body.localized[language]);
  if (!languages.length) throw new ApiError(400, 'Provide the question in English, Assamese, or both.');

  const primary = body.localized.en ?? body.localized.as!;
  const count = primary.options.length;
  if (languages.some((language) => body.localized[language]!.options.length !== count)) {
    throw new ApiError(400, 'English and Assamese must have the same number of options.');
  }
  if (body.correctOption >= count) throw new ApiError(400, 'Correct option is out of range.');

  const localized = Object.fromEntries(
    languages.map((language) => {
      const entry = body.localized[language]!;
      return [language, { ...entry, optionExplanations: entry.optionExplanations ?? existing.localized?.[language]?.optionExplanations ?? [] }];
    })
  );

  await Question.updateOne(
    { _id: existing._id },
    {
      $set: {
        localized,
        ...(body.referenceImage !== undefined ? { referenceImage: body.referenceImage } : {}),
        languages,
        questionText: primary.questionText,
        options: primary.options,
        explanation: primary.explanation,
        correctOption: body.correctOption,
        'answerKey.correctOptionIds': [letter(body.correctOption)],
        'content.statement': primary.questionText,
        'content.options': primary.options.map((text, index) => ({ id: letter(index), text, label: letter(index), isCorrect: index === body.correctOption, order: index + 1 })),
        categories: body.categories,
        exams: body.exams,
        'classification.exam': body.exams,
        difficulty: body.difficulty,
        subject: body.categories[0] || body.subject || existing.subject,
        topic: body.topic || existing.topic,
        ...(body.tags ? { tags: body.tags, 'classification.tags': body.tags } : {}),
        isActive: body.isActive
      }
    }
  );

  return res.json({ success: true, message: 'Question updated.' });
}));

router.patch('/questions/bulk', validateRequest(questionBulkUpdateSchema), wrap(async (req, res) => {
  const { ids, updates } = req.body as z.infer<typeof questionBulkUpdateSchema>;
  await listQuestionExams();
  if (updates.exams?.some((name) => !getExamNames().includes(name))) throw new ApiError(400, 'Unknown exam.');
  if (updates.categories?.some((name) => !getCategoryNames().includes(name))) throw new ApiError(400, 'Unknown category.');

  const questionIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const existingCount = await Question.countDocuments({ _id: { $in: questionIds } });
  if (existingCount !== questionIds.length) throw new ApiError(404, 'One or more selected questions no longer exist.');

  const set: Record<string, unknown> = {};
  if (updates.categories) {
    set.categories = updates.categories;
    set.subject = updates.categories[0] ?? '';
  }
  if (updates.exams) {
    set.exams = updates.exams;
    set['classification.exam'] = updates.exams;
  }
  if (updates.difficulty) set.difficulty = updates.difficulty;
  if (updates.isActive !== undefined) set.isActive = updates.isActive;
  if (updates.tags) {
    set.tags = updates.tags;
    set['classification.tags'] = updates.tags;
  }

  const result = await Question.updateMany({ _id: { $in: questionIds } }, { $set: set });
  return res.json({ success: true, data: { matchedCount: result.matchedCount } });
}));

router.patch('/questions/:id/active', validateRequest(z.object({ isActive: z.boolean() })), wrap(async (req, res) => {
  const result = await Question.updateOne({ _id: objectId(req.params.id) }, { $set: { isActive: req.body.isActive } });
  if (!result.matchedCount) throw new ApiError(404, 'Question not found.');
  return res.json({ success: true });
}));

router.delete('/questions/:id', wrap(async (req, res) => {
  const result = await Question.deleteOne({ _id: objectId(req.params.id) });
  if (!result.deletedCount) throw new ApiError(404, 'Question not found.');
  return res.json({ success: true });
}));

/* ---------- users ---------- */

const userSummary = (user: any) => {
  const entitlements = resolveEntitlements(user);
  return {
    id: String(user._id),
    email: user.email ?? null,
    name: user.name ?? null,
    phoneNumber: user.phoneNumber ?? null,
    role: user.role,
    tier: entitlements.tier,
    purchases: entitlements.purchases,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    locked: Boolean(user.lockUntil && new Date(user.lockUntil).getTime() > Date.now())
  };
};

router.get('/users', wrap(async (req, res) => {
  const { page, pageSize, skip } = paging(req.query);
  const filter: Record<string, unknown> = {};
  const search = String(req.query.search ?? '').trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ email: pattern }, { name: pattern }, { phoneNumber: pattern }];
  }
  if (req.query.role === 'admin' || req.query.role === 'superadmin' || req.query.role === 'user') filter.role = req.query.role;

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean().exec(),
    User.countDocuments(filter)
  ]);
  return res.json({ success: true, data: { page, pageSize, total, items: items.map(userSummary) } });
}));

const roleSchema = z.enum(['user', 'admin', 'superadmin']);

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(80),
  password: passwordRule,
  role: roleSchema.default('user'),
  packs: z.array(packageIdSchema).max(100).default([])
});

router.post('/users', requireSuperAdmin, validateRequest(createUserSchema), wrap(async (req, res) => {
  const body = req.body as z.infer<typeof createUserSchema>;
  const purchases = await Promise.all(Array.from(new Set(body.packs)).map(async (pack) => ({
    pack, access: (await requirePackage(pack)).access, amount: 0, purchasedAt: new Date()
  })));
  if (await User.exists({ email: body.email })) throw new ApiError(409, 'An account with this email already exists.');
  const user = await User.create({
    email: body.email,
    name: body.name,
    role: body.role,
    passwordHash: await hashPassword(body.password),
    purchases
  });
  return res.status(201).json({ success: true, data: userSummary(user.toObject()) });
}));

const superAdminCount = () => User.countDocuments({ role: 'superadmin' });

router.patch('/users/:id', requireSuperAdmin, validateRequest(z.object({ role: roleSchema.optional(), name: z.string().trim().min(2).max(80).optional() })), wrap(async (req, res) => {
  const id = objectId(req.params.id);
  const user = await User.findById(id).exec();
  if (!user) throw new ApiError(404, 'User not found.');

  if (req.body.role && req.body.role !== user.role) {
    if (id === req.user.id) throw new ApiError(400, 'You cannot change your own role.');
    if (user.role === 'superadmin' && (await superAdminCount()) <= 1) throw new ApiError(400, 'At least one super admin must remain.');
    user.role = req.body.role;
    user.tokenVersion += 1;
  }
  if (req.body.name) user.name = req.body.name;
  await user.save();
  return res.json({ success: true, data: userSummary(user.toObject()) });
}));

const grantSchema = z.object({ pack: packageIdSchema, amount: z.number().min(0).max(1_000_000).default(0) });

router.post('/users/:id/purchases', requireSuperAdmin, validateRequest(grantSchema), wrap(async (req, res) => {
  const user = await User.findById(objectId(req.params.id)).exec();
  if (!user) throw new ApiError(404, 'User not found.');
  const { pack, amount } = req.body as z.infer<typeof grantSchema>;
  if (user.purchases.some((purchase) => purchase.pack === pack)) {
    throw new ApiError(409, 'User already has this Test Series.');
  }
  user.purchases.push({ pack, access: (await requirePackage(pack)).access, amount, purchasedAt: new Date() });
  await user.save();
  return res.status(201).json({ success: true, data: userSummary(user.toObject()) });
}));

router.delete('/users/:id/purchases/:pack', requireSuperAdmin, wrap(async (req, res) => {
  const user = await User.findById(objectId(req.params.id)).exec();
  if (!user) throw new ApiError(404, 'User not found.');
  user.purchases = user.purchases.filter((purchase) => purchase.pack !== req.params.pack) as typeof user.purchases;
  await user.save();
  return res.json({ success: true, data: userSummary(user.toObject()) });
}));

router.post('/users/:id/password', requireSuperAdmin, validateRequest(z.object({ password: passwordRule })), wrap(async (req, res) => {
  const id = objectId(req.params.id);
  const result = await User.updateOne({ _id: id }, { $set: { passwordHash: await hashPassword(req.body.password), failedLoginCount: 0, lockUntil: null } });
  if (!result.matchedCount) throw new ApiError(404, 'User not found.');
  await revokeAllSessions(id);
  return res.json({ success: true, message: 'Password reset and sessions revoked.' });
}));

router.post('/users/:id/unlock', requireSuperAdmin, wrap(async (req, res) => {
  await User.updateOne({ _id: objectId(req.params.id) }, { $set: { failedLoginCount: 0, lockUntil: null } });
  return res.json({ success: true });
}));

router.post('/users/:id/sign-out', requireSuperAdmin, wrap(async (req, res) => {
  await revokeAllSessions(objectId(req.params.id));
  return res.json({ success: true });
}));

router.delete('/users/:id', requireSuperAdmin, wrap(async (req, res) => {
  const id = objectId(req.params.id);
  if (id === req.user.id) throw new ApiError(400, 'You cannot delete your own account.');
  const user = await User.findById(id).exec();
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role === 'superadmin' && (await superAdminCount()) <= 1) throw new ApiError(400, 'At least one super admin must remain.');
  if (user.role === 'user') {
    await deleteUserAccount(id, 'administrator');
    return res.json({ success: true });
  }
  await Promise.all([User.deleteOne({ _id: id }), RefreshToken.deleteMany({ userId: id }), TestAttempt.deleteMany({ userId: id })]);
  return res.json({ success: true });
}));

/* ---------- purchases, tests, pricing, settings ---------- */

router.get('/purchases', wrap(async (req, res) => {
  const { page, pageSize, skip } = paging(req.query);
  const rows = await User.aggregate([
    { $unwind: '$purchases' },
    { $sort: { 'purchases.purchasedAt': -1 } },
    { $facet: {
      items: [{ $skip: skip }, { $limit: pageSize }, { $project: { email: 1, name: 1, purchase: '$purchases' } }],
      totals: [{ $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$purchases.amount' } } }]
    } }
  ]);
  const facet = rows[0] ?? { items: [], totals: [] };
  return res.json({
    success: true,
    data: {
      page, pageSize,
      total: facet.totals[0]?.count ?? 0,
      revenue: facet.totals[0]?.revenue ?? 0,
      items: facet.items.map((row: any) => ({ userId: String(row._id), email: row.email ?? null, name: row.name ?? null, ...row.purchase }))
    }
  });
}));

router.get('/messages', wrap(async (req, res) => {
  const { page, pageSize, skip } = paging(req.query);
  const [items, total, unread] = await Promise.all([
    ContactMessage.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    ContactMessage.countDocuments(),
    ContactMessage.countDocuments({ read: false })
  ]);
  return res.json({
    success: true,
    data: { page, pageSize, total, unread, items: items.map((m) => ({ ...m, id: String(m._id) })) }
  });
}));

router.patch('/messages/:id', validateRequest(z.object({ read: z.boolean() })), wrap(async (req, res) => {
  const message = await ContactMessage.findByIdAndUpdate(objectId(req.params.id), { read: req.body.read }, { new: true }).lean();
  if (!message) throw new ApiError(404, 'Message not found.');
  return res.json({ success: true, data: { ...message, id: String(message._id) } });
}));

router.delete('/messages/:id', wrap(async (req, res) => {
  const result = await ContactMessage.findByIdAndDelete(objectId(req.params.id));
  if (!result) throw new ApiError(404, 'Message not found.');
  return res.json({ success: true, data: { deleted: true } });
}));

router.get('/flags', wrap(async (req, res) => {
  const { page, pageSize, skip } = paging(req.query);
  const status = FLAG_STATUSES.find((s) => s === req.query.status);
  const filter = status ? { status } : {};
  const [rows, total, open] = await Promise.all([
    QuestionFlag.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize)
      .populate('userId', 'email name')
      .populate('questionId', 'questionText options subject topic')
      .lean().exec(),
    QuestionFlag.countDocuments(filter),
    QuestionFlag.countDocuments({ status: 'open' })
  ]);
  const items = rows.map((f: any) => ({
    id: String(f._id),
    reason: f.reason,
    note: f.note,
    adminNote: f.adminNote,
    status: f.status,
    createdAt: f.createdAt,
    resolvedAt: f.resolvedAt ?? null,
    reporter: f.userId?.name || f.userId?.email || 'Unknown',
    question: f.questionId
      ? {
          id: String(f.questionId._id),
          text: f.questionId.questionText,
          options: f.questionId.options ?? [],
          subject: f.questionId.subject ?? '',
          topic: f.questionId.topic ?? ''
        }
      : null
  }));
  return res.json({ success: true, data: { page, pageSize, total, open, items } });
}));

router.patch('/flags/:id', validateRequest(z.object({
  status: z.enum(FLAG_STATUSES),
  adminNote: z.string().trim().max(500).optional()
})), wrap(async (req, res) => {
  const update: Record<string, unknown> = { status: req.body.status };
  if (req.body.adminNote !== undefined) update.adminNote = req.body.adminNote;
  if (req.body.status === 'open') {
    update.$unset = { resolvedBy: 1, resolvedAt: 1 };
  } else {
    update.resolvedBy = req.user?.id;
    update.resolvedAt = new Date();
  }
  const flag = await QuestionFlag.findByIdAndUpdate(objectId(req.params.id), update, { new: true }).lean();
  if (!flag) throw new ApiError(404, 'Flag not found.');
  return res.json({ success: true, data: { id: String(flag._id), status: flag.status } });
}));

router.delete('/flags/:id', wrap(async (req, res) => {
  const result = await QuestionFlag.findByIdAndDelete(objectId(req.params.id));
  if (!result) throw new ApiError(404, 'Flag not found.');
  return res.json({ success: true, data: { deleted: true } });
}));

router.get('/reviews', wrap(async (req, res) => {
  const { page, pageSize, skip } = paging(req.query);
  const pack = typeof req.query.pack === 'string' && req.query.pack ? (await requirePackage(req.query.pack)).pack : undefined;
  const filter = pack ? { pack } : {};
  const [rows, total, stats] = await Promise.all([
    PackageReview.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).populate('userId', 'email name').lean().exec(),
    PackageReview.countDocuments(filter),
    PackageReview.aggregate([{ $group: { _id: '$pack', avg: { $avg: '$rating' }, count: { $sum: 1 } } }])
  ]);
  return res.json({
    success: true,
    data: {
      page, pageSize, total,
      summary: stats.map((s) => ({ pack: s._id, average: Math.round(s.avg * 10) / 10, count: s.count })),
      items: rows.map((r: any) => ({
        id: String(r._id),
        pack: r.pack,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: r.userId?.name || r.userId?.email || 'Unknown',
        email: r.userId?.email ?? null
      }))
    }
  });
}));

router.delete('/reviews/:id', wrap(async (req, res) => {
  const result = await PackageReview.findByIdAndDelete(objectId(req.params.id));
  if (!result) throw new ApiError(404, 'Review not found.');
  return res.json({ success: true, data: { deleted: true } });
}));

router.get('/attempts', wrap(async (req, res) => {
  const { page, pageSize, skip } = paging(req.query);
  const [items, total] = await Promise.all([
    TestAttempt.find().sort({ startedAt: -1 }).skip(skip).limit(pageSize).populate('userId', 'email name').lean().exec(),
    TestAttempt.countDocuments()
  ]);
  return res.json({
    success: true,
    data: {
      page, pageSize, total,
      items: items.map((attempt: any) => ({
        id: String(attempt._id),
        user: attempt.userId?.email ?? attempt.userId?.name ?? 'Deleted user',
        status: attempt.status,
        kind: attempt.kind ?? 'practice',
        pack: attempt.pack ?? null,
        mock: attempt.mock ?? null,
        pyq: attempt.pyq?.year ? `${attempt.pyq.year} ${attempt.pyq.paperId ?? ''}`.trim() : null,
        questions: attempt.selectedQuestionIds?.length ?? 0,
        score: attempt.score ?? null,
        percentage: attempt.percentage ?? null,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt ?? null
      }))
    }
  });
}));

router.get('/pricing', wrap(async (_req, res) => res.json({ success: true, data: await listPrices() })));

router.get('/packages', wrap(async (_req, res) => res.json({ success: true, data: await listPrices() })));

router.get('/package-content', wrap(async (_req, res) => res.json({
  success: true, data: { options: await listPackageContent(), modes: PACKS.map(({ id, name }) => ({ id, name })) }
})));

router.post('/package-content', validateRequest(z.object({ id: contentIdSchema, details: contentSchema })), wrap(async (req, res) => {
  return res.status(201).json({ success: true, data: await savePackageContent(req.body.id, req.body.details, true) });
}));

router.put('/package-content/:id', validateRequest(contentSchema), wrap(async (req, res) => {
  const parsed = contentIdSchema.safeParse(req.params.id);
  if (!parsed.success) throw new ApiError(400, 'Invalid content option ID.');
  return res.json({ success: true, data: await savePackageContent(parsed.data, req.body, false) });
}));

router.post('/packages', validateRequest(z.object({ pack: packageIdSchema, details: packageSchema })), wrap(async (req, res) => {
  return res.status(201).json({ success: true, data: await savePackage(req.body.pack, req.body.details, true) });
}));

router.put('/packages/:pack', validateRequest(packageSchema), wrap(async (req, res) => {
  const parsed = packageIdSchema.safeParse(req.params.pack);
  if (!parsed.success) throw new ApiError(400, 'Invalid package ID.');
  const pack = parsed.data;
  return res.json({ success: true, data: await savePackage(pack, req.body, false) });
}));

router.put('/pricing', validateRequest(z.object({
  pack: packageIdSchema,
  price: z.number().min(0).max(100000).multipleOf(0.01).optional(),
  originalPrice: z.number().min(0).max(100000).multipleOf(0.01).nullable().optional(),
  enabled: z.boolean().optional()
})), wrap(async (req, res) => {
  const { pack, ...patch } = req.body;
  await setPrice(pack, patch);
  return res.json({ success: true, data: await listPrices() });
}));

router.get('/settings', wrap(async (_req, res) => res.json({ success: true, data: await getSettings() })));

router.put('/settings', validateRequest(z.object({
  dailyFreeQuestionCount: z.number().int().min(1).max(50),
  secondsPerQuestion: z.number().int().min(10).max(600),
  freeSubjectCategory: z.string().trim().max(100).optional()
})), wrap(async (req, res) => {
  const free: string | undefined = req.body.freeSubjectCategory;
  if (free) {
    const match = (await refreshCategories()).find((name) => name.toLowerCase() === free.toLowerCase());
    if (!match) throw new ApiError(400, 'Choose an existing category as the free subject.');
    req.body.freeSubjectCategory = match;
  }
  return res.json({ success: true, data: await updateSettings(req.body) });
}));

export default router;
