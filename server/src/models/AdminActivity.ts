import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface IAdminActivity extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  day: string;
  seconds: number;
}

const adminActivitySchema = new Schema<IAdminActivity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: 'Admin' },
    day: { type: String, required: true },
    seconds: { type: Number, default: 0 }
  },
  { timestamps: true }
);
adminActivitySchema.index({ userId: 1, day: 1 }, { unique: true });

export const AdminActivity: Model<IAdminActivity> =
  mongoose.models.AdminActivity || model<IAdminActivity>('AdminActivity', adminActivitySchema);
