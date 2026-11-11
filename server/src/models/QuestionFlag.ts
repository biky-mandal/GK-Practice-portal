import mongoose, { Schema, model, type Document, type Model, type Types } from 'mongoose';

export const FLAG_REASONS = ['wrong_answer', 'unclear_question', 'typo', 'translation', 'other'] as const;
export const FLAG_STATUSES = ['open', 'resolved', 'dismissed'] as const;

export type FlagReason = (typeof FLAG_REASONS)[number];
export type FlagStatus = (typeof FLAG_STATUSES)[number];

export interface IQuestionFlag extends Document {
  questionId: Types.ObjectId;
  userId: Types.ObjectId;
  attemptId?: Types.ObjectId;
  reason: FlagReason;
  note: string;
  status: FlagStatus;
  adminNote: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
}

const questionFlagSchema = new Schema<IQuestionFlag>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    attemptId: { type: Schema.Types.ObjectId, ref: 'TestAttempt' },
    reason: { type: String, enum: FLAG_REASONS, required: true },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: FLAG_STATUSES, default: 'open' },
    adminNote: { type: String, trim: true, maxlength: 500, default: '' },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date
  },
  { timestamps: true, collection: 'question_flags' }
);

questionFlagSchema.index({ status: 1, createdAt: -1 });
// A learner can have only one open flag per question and reason; resubmitting updates it.
questionFlagSchema.index(
  { questionId: 1, userId: 1, reason: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } }
);

export const QuestionFlag: Model<IQuestionFlag> =
  mongoose.models.QuestionFlag || model<IQuestionFlag>('QuestionFlag', questionFlagSchema);
