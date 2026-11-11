import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  pack?: string;
  access?: string[];
  amountPaise: number;
  currency: string;
  orderId: string;
  paymentId?: string;
  status: 'created' | 'paid';
  paidAt?: Date;
  createdAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pack: { type: String },
    access: { type: [String], default: undefined },
    amountPaise: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String },
    status: { type: String, enum: ['created', 'paid'], default: 'created' },
    paidAt: { type: Date }
  },
  { timestamps: true }
);

export const Payment: Model<IPayment> = mongoose.models.Payment || model<IPayment>('Payment', paymentSchema);
