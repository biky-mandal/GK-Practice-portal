import { Router } from 'express';
import mongoose from 'mongoose';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { Question } from '../models/Question.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { answersToRecord, getQuestionCategories, getDailyFreeStatus, getMockSummaries, getPyqSummaries } from '../services/testService.js';
import { PACKS } from '../models/packages.js';
import { loadEntitlements, ownsPack } from '../services/entitlementService.js';
import { listPrices } from '../services/pricingService.js';
import { bilingualQuestion } from '../services/questionI18n.js';
import { ApiError } from '../utils/ApiError.js';
import { type PracticeExam } from '../services/practiceExam.js';
import { getSettings, isFreeSubject } from '../services/settingsService.js';

// Tests are started and answered over the WebSocket, which enforces packages and the daily limit.
// Only read endpoints live here. Summaries are visible to every learner so locked packages can show what they contain.
const router = Router();

const requestedExam = (value: unknown): PracticeExam => {
  if (value === undefined || value === 'adre') return 'adre';
  if (value === 'police-forest') return value;
  throw new ApiError(400, 'Unknown practice exam.');
};

router.get('/categories', async (req, res, next) => {
  try {
    const [categories, { freeSubjectCategory }] = await Promise.all([getQuestionCategories(requestedExam(req.query.exam)), getSettings()]);
    return res.status(200).json({
      success: true,
      data: categories.map((category) => ({ ...category, free: isFreeSubject([category.name], freeSubjectCategory) }))
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/daily-free', requireAuth, async (req, res, next) => {
  try {
    return res.status(200).json({ success: true, data: await getDailyFreeStatus(String(req.user?.id)) });
  } catch (error) {
    return next(error);
  }
});

router.get('/packages', optionalAuth, async (req, res, next) => {
  try {
    const entitlements = req.user ? await loadEntitlements(req.user) : null;
    const prices = await listPrices();
    return res.status(200).json({
      success: true,
      data: PACKS.map((pack) => {
        const price = prices.find((entry) => entry.pack === pack.id);
        return {
          id: pack.id,
          name: pack.name,
          owned: entitlements ? ownsPack(entitlements, pack.id) : false,
          price: price?.price ?? null,
          originalPrice: price?.originalPrice ?? null,
          enabled: price?.enabled ?? true
        };
      })
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/pyq', optionalAuth, async (req, res, next) => {
  try {
    const entitlements = req.user ? await loadEntitlements(req.user) : null;
    return res.status(200).json({ success: true, data: { owned: entitlements ? ownsPack(entitlements, 'pyq') : false, years: await getPyqSummaries() } });
  } catch (error) {
    return next(error);
  }
});

router.get('/mocks', optionalAuth, async (req, res, next) => {
  try {
    const exam = requestedExam(req.query.exam);
    const entitlements = req.user ? await loadEntitlements(req.user) : null;
    return res.status(200).json({ success: true, data: { owned: entitlements ? ownsPack(entitlements, exam === 'police-forest' ? 'police-mock' : 'mock') : false, mocks: await getMockSummaries(exam) } });
  } catch (error) {
    return next(error);
  }
});

router.get('/:attemptId/result', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attemptId)) {
      throw new ApiError(404, 'Attempt not found.');
    }

    const attempt = await TestAttempt.findOne({ _id: req.params.attemptId, userId: req.user?.id }).exec();
    if (!attempt) {
      throw new ApiError(404, 'Attempt not found.');
    }

    if (attempt.status !== 'submitted') {
      throw new ApiError(400, 'Attempt has not been submitted yet.');
    }

    const found = await Question.find({ _id: { $in: attempt.selectedQuestionIds } }).exec();
    const byId = new Map(found.map((question) => [String(question._id), question]));
    const questions = attempt.selectedQuestionIds.map((id) => byId.get(String(id))).filter((question): question is NonNullable<typeof question> => question !== undefined);
    const answers = answersToRecord(attempt.selectedAnswers);
    const marked = new Set(attempt.markedForReview.map(String));

    return res.status(200).json({
      success: true,
      data: {
        attemptId: String(attempt._id),
        totalQuestions: attempt.selectedQuestionIds.length,
        unavailableQuestions: attempt.selectedQuestionIds.length - questions.length,
        correctAnswers: attempt.correctCount ?? 0,
        incorrectAnswers: attempt.incorrectCount ?? 0,
        unansweredQuestions: attempt.unansweredCount ?? 0,
        score: attempt.score ?? 0,
        maxMarks: attempt.pack === 'police-mock' ? 50 : attempt.selectedQuestionIds.length,
        percentage: attempt.percentage ?? 0,
        totalSeconds: attempt.totalSeconds ?? 0,
        timeTakenSeconds: Math.round(attempt.elapsedSeconds ?? 0),
        review: questions.map((question) => ({
          id: String(question._id),
          ...bilingualQuestion(question),
          subject: question.subject ?? 'General',
          categories: question.categories ?? [],
          topic: question.topic,
          difficulty: question.difficulty,
          markedForReview: marked.has(String(question._id)),
          selectedAnswer: answers[String(question._id)],
          correctOption: question.correctOption,
          isCorrect: answers[String(question._id)] === question.correctOption
        }))
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
