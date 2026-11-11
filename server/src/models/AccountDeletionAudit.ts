import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface IAccountDeletionAudit extends Document {
  accountHash: string;
  method: 'email_verification' | 'authenticated_password' | 'administrator';
  createdAt: Date;
}

const accountDeletionAuditSchema = new Schema<IAccountDeletionAudit>(
  {
    accountHash: { type: String, required: true },
    method: { type: String, enum: ['email_verification', 'authenticated_password', 'administrator'], required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

accountDeletionAuditSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

export const AccountDeletionAudit: Model<IAccountDeletionAudit> =
  mongoose.models.AccountDeletionAudit || model<IAccountDeletionAudit>('AccountDeletionAudit', accountDeletionAuditSchema);
