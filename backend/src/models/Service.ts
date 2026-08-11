import { Schema, model, type HydratedDocument } from 'mongoose';
import { ServiceCategorySlug } from '../types/domain';
import { omitInternal } from './serialization';

export interface ServiceAttrs {
  name: string;
  slug: string;
  category: ServiceCategorySlug;
  description?: string;
  durationMinutes: number;
  /**
   * Optional. Nurella has not supplied pricing, so this stays unset and the UI
   * simply omits the price rather than inventing one.
   */
  price?: number;
  currency?: string;
  imageUrl?: string;
  /**
   * Weekdays this treatment can be booked on (0 = Sunday … 6 = Saturday).
   *
   * Empty means "any day the lounge is open", which is the case for almost
   * everything. It exists for treatments performed by a visiting practitioner
   * — the permanent-makeup and piercing work only happens on Wednesdays — so
   * the booking engine stops offering days nobody can actually work.
   */
  availableWeekdays: number[];
  isActive: boolean;
  displayOrder: number;
}

export type ServiceDocument = HydratedDocument<ServiceAttrs>;

const serviceSchema = new Schema<ServiceAttrs>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    category: {
      type: String,
      enum: Object.values(ServiceCategorySlug),
      required: true,
      index: true,
    },
    description: { type: String, trim: true, maxlength: 1200 },
    durationMinutes: { type: Number, required: true, min: 5, max: 600 },
    price: { type: Number, min: 0 },
    currency: { type: String, trim: true, maxlength: 8 },
    imageUrl: { type: String, trim: true },
    availableWeekdays: {
      type: [{ type: Number, min: 0, max: 6 }],
      default: [],
      validate: {
        validator: (days: number[]) => new Set(days).size === days.length,
        message: 'Available weekdays must not repeat.',
      },
    },
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

// Public catalogue query: active services grouped by category, in display order.
serviceSchema.index({ isActive: 1, category: 1, displayOrder: 1 });

export const Service = model<ServiceAttrs>('Service', serviceSchema);
