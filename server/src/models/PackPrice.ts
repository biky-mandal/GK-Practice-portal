import mongoose, { Schema, model, type Document, type Model } from 'mongoose';

export interface IPackPrice extends Document {
  pack: string;
  price: number;
  originalPrice?: number | null;
  enabled: boolean;
  name?: string;
  description?: string;
  perks?: string[];
  group?: 'adre' | 'police-forest';
  access?: string[];
  contentOptions?: string[];
  visible: boolean;
  archived: boolean;
  highlight: boolean;
  sortOrder: number;
  updatedAt: Date;
}

const packPriceSchema = new Schema<IPackPrice>(
  {
    pack: { type: String, required: true, unique: true },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0, default: null },
    enabled: { type: Boolean, default: true },
    name: { type: String, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000 },
    perks: { type: [String], default: undefined },
    group: { type: String, enum: ['adre', 'police-forest'] },
    access: { type: [String], default: undefined },
    contentOptions: { type: [String], default: undefined },
    visible: { type: Boolean, default: true },
    archived: { type: Boolean, default: false },
    highlight: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true, collection: 'pack_prices' }
);

export const PackPrice: Model<IPackPrice> = mongoose.models.PackPrice || model<IPackPrice>('PackPrice', packPriceSchema);
