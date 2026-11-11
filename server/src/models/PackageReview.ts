import mongoose, { Schema, model, type Document, type Model, type Types } from 'mongoose';

export interface IPackageReview extends Document {
  userId: Types.ObjectId;
  pack: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const packageReviewSchema = new Schema<IPackageReview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pack: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 500, default: '' }
  },
  { timestamps: true, collection: 'package_reviews' }
);

// One review per buyer per package; editing replaces it.
packageReviewSchema.index({ userId: 1, pack: 1 }, { unique: true });
packageReviewSchema.index({ pack: 1, createdAt: -1 });

export const PackageReview: Model<IPackageReview> =
  mongoose.models.PackageReview || model<IPackageReview>('PackageReview', packageReviewSchema);
