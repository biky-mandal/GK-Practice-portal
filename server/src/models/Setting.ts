import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface ISetting extends Document {
  key: string;
  dailyFreeQuestionCount: number;
  secondsPerQuestion: number;
  freeSubjectCategory: string;
}

const settingSchema = new Schema<ISetting>(
  {
    key: { type: String, required: true, unique: true, default: 'app' },
    dailyFreeQuestionCount: { type: Number, default: 10, min: 1, max: 50 },
    secondsPerQuestion: { type: Number, default: 60, min: 10, max: 600 },
    freeSubjectCategory: { type: String, default: 'Assam Polity', trim: true, maxlength: 100 }
  },
  { timestamps: true }
);

export const Setting: Model<ISetting> = mongoose.models.Setting || model<ISetting>('Setting', settingSchema);
