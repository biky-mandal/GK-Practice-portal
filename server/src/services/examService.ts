import { Question } from '../models/Question.js';
import { Exam } from '../models/Exam.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { calculateAttemptScore } from '../utils/scoring.js';
import { ApiError } from '../utils/ApiError.js';

export const createExamRecord = async (payload: Record<string, any>, createdBy?: string) => {
  if (!payload.title || !String(payload.title).trim()) {
    throw new ApiError(400, 'Exam title is required.');
  }

  const examId = String(payload.examId ?? `EXAM-${Date.now()}`);

  const exam = await Exam.create({
    examId,
    title: payload.title,
    description: payload.description,
    instructions: payload.instructions ?? [],
    eligibleCategories: payload.eligibleCategories ?? [],
    eligibleSubjects: payload.eligibleSubjects ?? [],
    questionIds: payload.questionIds ?? [],
    questionSelectionMode: payload.questionSelectionMode ?? 'fixed',
    questionSelectionConfig: payload.questionSelectionConfig ?? {
      count: payload.questionCount ?? 10
    },
    sections: payload.sections ?? [],
    totalDurationMinutes: Number(payload.totalDurationMinutes ?? 30),
    totalMarks: Number(payload.totalMarks ?? payload.questionCount ?? 10),
    questionCount: Number(payload.questionCount ?? (payload.questionIds?.length ?? 0)),
    marksForCorrect: Number(payload.marksForCorrect ?? 1),
    marksForIncorrect: Number(payload.marksForIncorrect ?? 0),
    marksForUnanswered: Number(payload.marksForUnanswered ?? 0),
    negativeMarking: Boolean(payload.negativeMarking),
    partialCredit: Boolean(payload.partialCredit),
    questionNavigationPolicy: payload.questionNavigationPolicy ?? 'sequential',
    randomization: payload.randomization ?? { questionOrder: false, optionOrder: false },
    resultVisibility: payload.resultVisibility ?? { showScore: true, showSolutions: true },
    availability: payload.availability ?? {},
    attemptLimits: payload.attemptLimits ?? {},
    published: Boolean(payload.published),
    createdBy: createdBy ?? 'system',
    updatedBy: createdBy ?? 'system'
  });

  return exam;
};

export const getPublicExams = async () => {
  const exams = await Exam.find({ published: true }).sort({ createdAt: -1 }).lean();
  return exams.map((exam) => ({
    examId: exam.examId,
    title: exam.title,
    description: exam.description,
    totalDurationMinutes: exam.totalDurationMinutes,
    totalMarks: exam.totalMarks,
    questionCount: exam.questionCount,
    published: exam.published
  }));
};

export const startExamAttempt = async ({ userId, examId }: { userId: string; examId: string }) => {
  const exam = await Exam.findOne({ examId }).exec();
  if (!exam) {
    throw new ApiError(404, 'Exam not found.');
  }

  if (!exam.published) {
    throw new ApiError(400, 'Exam is not published yet.');
  }

  let selectedQuestionIds: string[] = (exam.questionIds ?? []).map((id) => String(id));

  if (exam.questionSelectionMode === 'randomized') {
    const requiredCount = Number(exam.questionSelectionConfig?.count ?? exam.questionCount ?? 10);
    const pool = await Question.aggregate([
      {
        $match: {
          isActive: true,
          ...(exam.questionSelectionConfig?.category ? { category: exam.questionSelectionConfig.category } : {}),
          ...(exam.questionSelectionConfig?.subject ? { subject: exam.questionSelectionConfig.subject } : {})
        }
      },
      { $sample: { size: requiredCount } }
    ]);

    selectedQuestionIds = pool.map((question) => String(question._id));
  }

  if (!selectedQuestionIds.length) {
    throw new ApiError(400, 'This exam has no eligible questions yet.');
  }

  const deadline = new Date(Date.now() + exam.totalDurationMinutes * 60 * 1000);
  const attempt = await TestAttempt.create({
    userId,
    examId: exam._id,
    selectedQuestionIds: selectedQuestionIds.map((id) => id),
    selectedAnswers: {},
    markedForReview: [],
    status: 'in_progress',
    startedAt: new Date(),
    deadline,
    answers: []
  });

  const questions = await Question.find({ _id: { $in: selectedQuestionIds } }).sort({ createdAt: 1 }).exec();

  return { exam, attempt, questions };
};

export const updateAttemptAnswers = async ({ attemptId, userId, selectedAnswers, markedForReview }: {
  attemptId: string;
  userId: string;
  selectedAnswers: Record<string, unknown>;
  markedForReview: string[];
}) => {
  const attempt = await TestAttempt.findOne({ _id: attemptId, userId }).exec();
  if (!attempt) {
    throw new ApiError(404, 'Attempt not found.');
  }

  if (attempt.status !== 'in_progress') {
    throw new ApiError(400, 'This attempt cannot be modified anymore.');
  }

  const validQuestionIds = new Set(attempt.selectedQuestionIds.map((id) => String(id)));
  for (const questionId of Object.keys(selectedAnswers ?? {})) {
    if (!validQuestionIds.has(questionId)) {
      throw new ApiError(400, 'You can only update questions in this attempt.');
    }
  }

  const mergedAnswers = {
    ...(attempt.selectedAnswers && typeof attempt.selectedAnswers === 'object' ? attempt.selectedAnswers : {}),
    ...selectedAnswers
  } as Record<string, unknown>;

  attempt.selectedAnswers = mergedAnswers;
  attempt.markedForReview = markedForReview.map((id) => id as any);
  attempt.updatedAt = new Date();
  await attempt.save();

  return attempt;
};

