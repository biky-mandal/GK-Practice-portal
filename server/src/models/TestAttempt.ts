import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface AttemptAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  responseText?: string;
  numericAnswer?: number;
  status?: 'answered' | 'unanswered' | 'marked_for_review';
  updatedAt?: Date;
}

export interface TestResult {
  attemptId: string;
  userId: string;
  score?: number;
  maxMarks?: number;
  percentage?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  accuracy?: number;
  questionsReviewed?: number;
  submittedAt?: Date;
}

export interface ITestAttempt extends Document {
  userId: mongoose.Types.ObjectId;
  examId?: mongoose.Types.ObjectId;
  selectedQuestionIds: mongoose.Types.ObjectId[];
  selectedAnswers: Record<string, unknown>;
  markedForReview: mongoose.Types.ObjectId[];
  status: 'in_progress' | 'submitted' | 'expired';
  startedAt: Date;
  deadline?: Date;
  categories?: string[];
  exam?: string | null;
  language?: string | null;
  kind?: 'practice' | 'daily_free';
  dayKey?: string | null;
  pyq?: { year?: number; paperId?: string };
  mock?: number | null;
  pack?: string | null;
  totalSeconds: number;
  elapsedSeconds: number;
  lastResumedAt?: Date | null;
  lastActiveAt?: Date | null;
  submittedAt?: Date;
  score?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  percentage?: number;
  answers?: AttemptAnswer[];
  result?: TestResult;
  createdAt: Date;
  updatedAt: Date;
}

const attemptAnswerSchema = new Schema<AttemptAnswer>(
  {
    questionId: { type: String, required: true },
    selectedOptionIds: [String],
    responseText: String,
    numericAnswer: Number,
    status: {
      type: String,
      enum: ['answered', 'unanswered', 'marked_for_review'],
      default: 'unanswered'
    },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const testAttemptSchema = new Schema<ITestAttempt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
      default: null
    },
    selectedQuestionIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Question'
    }],
    selectedAnswers: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {}
    },
    answers: [attemptAnswerSchema],
    markedForReview: [{
      type: Schema.Types.ObjectId,
      ref: 'Question'
    }],
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'expired'],
      default: 'in_progress'
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    deadline: Date,
    categories: { type: [String], default: [] },
    exam: { type: String, default: null },
    language: { type: String, default: null },
    kind: { type: String, enum: ['practice', 'daily_free'], default: 'practice' },
    dayKey: { type: String, default: null },
    pyq: { year: Number, paperId: String },
    mock: { type: Number, default: null },
    pack: { type: String, default: null },
    totalSeconds: { type: Number, default: 0 },
    elapsedSeconds: { type: Number, default: 0 },
    lastResumedAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: null },
    submittedAt: Date,
    score: Number,
    correctCount: Number,
    incorrectCount: Number,
    unansweredCount: Number,
    percentage: Number,
    result: {
      attemptId: String,
      userId: String,
      score: Number,
      maxMarks: Number,
      percentage: Number,
      correctCount: Number,
      incorrectCount: Number,
      unansweredCount: Number,
      accuracy: Number,
      questionsReviewed: Number,
      submittedAt: Date
    }
  },
  {
    timestamps: true
  }
);

testAttemptSchema.index({ userId: 1, status: 1, startedAt: -1 });
// One free daily test per user per day, enforced by the database.
testAttemptSchema.index({ userId: 1, dayKey: 1 }, { unique: true, partialFilterExpression: { kind: 'daily_free' } });
testAttemptSchema.index({ examId: 1, userId: 1, status: 1 });

export const TestAttempt: Model<ITestAttempt> = mongoose.models.TestAttempt || model<ITestAttempt>('TestAttempt', testAttemptSchema);
