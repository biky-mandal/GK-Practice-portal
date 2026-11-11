import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export type ExamSelectionMode = 'fixed' | 'randomized';

export interface ExamSectionDoc {
  id: string;
  title?: string;
  description?: string;
  questionIds?: mongoose.Types.ObjectId[];
  durationMinutes?: number;
  marks?: number;
}

export interface IExam extends Document {
  examId: string;
  title: string;
  description?: string;
  instructions?: string[];
  eligibleCategories?: string[];
  eligibleSubjects?: string[];
  questionIds?: mongoose.Types.ObjectId[];
  questionSelectionMode: ExamSelectionMode;
  questionSelectionConfig?: {
    category?: string;
    subject?: string;
    difficulty?: string[];
    tags?: string[];
    count?: number;
  };
  sections?: ExamSectionDoc[];
  totalDurationMinutes: number;
  totalMarks: number;
  questionCount: number;
  marksForCorrect: number;
  marksForIncorrect: number;
  marksForUnanswered: number;
  negativeMarking: boolean;
  partialCredit: boolean;
  questionNavigationPolicy?: string;
  randomization?: {
    questionOrder?: boolean;
    optionOrder?: boolean;
    sectionOrder?: boolean;
  };
  resultVisibility?: {
    showScore?: boolean;
    showSolutions?: boolean;
    revealAt?: Date;
  };
  availability?: {
    startAt?: Date;
    endAt?: Date;
  };
  attemptLimits?: {
    total?: number;
    perUser?: number;
  };
  published: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const examSectionSchema = new Schema<ExamSectionDoc>(
  {
    id: { type: String, required: true },
    title: String,
    description: String,
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    durationMinutes: Number,
    marks: Number
  },
  { _id: false }
);

const examSchema = new Schema<IExam>(
  {
    examId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    instructions: [String],
    eligibleCategories: [String],
    eligibleSubjects: [String],
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    questionSelectionMode: {
      type: String,
      enum: ['fixed', 'randomized'],
      default: 'fixed'
    },
    questionSelectionConfig: {
      category: String,
      subject: String,
      difficulty: [String],
      tags: [String],
      count: Number
    },
    sections: [examSectionSchema],
    totalDurationMinutes: {
      type: Number,
      required: true,
      min: 1
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 1
    },
    questionCount: {
      type: Number,
      default: 0,
      min: 0
    },
    marksForCorrect: {
      type: Number,
      default: 1
    },
    marksForIncorrect: {
      type: Number,
      default: 0
    },
    marksForUnanswered: {
      type: Number,
      default: 0
    },
    negativeMarking: {
      type: Boolean,
      default: false
    },
    partialCredit: {
      type: Boolean,
      default: false
    },
    questionNavigationPolicy: String,
    randomization: {
      questionOrder: { type: Boolean, default: false },
      optionOrder: { type: Boolean, default: false },
      sectionOrder: { type: Boolean, default: false }
    },
    resultVisibility: {
      showScore: { type: Boolean, default: true },
      showSolutions: { type: Boolean, default: true },
      revealAt: Date
    },
    availability: {
      startAt: Date,
      endAt: Date
    },
    attemptLimits: {
      total: Number,
      perUser: Number
    },
    published: {
      type: Boolean,
      default: false
    },
    createdBy: String,
    updatedBy: String
  },
  {
    timestamps: true,
    collection: 'exams'
  }
);

examSchema.index({ published: 1, 'availability.startAt': 1, 'availability.endAt': 1 });
examSchema.index({ eligibleCategories: 1 });
examSchema.index({ eligibleSubjects: 1 });

export const Exam: Model<IExam> = mongoose.models.Exam || model<IExam>('Exam', examSchema);
