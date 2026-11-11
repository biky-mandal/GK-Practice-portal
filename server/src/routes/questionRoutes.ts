import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { Question } from '../models/Question.js';
import { LifecycleStatus, ReviewStatus, QuestionType } from '../models/questionDomain.js';
import { createQuestionRecord, importQuestionRecords, serializeQuestionAdmin, serializeQuestionPractice } from '../services/questionService.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

const createQuestionSchema = z.object({
  questionText: z.string().min(1).optional(),
  questionId: z.string().optional(),
  type: z.nativeEnum(QuestionType).optional(),
  questionFormat: z.object({
    type: z.nativeEnum(QuestionType),
    answerMode: z.string().optional()
  }).passthrough().optional(),
  answerKey: z.object({
    correctOptionIds: z.array(z.string()).optional(),
    acceptedAnswers: z.array(z.string()).optional(),
    modelAnswer: z.string().optional(),
    evaluationRubric: z.array(z.string()).optional(),
    numericalTolerance: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      absolute: z.number().optional(),
      relative: z.number().optional(),
      precision: z.number().optional()
    }).passthrough().optional()
  }).passthrough().optional(),
  classification: z.object({
    category: z.string().optional(),
    subject: z.string().optional(),
    topic: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).passthrough().optional(),
  content: z.object({}).passthrough().optional(),
  options: z.array(z.any()).optional(),
  explanation: z.string().optional(),
  evaluation: z.object({
    method: z.string().optional(),
    marks: z.number().optional(),
    negativeMarks: z.number().optional()
  }).passthrough().optional(),
  tags: z.array(z.string()).optional(),
  workflow: z.object({
    status: z.nativeEnum(LifecycleStatus).optional(),
    reviewStatus: z.nativeEnum(ReviewStatus).optional()
  }).passthrough().optional()
}).passthrough();

router.get('/', async (_req, res, next) => {
  try {
    const questions = await Question.find({ isActive: true, workflow: { status: LifecycleStatus.PUBLISHED } }).sort({ createdAt: -1 }).limit(50).exec();
    return res.status(200).json({
      success: true,
      data: questions.map((question) => serializeQuestionPractice(question))
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id).exec();
    if (!question) {
      throw new ApiError(404, 'Question not found.');
    }

    return res.status(200).json({
      success: true,
      data: serializeQuestionPractice(question)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/admin/questions', requireAuth, requireAdmin, validateRequest(createQuestionSchema), async (req, res, next) => {
  try {
    const question = await createQuestionRecord(req.body as Record<string, any>, String(req.user?.id));
    return res.status(201).json({
      success: true,
      data: serializeQuestionAdmin(question)
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/admin/questions/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id).exec();
    if (!question) {
      throw new ApiError(404, 'Question not found.');
    }

    Object.assign(question, req.body);
    question.workflow = {
      ...(question.workflow ?? {}),
      updatedBy: String(req.user?.id),
      status: req.body.workflow?.status ?? question.workflow?.status ?? LifecycleStatus.DRAFT
    };
    await question.save();

    return res.status(200).json({ success: true, data: serializeQuestionAdmin(question) });
  } catch (error) {
    return next(error);
  }
});

router.post('/admin/questions/import', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const records = Array.isArray(req.body) ? req.body : req.body?.questions ?? [];
    const created = await importQuestionRecords(records as Record<string, any>[], String(req.user?.id));
    return res.status(201).json({ success: true, data: created.map((question) => serializeQuestionAdmin(question)) });
  } catch (error) {
    return next(error);
  }
});

router.post('/admin/questions/:id/publish', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id).exec();
    if (!question) {
      throw new ApiError(404, 'Question not found.');
    }

    question.workflow = {
      ...(question.workflow ?? {}),
      status: LifecycleStatus.PUBLISHED,
      reviewStatus: ReviewStatus.ACCEPTED,
      updatedBy: String(req.user?.id),
      publishedAt: new Date()
    };
    await question.save();

    return res.status(200).json({ success: true, data: serializeQuestionAdmin(question) });
  } catch (error) {
    return next(error);
  }
});

router.post('/admin/questions/:id/archive', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id).exec();
    if (!question) {
      throw new ApiError(404, 'Question not found.');
    }

    question.workflow = {
      ...(question.workflow ?? {}),
      status: LifecycleStatus.ARCHIVED,
      updatedBy: String(req.user?.id),
      archivedAt: new Date()
    };
    await question.save();

    return res.status(200).json({ success: true, data: serializeQuestionAdmin(question) });
  } catch (error) {
    return next(error);
  }
});

export default router;
