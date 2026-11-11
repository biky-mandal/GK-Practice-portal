import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { Exam } from '../models/Exam.js';
import { createExamRecord, getPublicExams, startExamAttempt } from '../services/examService.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

const examSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  instructions: z.array(z.string()).optional(),
  examId: z.string().optional(),
  questionIds: z.array(z.string()).optional(),
  questionSelectionMode: z.enum(['fixed', 'randomized']).optional(),
  questionSelectionConfig: z.object({ count: z.number().min(1).optional() }).passthrough().optional(),
  totalDurationMinutes: z.number().min(1).optional(),
  totalMarks: z.number().min(1).optional(),
  questionCount: z.number().min(1).optional(),
  marksForCorrect: z.number().optional(),
  marksForIncorrect: z.number().optional(),
  marksForUnanswered: z.number().optional(),
  negativeMarking: z.boolean().optional(),
  partialCredit: z.boolean().optional(),
  published: z.boolean().optional()
}).passthrough();

router.get('/', async (_req, res, next) => {
  try {
    const exams = await getPublicExams();
    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    return next(error);
  }
});

router.get('/:examId', async (req, res, next) => {
  try {
    const exam = await Exam.findOne({ examId: req.params.examId }).exec();
    if (!exam) {
      throw new ApiError(404, 'Exam not found.');
    }
    return res.status(200).json({
      success: true,
      data: {
        examId: exam.examId,
        title: exam.title,
        description: exam.description,
        totalDurationMinutes: exam.totalDurationMinutes,
        totalMarks: exam.totalMarks,
        questionCount: exam.questionCount,
        published: exam.published
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/admin/exams', requireAuth, requireAdmin, validateRequest(examSchema), async (req, res, next) => {
  try {
    const exam = await createExamRecord(req.body as Record<string, any>, String(req.user?.id));
    return res.status(201).json({ success: true, data: exam });
  } catch (error) {
    return next(error);
  }
});

router.patch('/admin/exams/:examId', requireAuth, requireAdmin, async (req, res, next) => {
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

router.post('/admin/exams/:examId/publish', requireAuth, requireAdmin, async (req, res, next) => {
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

router.post('/:examId/attempts', requireAuth, async (req, res, next) => {
  try {
    const examId = Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId;
    const { exam, attempt, questions } = await startExamAttempt({ userId: String(req.user?.id), examId });
    return res.status(201).json({
      success: true,
      data: {
        examId: exam.examId,
        attemptId: String(attempt._id),
        totalQuestions: questions.length,
        questions: questions.map((question) => ({
          id: String(question._id),
          questionText: question.questionText,
          options: question.content?.options ?? question.options,
          statement: question.content?.statement ?? question.questionText,
          subject: question.subject,
          topic: question.topic,
          difficulty: question.difficulty
        }))
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
