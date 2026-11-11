import mongoose, { Schema, model, type Document, type Model } from 'mongoose';
import { referenceImageSchema } from './referenceImage.js';
import {
  AnswerMode,
  EvaluationMethod,
  LifecycleStatus,
  QuestionAnswerKey,
  QuestionClassification,
  QuestionDifficulty,
  QuestionEvaluation,
  QuestionExplanation,
  QuestionFormat,
  QuestionLearning,
  QuestionMedia,
  QuestionOption,
  QuestionPassage,
  QuestionReference,
  QuestionReport,
  QuestionRevision,
  QuestionReview,
  QuestionStatement,
  QuestionTranslation,
  QuestionType,
  ReviewStatus
} from './questionDomain.js';

export interface IQuestion extends Document {
  questionId?: string;
  languages?: string[];
  localized?: Record<string, unknown>;
  questionText: string;
  referenceImage?: string | null;
  options: string[];
  correctOption?: number;
  explanation?: string;
  category?: string;
  difficulty?: QuestionDifficulty | 'Easy' | 'Medium' | 'Hard';
  subject?: string;
  topic?: string;
  tags?: string[];
  categories?: string[];
  exams?: string[];
  isActive?: boolean;
  content?: {
    statement?: string;
    passage?: QuestionPassage;
    options?: QuestionOption[];
    statements?: QuestionStatement[];
    media?: QuestionMedia[];
    translations?: QuestionTranslation[];
  };
  answerKey?: QuestionAnswerKey;
  classification?: QuestionClassification;
  questionFormat?: QuestionFormat;
  evaluation?: QuestionEvaluation;
  learning?: QuestionLearning;
  references?: QuestionReference[];
  analytics?: {
    views?: number;
    attempts?: number;
    correctRate?: number;
  };
  workflow?: {
    status?: LifecycleStatus;
    reviewStatus?: ReviewStatus;
    createdBy?: string;
    updatedBy?: string;
    publishedAt?: Date;
    archivedAt?: Date;
    revisionHistory?: QuestionRevision[];
  };
  reports?: QuestionReport[];
  review?: QuestionReview;
  customMetadata?: Map<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const questionOptionSchema = new Schema<QuestionOption>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    label: String,
    isCorrect: { type: Boolean, default: false },
    explanation: String,
    order: Number
  },
  { _id: false }
);

const questionAnswerKeySchema = new Schema<QuestionAnswerKey>(
  {
    correctOptionIds: [String],
    correctStatementIds: [String],
    acceptedAnswers: [String],
    expectedOrder: [String],
    matchPairs: { type: Map, of: String, default: {} },
    numericalTolerance: {
      min: Number,
      max: Number,
      absolute: Number,
      relative: Number,
      precision: Number
    },
    textNormalization: {
      trim: Boolean,
      caseSensitive: Boolean,
      removePunctuation: Boolean
    },
    modelAnswer: String,
    evaluationRubric: [String]
  },
  { _id: false }
);

const questionMediaSchema = new Schema<QuestionMedia>(
  {
    id: String,
    type: String,
    url: String,
    altText: String,
    caption: String,
    attribution: String,
    thumbnailUrl: String
  },
  { _id: false }
);

const questionStatementSchema = new Schema<QuestionStatement>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    label: String
  },
  { _id: false }
);

const questionPassageSchema = new Schema<QuestionPassage>(
  {
    id: String,
    title: String,
    text: { type: String, trim: true },
    source: String,
    language: String
  },
  { _id: false }
);

const questionReferenceSchema = new Schema<QuestionReference>(
  {
    id: String,
    title: String,
    source: String,
    url: String,
    publisher: String,
    note: String
  },
  { _id: false }
);

const questionTranslationSchema = new Schema<QuestionTranslation>(
  {
    locale: { type: String, required: true },
    statement: String,
    explanation: String,
    options: { type: Map, of: String, default: {} },
    note: String
  },
  { _id: false }
);

