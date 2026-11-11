import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface IPasswordReset extends Document {
  email: string;
  otpHash: string;
  attempts: number;
  expiresAt: Date;
  lastSentAt: Date;
}

const passwordResetSchema = new Schema<IPasswordReset>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  // The TTL index removes expired codes automatically.
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  lastSentAt: { type: Date, default: Date.now }
});

export const PasswordReset: Model<IPasswordReset> =
  mongoose.models.PasswordReset || model<IPasswordReset>('PasswordReset', passwordResetSchema);
