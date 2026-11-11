import mongoose, { Schema, model } from 'mongoose';
import type { VerificationInput, VerificationResult } from '../services/questionVerificationService.js';

interface IQuestionVerification {
  questionId: mongoose.Types.ObjectId;
  checkedBy: mongoose.Types.ObjectId;
  input: VerificationInput;
  result: VerificationResult;
}

const inputSchema = new Schema<VerificationInput>({
  language: { type: String, enum: ['en', 'as'], required: true },
  questionText: { type: String, required: true },
  options: { type: [String], required: true },
  correctOption: { type: Number, required: true },
  asOfDate: { type: String, default: '' }
}, { _id: false });

const resultSchema = new Schema<VerificationResult>({
  verdict: { type: String, enum: ['supported', 'likely_incorrect', 'inconclusive'], required: true },
  suggestedOption: { type: Number, default: null },
  explanation: { type: String, required: true },
  sources: {
    type: [new Schema({ title: String, url: String, evidence: String }, { _id: false })],
    default: []
  },
  checkedAt: { type: String, required: true },
  model: { type: String, required: true }
}, { _id: false });

const schema = new Schema<IQuestionVerification>({
  questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, unique: true },
  checkedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  input: { type: inputSchema, required: true },
  result: { type: resultSchema, required: true }
}, { timestamps: true });

export const QuestionVerification = mongoose.models.QuestionVerification as mongoose.Model<IQuestionVerification> | undefined
  ?? model<IQuestionVerification>('QuestionVerification', schema);
