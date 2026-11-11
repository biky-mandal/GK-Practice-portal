import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { Question } from '../models/Question.js';
import { Exam } from '../models/Exam.js';
import { LifecycleStatus, ReviewStatus, QuestionType } from '../models/questionDomain.js';
import { QuestionDraft } from '../models/QuestionDraft.js';
import { createQuestionRecord, importQuestionRecords, bulkImportQuestions, resolveQuestionId, serializeQuestionAdmin, type BulkImportSummary } from '../services/questionService.js';
import { createExamRecord } from '../services/examService.js';
import { ApiError } from '../utils/ApiError.js';
import { referenceImageSchema, validateReferenceImage } from '../models/referenceImage.js';

const router = Router();

const adminQuestionSchema = z.object({
  questionText: z.string().min(1).optional(),
  referenceImage: referenceImageSchema,
  questionId: z.string().optional(),
  questionFormat: z.object({ type: z.nativeEnum(QuestionType), answerMode: z.string().optional() }).passthrough().optional(),
  answerKey: z.object({}).passthrough().optional(),
  classification: z.object({}).passthrough().optional(),
  content: z.object({}).passthrough().optional(),
  options: z.array(z.any()).optional(),
  explanation: z.string().optional(),
  tags: z.array(z.string()).optional(),
  workflow: z.object({ status: z.nativeEnum(LifecycleStatus).optional(), reviewStatus: z.nativeEnum(ReviewStatus).optional() }).passthrough().optional()
}).passthrough();

const adminExamSchema = z.object({
  title: z.string().min(1),
  examId: z.string().optional(),
  description: z.string().optional(),
  instructions: z.array(z.string()).optional(),
  totalDurationMinutes: z.number().min(1).optional(),
  totalMarks: z.number().min(1).optional(),
  questionCount: z.number().min(1).optional(),
  questionIds: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  questionSelectionMode: z.enum(['fixed', 'randomized']).optional()
}).passthrough();

router.get('/questions', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 }).limit(50).exec();
    return res.status(200).json({ success: true, data: questions.map((question) => serializeQuestionAdmin(question)) });
  } catch (error) {
    return next(error);
  }
});

router.post('/questions', requireAuth, requireAdmin, validateRequest(adminQuestionSchema), async (req, res, next) => {
  try {
    const question = await createQuestionRecord(req.body as Record<string, any>, String(req.user?.id));
    return res.status(201).json({ success: true, data: serializeQuestionAdmin(question) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/questions/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id).exec();
    if (!question) {
      throw new ApiError(404, 'Question not found.');
    }
    validateReferenceImage(req.body.referenceImage);
    Object.assign(question, req.body);
    if (req.body.workflow?.status) {
      question.workflow = { ...(question.workflow ?? {}), ...req.body.workflow, updatedBy: String(req.user?.id) };
    }
    await question.save();
    return res.status(200).json({ success: true, data: serializeQuestionAdmin(question) });
  } catch (error) {
    return next(error);
  }
});

router.post('/questions/import', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const records = Array.isArray(req.body) ? req.body : req.body?.questions ?? [];
    const created = await importQuestionRecords(records, String(req.user?.id));
    return res.status(201).json({ success: true, data: created.map((question) => serializeQuestionAdmin(question)) });
  } catch (error) {
    return next(error);
  }
});

router.post('/questions/bulk-import', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const records = Array.isArray(req.body) ? req.body : req.body?.questions;
    if (!Array.isArray(records) || records.length === 0) {
      throw new ApiError(400, 'Provide a non-empty array of questions.');
    }
    if (records.length > 1000) {
      throw new ApiError(400, 'Upload at most 1000 questions at a time.');
    }
    const summary = await bulkImportQuestions(records, String(req.user?.id));
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    return next(error);
  }
});

const serializeDraft = (draft: any) => ({
  id: String(draft._id),
  record: draft.record,
  setTitle: draft.setTitle || UNTITLED,
  fileName: draft.fileName,
  updatedAt: draft.updatedAt
});

const isPlainObject = (value: unknown) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

router.get('/questions/drafts', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const drafts = await QuestionDraft.find().sort({ createdAt: 1, _id: 1 }).exec();
    return res.status(200).json({ success: true, data: drafts.map(serializeDraft) });
  } catch (error) {
    return next(error);
  }
});

router.post('/questions/drafts', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const records = Array.isArray(req.body) ? req.body : req.body?.questions;
    if (!Array.isArray(records) || records.length === 0) {
      throw new ApiError(400, 'Provide a non-empty array of questions.');
    }
    if (records.length > 1000) {
      throw new ApiError(400, 'Upload at most 1000 questions at a time.');
    }
    if (!records.every(isPlainObject)) {
      throw new ApiError(400, 'Each question must be a JSON object.');
    }
    records.forEach((record) => validateReferenceImage(record.referenceImage));
    const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.slice(0, 200) : '';
    const setTitle = typeof req.body?.setTitle === 'string' ? req.body.setTitle.trim().slice(0, 120) : '';
    if (!setTitle) {
      throw new ApiError(400, 'A title is required for the draft set.');
    }
    const created = await QuestionDraft.insertMany(records.map((record) => ({
      record: { ...record, id: resolveQuestionId(record) },
      setTitle,
      fileName,
      createdBy: String(req.user?.id)
    })));
    return res.status(201).json({ success: true, data: created.map(serializeDraft) });
  } catch (error) {
    return next(error);
  }
});

