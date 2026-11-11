import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { startExamAttempt, updateAttemptAnswers, submitExamAttempt, getAttemptResult } from '../services/examService.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

const answerSchema = z.object({
  selectedAnswers: z.record(z.any()).default({}),
  markedForReview: z.array(z.string()).default([])
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const attempts = await TestAttempt.find({ userId: req.user?.id }).sort({ startedAt: -1 }).exec();
    return res.status(200).json({
      success: true,
      data: attempts.map((attempt) => ({
        attemptId: String(attempt._id),
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        score: attempt.score ?? 0,
        percentage: attempt.percentage ?? 0
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:attemptId', requireAuth, async (req, res, next) => {
  try {
    const attemptId = Array.isArray(req.params.attemptId) ? req.params.attemptId[0] : req.params.attemptId;
    const attempt = await TestAttempt.findOne({ _id: attemptId, userId: req.user?.id }).exec();
    if (!attempt) {
      throw new ApiError(404, 'Attempt not found.');
    }

    return res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:attemptId/answers', requireAuth, validateRequest(answerSchema), async (req, res, next) => {
  try {
    const attemptId = Array.isArray(req.params.attemptId) ? req.params.attemptId[0] : req.params.attemptId;
    const { selectedAnswers, markedForReview } = req.body as { selectedAnswers: Record<string, unknown>; markedForReview: string[] };
    const attempt = await updateAttemptAnswers({
      attemptId,
      userId: String(req.user?.id),
      selectedAnswers,
      markedForReview
    });

    return res.status(200).json({
      success: true,
      data: {
        attemptId: String(attempt._id),
        selectedAnswers: attempt.selectedAnswers,
        markedForReview: attempt.markedForReview.map((id) => String(id))
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:attemptId/submit', requireAuth, async (req, res, next) => {
  try {
    const attemptId = Array.isArray(req.params.attemptId) ? req.params.attemptId[0] : req.params.attemptId;
    const { attempt, result, questions } = await submitExamAttempt({ attemptId, userId: String(req.user?.id) });
    return res.status(200).json({
      success: true,
      data: {
        attemptId: String(attempt._id),
        score: result.score,
        correctCount: result.correctCount,
        incorrectCount: result.incorrectCount,
        unansweredCount: result.unansweredCount,
        percentage: result.percentage,
        questionReview: questions.map((question) => ({
          id: String(question._id),
          questionText: question.questionText,
          explanation: question.explanation,
          answerKey: question.answerKey,
          selectedAnswer: attempt.selectedAnswers[String(question._id)]
        }))
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:attemptId/result', requireAuth, async (req, res, next) => {
  try {
    const attemptId = Array.isArray(req.params.attemptId) ? req.params.attemptId[0] : req.params.attemptId;
    const result = await getAttemptResult({ attemptId, userId: String(req.user?.id) });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

export default router;
