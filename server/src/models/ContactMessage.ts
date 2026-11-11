import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface IContactMessage extends Document {
  name: string;
  email: string;
  message: string;
  read: boolean;
  emailed: boolean;
  createdAt: Date;
}

const contactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
    emailed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

contactMessageSchema.index({ createdAt: -1 });

export const ContactMessage: Model<IContactMessage> =
  mongoose.models.ContactMessage || model<IContactMessage>('ContactMessage', contactMessageSchema);