export const submitExamAttempt = async ({ attemptId, userId }: { attemptId: string; userId: string }) => {
  const attempt = await TestAttempt.findOne({ _id: attemptId, userId }).exec();
  if (!attempt) {
    throw new ApiError(404, 'Attempt not found.');
  }

  if (attempt.status === 'submitted' || attempt.status === 'expired') {
    throw new ApiError(400, 'This attempt has already been finalized.');
  }

  const questions = await Question.find({ _id: { $in: attempt.selectedQuestionIds } }).exec();
  const selectedAnswers = (attempt.selectedAnswers && typeof attempt.selectedAnswers === 'object') ? Object.fromEntries(
    Object.entries(attempt.selectedAnswers as Record<string, unknown>).map(([key, value]) => [key, value])
  ) : {};

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let rawScore = 0;

  for (const question of questions) {
    const questionId = String(question._id);
    const answerValue = selectedAnswers[questionId];
    const correctSet = new Set((question.answerKey?.correctOptionIds ?? []).map((id) => String(id)));
    const correctNumeric = typeof question.correctOption === 'number' ? question.correctOption : undefined;

    if (answerValue === undefined || answerValue === null || answerValue === '') {
      unansweredCount += 1;
      continue;
    }

    if (correctNumeric !== undefined && Number(answerValue) === correctNumeric) {
      correctCount += 1;
      rawScore += Number(question.evaluation?.marks ?? 1);
      continue;
    }

    if (Array.isArray(answerValue)) {
      const selectedSet = new Set(answerValue.map((item) => String(item)));
      const isCorrect = correctSet.size === selectedSet.size && Array.from(correctSet).every((item) => selectedSet.has(item));
      if (isCorrect) {
        correctCount += 1;
        rawScore += Number(question.evaluation?.marks ?? 1);
      } else {
        incorrectCount += 1;
        rawScore += Number(question.evaluation?.negativeMarks ?? 0);
      }
      continue;
    }

    if (typeof answerValue === 'string') {
      const accepted = (question.answerKey?.acceptedAnswers ?? []).map((entry) => String(entry).trim().toLowerCase());
      if (accepted.includes(answerValue.trim().toLowerCase())) {
        correctCount += 1;
        rawScore += Number(question.evaluation?.marks ?? 1);
      } else {
        incorrectCount += 1;
        rawScore += Number(question.evaluation?.negativeMarks ?? 0);
      }
      continue;
    }

    if (correctSet.size > 0) {
      const selected = Array.isArray(answerValue) ? answerValue : [answerValue];
      const selectedSet = new Set(selected.map((item) => String(item)));
      const isCorrect = correctSet.size === selectedSet.size && Array.from(correctSet).every((item) => selectedSet.has(item));
      if (isCorrect) {
        correctCount += 1;
        rawScore += Number(question.evaluation?.marks ?? 1);
      } else {
        incorrectCount += 1;
        rawScore += Number(question.evaluation?.negativeMarks ?? 0);
      }
    } else {
      unansweredCount += 1;
    }
  }

  const result = calculateAttemptScore(
    Object.fromEntries(Object.entries(selectedAnswers).map(([key, value]) => [key, Number(value) ?? value as any])),
    Object.fromEntries(questions.map((question) => [String(question._id), Number(question.correctOption ?? 0)])),
    questions.length
  );

  attempt.status = 'submitted';
  attempt.submittedAt = new Date();
  attempt.score = rawScore;
  attempt.correctCount = correctCount;
  attempt.incorrectCount = incorrectCount;
  attempt.unansweredCount = unansweredCount;
  attempt.percentage = Number(((rawScore / Math.max(questions.length, 1)) * 100).toFixed(2));
  attempt.result = {
    attemptId: String(attempt._id),
    userId: String(userId),
    score: rawScore,
    maxMarks: questions.length,
    percentage: attempt.percentage,
    correctCount,
    incorrectCount,
    unansweredCount,
    accuracy: Number(((correctCount / Math.max(correctCount + incorrectCount, 1)) * 100).toFixed(2)),
    questionsReviewed: attempt.markedForReview.length,
    submittedAt: attempt.submittedAt
  };
  await attempt.save();

  return { attempt, result, questions };
};

export const getAttemptResult = async ({ attemptId, userId }: { attemptId: string; userId: string }) => {
  const attempt = await TestAttempt.findOne({ _id: attemptId, userId }).exec();
  if (!attempt) {
    throw new ApiError(404, 'Attempt not found.');
  }

  if (attempt.status !== 'submitted') {
    throw new ApiError(400, 'Attempt has not been submitted yet.');
  }

  return attempt.result ?? {
    attemptId: String(attempt._id),
    userId: String(userId),
    score: attempt.score ?? 0,
    maxMarks: attempt.selectedQuestionIds.length,
    percentage: attempt.percentage ?? 0,
    correctCount: attempt.correctCount ?? 0,
    incorrectCount: attempt.incorrectCount ?? 0,
    unansweredCount: attempt.unansweredCount ?? 0,
    accuracy: 0,
    questionsReviewed: attempt.markedForReview.length,
    submittedAt: attempt.submittedAt ?? attempt.startedAt
  };
};