const UNTITLED = 'Untitled set';
// Drafts saved before titles existed have no setTitle and are shown as "Untitled set".
const setFilter = (title: string) => (title === UNTITLED ? { $or: [{ setTitle: UNTITLED }, { setTitle: { $exists: false } }, { setTitle: null }, { setTitle: '' }] } : { setTitle: title });

router.post('/questions/drafts/rename-set', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const from = typeof req.body?.from === 'string' ? req.body.from : '';
    const to = typeof req.body?.to === 'string' ? req.body.to.trim().slice(0, 120) : '';
    if (!from || !to) {
      throw new ApiError(400, 'Both the current and the new title are required.');
    }
    await QuestionDraft.updateMany(setFilter(from), { $set: { setTitle: to } }).exec();
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/questions/drafts/delete-set', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title : '';
    if (!title) {
      throw new ApiError(400, 'Set title is required.');
    }
    await QuestionDraft.deleteMany(setFilter(title)).exec();
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.put('/questions/drafts/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!isPlainObject(req.body?.record)) {
      throw new ApiError(400, 'A question must be a JSON object.');
    }
    validateReferenceImage(req.body.record.referenceImage);
    const draft = await QuestionDraft.findByIdAndUpdate(req.params.id, { $set: { record: req.body.record } }, { new: true }).exec();
    if (!draft) {
      throw new ApiError(404, 'Draft not found.');
    }
    return res.status(200).json({ success: true, data: serializeDraft(draft) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/questions/drafts/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await QuestionDraft.findByIdAndDelete(req.params.id).exec();
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// Moves the given drafts (all when ids is omitted) into the main question set; failed ones stay as drafts.
router.post('/questions/drafts/publish', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const ids = req.body?.ids;
    if (ids !== undefined && (!Array.isArray(ids) || ids.length > 1000 || !ids.every((id: unknown) => typeof id === 'string'))) {
      throw new ApiError(400, 'ids must be an array of at most 1000 draft ids.');
    }
    const filter = ids ? { _id: { $in: ids } } : {};
    const drafts = await QuestionDraft.find(filter).sort({ createdAt: 1, _id: 1 }).limit(1000).exec();

    const summary: BulkImportSummary = { total: drafts.length, created: 0, updated: 0, failed: [] };
    const published: unknown[] = [];
    for (const [index, draft] of drafts.entries()) {
      const result = await bulkImportQuestions([draft.record], String(req.user?.id));
      summary.created += result.created;
      summary.updated += result.updated;
      if (result.failed.length) {
        summary.failed.push({ index, id: String(draft._id), error: result.failed[0].error });
      } else {
        published.push(draft._id);
      }
    }
    if (published.length) {
      await QuestionDraft.deleteMany({ _id: { $in: published } }).exec();
    }
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    return next(error);
  }
});

router.get('/questions/count', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    return res.status(200).json({ success: true, data: { total: await Question.countDocuments() } });
  } catch (error) {
    return next(error);
  }
});

router.post('/questions/:id/publish', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id).exec();
    if (!question) {
      throw new ApiError(404, 'Question not found.');
    }
    question.workflow = { ...(question.workflow ?? {}), status: LifecycleStatus.PUBLISHED, reviewStatus: ReviewStatus.ACCEPTED, updatedBy: String(req.user?.id), publishedAt: new Date() };
    await question.save();
    return res.status(200).json({ success: true, data: serializeQuestionAdmin(question) });
  } catch (error) {
    return next(error);
  }
});

router.post('/questions/:id/archive', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id).exec();
    if (!question) {
      throw new ApiError(404, 'Question not found.');
    }
    question.workflow = { ...(question.workflow ?? {}), status: LifecycleStatus.ARCHIVED, updatedBy: String(req.user?.id), archivedAt: new Date() };
    await question.save();
    return res.status(200).json({ success: true, data: serializeQuestionAdmin(question) });
  } catch (error) {
    return next(error);
  }
});

router.get('/exams', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const exams = await Exam.find().sort({ createdAt: -1 }).limit(50).exec();
    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    return next(error);
  }
});

router.post('/exams', requireAuth, requireAdmin, validateRequest(adminExamSchema), async (req, res, next) => {
  try {
    const exam = await createExamRecord(req.body as Record<string, any>, String(req.user?.id));
    return res.status(201).json({ success: true, data: exam });
  } catch (error) {
    return next(error);
  }
});

router.patch('/exams/:examId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const exam = await Exam.findOne({ examId: req.params.examId }).exec();
    if (!exam) {
      throw new ApiError(404, 'Exam not found.');
    }
    Object.assign(exam, req.body);
    exam.updatedBy = String(req.user?.id);
    await exam.save();
    return res.status(200).json({ success: true, data: exam });
  } catch (error) {
    return next(error);
  }
});

router.post('/exams/:examId/publish', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const exam = await Exam.findOne({ examId: req.params.examId }).exec();
    if (!exam) {
      throw new ApiError(404, 'Exam not found.');
    }
    exam.published = true;
    exam.updatedBy = String(req.user?.id);
    await exam.save();
    return res.status(200).json({ success: true, data: exam });
  } catch (error) {
    return next(error);
  }
});

export default router;
