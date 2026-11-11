import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { Question } from '../models/Question.js';
import { answersToRecord, frozenElapsedSeconds, remainingSeconds } from '../services/testService.js';

const router = Router();

router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const attempts = await TestAttempt.find({ userId: req.user?.id }).sort({ startedAt: -1 }).exec();
    const completedAttempts = attempts.filter((attempt) => attempt.status === 'submitted');
    const attemptedCount = completedAttempts.reduce(
      (sum, attempt) => sum + (attempt.correctCount ?? 0) + (attempt.incorrectCount ?? 0),
      0
    );
    const testsCompleted = completedAttempts.length;
    const averageAccuracy = completedAttempts.length > 0
      ? completedAttempts.reduce((sum, attempt) => sum + Number(attempt.percentage ?? 0), 0) / completedAttempts.length
      : 0;

    const recentAttempts = completedAttempts.slice(0, 5).map((attempt) => ({
      id: String(attempt._id),
      score: attempt.score ?? 0,
      percentage: attempt.percentage ?? 0,
      status: attempt.status,
      submittedAt: attempt.submittedAt ?? attempt.startedAt,
      totalQuestions: attempt.selectedQuestionIds.length
    }));

    const active = attempts.find((attempt) => attempt.status === 'in_progress' && attempt.selectedQuestionIds.length > 0);
    const activeAttempt = active
      ? {
          id: String(active._id),
          totalQuestions: active.selectedQuestionIds.length,
          answeredCount: (active.selectedAnswers as unknown as Map<string, unknown>).size,
          totalSeconds: active.totalSeconds,
          remainingSeconds: remainingSeconds(active, frozenElapsedSeconds(active))
        }
      : null;

    const outcomes = completedAttempts.reduce(
      (sum, attempt) => ({
        correct: sum.correct + (attempt.correctCount ?? 0),
        incorrect: sum.incorrect + (attempt.incorrectCount ?? 0),
        unanswered: sum.unanswered + (attempt.unansweredCount ?? 0)
      }),
      { correct: 0, incorrect: 0, unanswered: 0 }
    );

    // Per-category accuracy over the 20 most recent submitted tests; a question counts toward each of its categories.
    const sample = completedAttempts.slice(0, 20);
    const sampleIds = sample.flatMap((attempt) => attempt.selectedQuestionIds);
    const questionById = new Map(
      (await Question.find({ _id: { $in: sampleIds } }, { categories: 1, correctOption: 1 }).lean().exec())
        .map((question: any) => [String(question._id), question])
    );
    const byCategory = new Map<string, { correct: number; total: number }>();
    for (const attempt of sample) {
      const answers = answersToRecord(attempt.selectedAnswers);
      for (const id of attempt.selectedQuestionIds) {
        const question: any = questionById.get(String(id));
        if (!question) continue;
        for (const category of question.categories ?? []) {
          const entry = byCategory.get(category) ?? { correct: 0, total: 0 };
          entry.total += 1;
          if (answers[String(id)] === question.correctOption) entry.correct += 1;
          byCategory.set(category, entry);
        }
      }
    }
    const categoryStats = Array.from(byCategory, ([category, value]) => ({
      category,
      total: value.total,
      accuracy: Math.round((value.correct / value.total) * 100)
    }));

    await Promise.resolve();

    return res.status(200).json({
      success: true,
      data: {
        welcomeMessage: `Welcome back, ${req.user?.email ?? 'Candidate'}!`,
        attemptedCount,
        testsCompleted,
        averageAccuracy: Number(averageAccuracy.toFixed(2)),
        recentAttempts,
        activeAttempt,
        outcomes,
        categoryStats
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/recent-attempts', requireAuth, async (req, res, next) => {
  try {
    const attempts = await TestAttempt.find({ userId: req.user?.id, status: 'submitted' }).sort({ submittedAt: -1, startedAt: -1 }).limit(10).exec();

    return res.status(200).json({
      success: true,
      data: attempts.map((attempt) => ({
        id: String(attempt._id),
        score: attempt.score ?? 0,
        percentage: attempt.percentage ?? 0,
        status: attempt.status,
        submittedAt: attempt.submittedAt ?? attempt.startedAt,
        totalQuestions: attempt.selectedQuestionIds.length,
        kind: attempt.kind,
        exam: attempt.exam,
        pyq: attempt.pyq,
        mock: attempt.mock,
        categories: attempt.categories
      }))
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