const questionSchema = new Schema<IQuestion>(
  {
    questionId: {
      type: String,
      trim: true
    },
    languages: {
      type: [String],
      default: ['en'],
      index: true
    },
    localized: {
      type: Schema.Types.Mixed,
      default: {}
    },
    questionText: {
      type: String,
      trim: true
    },
    referenceImage: {
      type: String,
      default: null,
      validate: {
        validator: (value: unknown) => referenceImageSchema.safeParse(value).success,
        message: 'Reference image must be a PNG, JPEG or WebP image up to 512 KB.'
      }
    },
    options: {
      type: [String],
      default: []
    },
    correctOption: {
      type: Number,
      min: 0
    },
    explanation: {
      type: String,
      default: ''
    },
    category: {
      type: String,
      default: 'General Knowledge'
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Easy'
    },
    subject: {
      type: String,
      default: 'General Knowledge'
    },
    topic: {
      type: String,
      default: 'General Studies'
    },
    tags: {
      type: [String],
      default: []
    },
    categories: {
      type: [String],
      default: [],
      index: true
    },
    exams: {
      type: [String],
      default: [],
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    content: {
      statement: String,
      passage: questionPassageSchema,
      options: [questionOptionSchema],
      statements: [questionStatementSchema],
      media: [questionMediaSchema],
      translations: [questionTranslationSchema]
    },
    answerKey: questionAnswerKeySchema,
    classification: {
      subject: String,
      category: String,
      topic: String,
      subTopic: String,
      tags: [String],
      exam: [String],
      difficulty: {
        type: String,
        enum: Object.values(QuestionDifficulty)
      },
      level: String
    },
    questionFormat: {
      type: {
        type: String,
        enum: Object.values(QuestionType),
        default: QuestionType.SINGLE_CORRECT
      },
      answerMode: {
        type: String,
        enum: Object.values(AnswerMode),
        default: AnswerMode.SINGLE_SELECT
      },
      hasPassage: Boolean,
      hasImage: Boolean,
      isDescriptive: Boolean
    },
    evaluation: {
      method: {
        type: String,
        enum: Object.values(EvaluationMethod),
        default: EvaluationMethod.AUTOMATIC
      },
      marks: { type: Number, default: 1 },
      negativeMarks: { type: Number, default: 0 },
      partialCredit: {
        enabled: Boolean,
        strategy: {
          type: String,
          enum: ['all_or_nothing', 'proportional', 'custom']
        },
        customThreshold: Number
      },
      autoGraded: { type: Boolean, default: true },
      manualReviewRequired: Boolean
    },
    learning: {
      learningObjective: String,
      conceptTag: [String],
      keyIdea: [String],
      hint: String
    },
    references: [questionReferenceSchema],
    analytics: {
      views: { type: Number, default: 0 },
      attempts: { type: Number, default: 0 },
      correctRate: Number
    },
    workflow: {
      status: {
        type: String,
        enum: Object.values(LifecycleStatus),
        default: LifecycleStatus.PUBLISHED
      },
      reviewStatus: {
        type: String,
        enum: Object.values(ReviewStatus),
        default: ReviewStatus.PENDING
      },
      createdBy: String,
      updatedBy: String,
      publishedAt: Date,
      archivedAt: Date,
      revisionHistory: [
        {
          revisionId: String,
          previousRevisionId: String,
          updatedBy: String,
          updatedAt: Date,
          summary: String,
          changes: [String]
        }
      ]
    },
    reports: [
      {
        id: String,
        reportedBy: String,
        reason: String,
        details: String,
        createdAt: Date,
        status: {
          type: String,
          enum: ['open', 'resolved', 'dismissed'],
          default: 'open'
        }
      }
    ],
    review: {
      reviewerId: String,
      reviewedAt: Date,
      status: {
        type: String,
        enum: Object.values(ReviewStatus),
        default: ReviewStatus.PENDING
      },
      notes: String
    },
    customMetadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'questions'
  }
);

// Each question is one record holding every language it is available in.
questionSchema.index(
  { questionId: 1 },
  { unique: true, partialFilterExpression: { questionId: { $type: 'string' } } }
);
questionSchema.index({ 'classification.subject': 1, 'classification.topic': 1 });
questionSchema.index({ 'questionFormat.type': 1, 'workflow.status': 1 });
questionSchema.index({ 'classification.tags': 1 });

export const Question: Model<IQuestion> = mongoose.models.Question || model<IQuestion>('Question', questionSchema);
