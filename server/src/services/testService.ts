import { Question } from '../models/Question.js';
import { refreshCategories } from './categoryService.js';
import { MOCK_NUMBERS, isMockNumber, mockFilter } from '../models/mock.js';
import { PYQ_PAPERS, PYQ_YEARS, findPyqPaper, pyqFilter } from '../models/pyq.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { calculateAttemptScore } from '../utils/scoring.js';
import { getSettings } from './settingsService.js';
import { practiceExamFilter, practicePack, POLICE_MOCK_QUESTIONS, POLICE_MOCK_SECONDS, POLICE_MOCK_SCORING, type PracticeExam } from './practiceExam.js';
import { ApiError } from '../utils/ApiError.js';

export const PER_QUESTION_SECONDS = 60;
const MAX_PAPER_QUESTIONS = 300;

// The free test resets at midnight India time.
export const dayKeyIST = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export const findDailyAttempt = (userId: string) => TestAttempt.findOne({ userId, kind: 'daily_free', dayKey: dayKeyIST() }).exec();

export const getDailyFreeStatus = async (userId: string) => {
  const attempt = await findDailyAttempt(userId);
  const status = !attempt ? 'available' : attempt.status === 'in_progress' ? 'in_progress' : 'completed';
  return { status, questionCount: (await getSettings()).dailyFreeQuestionCount, attemptId: attempt ? String(attempt._id) : null };
};

type TimedAttempt = { elapsedSeconds?: number; lastResumedAt?: Date | null; lastActiveAt?: Date | null; totalSeconds?: number };

// Elapsed time as of the last heartbeat; used when no live connection owns the clock.
export const frozenElapsedSeconds = (attempt: TimedAttempt) => {
  const base = attempt.elapsedSeconds ?? 0;
  if (!attempt.lastResumedAt) return base;
  const end = attempt.lastActiveAt ?? attempt.lastResumedAt;
  return base + Math.max(0, (end.getTime() - attempt.lastResumedAt.getTime()) / 1000);
};

export const liveElapsedSeconds = (attempt: TimedAttempt, now = Date.now()) => {
  const base = attempt.elapsedSeconds ?? 0;
  if (!attempt.lastResumedAt) return base;
  return base + Math.max(0, (now - attempt.lastResumedAt.getTime()) / 1000);
};

export const remainingSeconds = (attempt: TimedAttempt, elapsed: number) =>
  Math.max(0, Math.ceil((attempt.totalSeconds ?? 0) - elapsed));

export const getQuestionCategories = async (exam: PracticeExam = 'adre') => {
  const counts = await Question.aggregate([
    {
      $match: {
        ...await practiceExamFilter(exam),
        isActive: { $ne: false },
        correctOption: { $gte: 0 },
        'options.1': { $exists: true }
      }
    },
    { $unwind: '$categories' },
    { $group: { _id: '$categories', count: { $sum: 1 } } }
  ]);
  const byName = new Map<string, number>(counts.map((entry) => [entry._id, entry.count]));
  return (await refreshCategories()).map((name) => ({ name, count: byName.get(name) ?? 0 }));
};

const PLAYABLE = { isActive: { $ne: false }, correctOption: { $gte: 0 }, 'options.1': { $exists: true } };

// Question counts for every previous-year paper. Each question holds English and Assamese together.
export const getPyqSummaries = async () => {
  const examFilter = await practiceExamFilter('adre');
  return Promise.all(
    PYQ_YEARS.map(async (year) => ({
      year,
      papers: await Promise.all(
        PYQ_PAPERS.map(async (paper) => ({
          id: paper.id,
          grade: paper.grade,
          paper: paper.paper,
          level: paper.level,
          count: await Question.countDocuments({ ...PLAYABLE, ...examFilter, ...pyqFilter(year, paper) })
        }))
      )
    }))
  );
};

export const getMockSummaries = async (exam: PracticeExam = 'adre') => {
  const examFilter = await practiceExamFilter(exam);
  return Promise.all(
    MOCK_NUMBERS.map(async (number) => ({
      number,
      title: `Mock ${number}`,
      count: await Question.countDocuments({ ...PLAYABLE, ...examFilter, ...mockFilter(number) })
    }))
  );
};

// selectedAnswers is a Mongoose Map on loaded documents; bracket access needs a plain object.
export const answersToRecord = (value: unknown): Record<string, number> => {
  const entries = value instanceof Map ? Array.from(value.entries()) : Object.entries((value as Record<string, unknown>) ?? {});
  return Object.fromEntries(entries.map(([key, answer]) => [key, Number(answer)]));
};

