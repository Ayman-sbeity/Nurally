import { Schema, model, type HydratedDocument } from 'mongoose';
import { ServiceCategorySlug } from '../types/domain';
import { omitInternal } from './serialization';

/**
 * Gallery entries are admin-managed so real Nurella photography can replace the
 * initial placeholders without a code change.
 *
 * `beforeImageUrl` is optional and purely structural — nothing in the system
 * claims a result on the lounge's behalf; captions are written by the admin.
 */
export interface GalleryImageAttrs {
  title: string;
  caption?: string;
  imageUrl: string;
  beforeImageUrl?: string;
  category?: ServiceCategorySlug;
  altText: string;
  isActive: boolean;
  displayOrder: number;
}

export type GalleryImageDocument = HydratedDocument<GalleryImageAttrs>;

const galleryImageSchema = new Schema<GalleryImageAttrs>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    caption: { type: String, trim: true, maxlength: 400 },
    imageUrl: { type: String, required: true, trim: true },
    beforeImageUrl: { type: String, trim: true },
    category: { type: String, enum: Object.values(ServiceCategorySlug) },
    altText: { type: String, required: true, trim: true, maxlength: 240 },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => omitInternal(ret),
    },
  },
);

galleryImageSchema.index({ isActive: 1, displayOrder: 1 });

export const GalleryImage = model<GalleryImageAttrs>('GalleryImage', galleryImageSchema);
