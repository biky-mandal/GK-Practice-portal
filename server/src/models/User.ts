import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface Purchase {
  pack: string;
  amount: number;
  purchasedAt: Date;
  paymentId?: string;
  access?: string[];
}

export interface IUser extends Document {
  email?: string;
  name?: string;
  passwordHash?: string;
  tokenVersion: number;
  failedLoginCount: number;
  lockUntil?: Date | null;
  phoneNumber?: string;
  role: 'user' | 'admin' | 'superadmin';
  purchases: Purchase[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80
    },
    // Never returned by default; select it explicitly when verifying a login.
    passwordHash: {
      type: String,
      select: false
    },
    // Bumping this invalidates every access token issued before.
    tokenVersion: {
      type: Number,
      default: 0
    },
    failedLoginCount: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    },
    phoneNumber: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user'
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    purchases: {
      type: [
        new Schema<Purchase>(
          {
            pack: { type: String, required: true },
            amount: { type: Number, required: true },
            purchasedAt: { type: Date, default: Date.now },
            paymentId: { type: String },
            access: { type: [String], default: undefined }
          },
          { _id: false }
        )
      ],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Partial indexes let accounts exist with only an email or only a phone number.
userSchema.index({ email: 1 }, { name: 'email_unique', unique: true, partialFilterExpression: { email: { $type: 'string' } } });
userSchema.index({ phoneNumber: 1 }, { name: 'phone_unique', unique: true, partialFilterExpression: { phoneNumber: { $type: 'string' } } });

export const User: Model<IUser> = mongoose.models.User || model<IUser>('User', userSchema);