export const startPracticeAttempt = async ({
  userId,
  categories,
  kind,
  dayKey,
  questionCount,
  difficulty,
  pyq,
  mock,
  exam = 'adre'
}: {
  userId: string;
  categories?: string[];
  kind?: 'practice' | 'daily_free';
  dayKey?: string;
  questionCount: number;
  difficulty?: string;
  pyq?: { year: number; paperId: string };
  mock?: number;
  exam?: PracticeExam;
}) => {
  const match: Record<string, unknown> = { ...PLAYABLE, ...await practiceExamFilter(exam) };
  const pyqPaper = pyq ? findPyqPaper(pyq.paperId) : undefined;
  if (pyq && !pyqPaper) throw new Error('Unknown previous-year paper.');
  if (mock !== undefined && !isMockNumber(mock)) throw new Error('Unknown mock test.');
  if (exam === 'police-forest' && (pyq || kind === 'daily_free')) {
    throw new ApiError(400, 'Police and Forest Test Series support subject practice and Constable mocks only.');
  }

  if (pyq && pyqPaper) {
    Object.assign(match, pyqFilter(pyq.year, pyqPaper));
  } else if (mock !== undefined) {
    Object.assign(match, mockFilter(mock));
  } else {
    if (categories?.length) match.categories = { $in: categories };
    if (difficulty) match.difficulty = difficulty;
  }

  // Previous-year papers and mocks are taken whole in their original order; practice draws a random sample.
  const fullPaper = Boolean(pyq) || mock !== undefined;
  const questions = await Question.aggregate(
    fullPaper
      ? [{ $match: match }, { $sort: { questionId: 1, _id: 1 } }, { $limit: MAX_PAPER_QUESTIONS }]
      : [{ $match: match }, { $sample: { size: questionCount } }]
  );

  const selectedQuestionIds = questions.map((question) => question._id);
  const policeMock = exam === 'police-forest' && mock !== undefined;
  if (policeMock && questions.length !== POLICE_MOCK_QUESTIONS) {
    throw new ApiError(409, 'This Constable mock is not ready. Exactly 100 active questions are required.');
  }

  const attempt = await TestAttempt.create({
    userId,
    selectedQuestionIds,
    categories: categories ?? [],
    pack: kind === 'daily_free' ? null : pyq ? 'pyq' : practicePack(exam, mock !== undefined),
    exam,
    kind: kind ?? 'practice',
    dayKey: dayKey ?? null,
    ...(pyq ? { pyq: { year: pyq.year, paperId: pyq.paperId } } : {}),
    ...(mock !== undefined ? { mock } : {}),
    selectedAnswers: {},
    markedForReview: [],
    status: 'in_progress',
    startedAt: new Date(),
    totalSeconds: policeMock ? POLICE_MOCK_SECONDS : questions.length * (await getSettings()).secondsPerQuestion
  });

  return { attempt, questions };
};

export const patchAttemptAnswers = async (attemptId: string, userId: string, selectedAnswers: Record<string, number>, markedForReview: string[]) => {
  const attempt = await TestAttempt.findOne({ _id: attemptId, userId }).exec();

  if (!attempt) {
    throw new Error('Attempt not found');
  }

  attempt.selectedAnswers = selectedAnswers;
  attempt.markedForReview = markedForReview.map((id) => id as unknown as never);
  await attempt.save();

  return attempt;
};

export const submitAttempt = async (attemptId: string, userId: string) => {
  const attempt = await TestAttempt.findOne({ _id: attemptId, userId }).exec();
  if (!attempt) {
    throw new Error('Attempt not found');
  }

  if (attempt.status === 'submitted') {
    throw new Error('Attempt already submitted');
  }

  const questions = await Question.find({ _id: { $in: attempt.selectedQuestionIds } }).exec();
  const correctOptionMap: Record<string, number> = {};

  for (const question of questions) {
    if (typeof question.correctOption !== 'number') {
      continue;
    }

    correctOptionMap[String(question._id)] = question.correctOption;
  }

  const result = calculateAttemptScore(
    answersToRecord(attempt.selectedAnswers),
    correctOptionMap,
    questions.length,
    attempt.pack === 'police-mock' ? POLICE_MOCK_SCORING : undefined
  );

  attempt.status = 'submitted';
  attempt.submittedAt = new Date();
  attempt.score = result.score;
  attempt.correctCount = result.correctCount;
  attempt.incorrectCount = result.incorrectCount;
  attempt.unansweredCount = result.unansweredCount;
  attempt.percentage = result.percentage;
  await attempt.save();

  return { attempt, result, questions };
};
