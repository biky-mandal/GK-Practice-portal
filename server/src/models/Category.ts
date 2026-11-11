import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  order: number;
  simulationUsedQuestionIds: mongoose.Types.ObjectId[];
  simulationRevision: number;
  shortsSimulationUsedQuestionIds: mongoose.Types.ObjectId[];
  shortsSimulationRevision: number;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    order: { type: Number, default: 0 },
    simulationUsedQuestionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    simulationRevision: { type: Number, default: 0 },
    shortsSimulationUsedQuestionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    shortsSimulationRevision: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Category: Model<ICategory> = mongoose.models.Category || model<ICategory>('Category', categorySchema);
