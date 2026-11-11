import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface IAdminChatMessage extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  text: string;
  createdAt: Date;
}

const adminChatMessageSchema = new Schema<IAdminChatMessage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: 'Admin' },
    text: { type: String, required: true, maxlength: 1000 }
  },
  { timestamps: true }
);
adminChatMessageSchema.index({ createdAt: -1 });

export const AdminChatMessage: Model<IAdminChatMessage> =
  mongoose.models.AdminChatMessage || model<IAdminChatMessage>('AdminChatMessage', adminChatMessageSchema);
