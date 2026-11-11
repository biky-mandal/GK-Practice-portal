import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface IAccountDeletionChallenge extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  lastSentAt: Date;
}

const accountDeletionChallengeSchema = new Schema<IAccountDeletionChallenge>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    codeHash: { type: String, required: true, select: false },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true }
  },
  { timestamps: true }
);

accountDeletionChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AccountDeletionChallenge: Model<IAccountDeletionChallenge> =
  mongoose.models.AccountDeletionChallenge || model<IAccountDeletionChallenge>('AccountDeletionChallenge', accountDeletionChallengeSchema);
