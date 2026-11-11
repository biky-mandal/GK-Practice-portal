import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

interface IQuestionExam extends Document {
  name: string;
  aliases: string[];
  order: number;
  isDeleted: boolean;
}

const questionExamSchema = new Schema<IQuestionExam>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  aliases: { type: [String], default: [] },
  order: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

questionExamSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const QuestionExam: Model<IQuestionExam> =
  mongoose.models.QuestionExam || model<IQuestionExam>('QuestionExam', questionExamSchema);
