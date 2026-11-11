import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface IOtpRecord extends Document {
  phoneNumber: string;
  otpHash: string;
  attempts: number;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  lastSentAt?: Date;
}

const otpRecordSchema = new Schema<IOtpRecord>(
  {
    phoneNumber: {
      type: String,
      required: true,
      index: true
    },
    otpHash: {
      type: String,
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    expiresAt: {
      type: Date,
      required: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    ipAddress: {
      type: String
    },
    lastSentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

export const OtpRecord: Model<IOtpRecord> = mongoose.models.OtpRecord || model<IOtpRecord>('OtpRecord', otpRecordSchema);
