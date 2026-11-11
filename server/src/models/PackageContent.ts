import mongoose, { Schema, model, type Model } from 'mongoose';

export interface IPackageContent {
  id: string;
  name: string;
  description: string;
  group: 'adre' | 'police-forest';
  access: string[];
  archived: boolean;
  sortOrder: number;
}

const schema = new Schema<IPackageContent>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  group: { type: String, required: true, enum: ['adre', 'police-forest'] },
  access: { type: [String], required: true },
  archived: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, collection: 'package_content' });

export const PackageContent: Model<IPackageContent> = mongoose.models.PackageContent || model<IPackageContent>('PackageContent', schema);
