import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdByIp?: string;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    // All tokens descended from one login share a family so a replayed token can revoke the lot.
    familyId: {
      type: String,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    revoked: {
      type: Boolean,
      default: false
    },
    createdByIp: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<IRefreshToken> = mongoose.models.RefreshToken || model<IRefreshToken>('RefreshToken', refreshTokenSchema);
