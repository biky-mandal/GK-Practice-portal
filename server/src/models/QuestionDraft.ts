import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

// Staging area for uploaded questions that are not yet in the main question set.
export interface IQuestionDraft extends Document {
  record: Record<string, any>;
  setTitle: string;
  fileName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const questionDraftSchema = new Schema<IQuestionDraft>(
  {
    record: { type: Schema.Types.Mixed, required: true },
    setTitle: { type: String, default: 'Untitled set', index: true },
    fileName: { type: String, default: '' },
    createdBy: { type: String, default: '' }
  },
  { timestamps: true, minimize: false }
);

export const QuestionDraft: Model<IQuestionDraft> =
  mongoose.models.QuestionDraft || model<IQuestionDraft>('QuestionDraft', questionDraftSchema);
