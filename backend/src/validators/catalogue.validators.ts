import { z } from 'zod';
import { ServiceCategorySlug } from '../types/domain';
import { objectIdSchema } from './appointment.validators';
import { optionalEmail, phone } from './common';

const categorySchema = z.enum(
  Object.values(ServiceCategorySlug) as [ServiceCategorySlug, ...ServiceCategorySlug[]],
);

/**
 * An image reference is either one of our own paths (`/images/...`, or an
 * `/api/media/...` upload) or an absolute http(s) URL. Restricting the scheme
 * keeps `javascript:` and `data:` values out of the `src` attributes these end
 * up in, whatever renders them later.
 *
 * An empty string is allowed and means "clear it" — the controllers unset the
 * field rather than storing a blank.
 */
const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || /^(https?:\/\/|\/(?!\/))/.test(value), {
    message: 'Enter an https:// address or a path beginning with /.',
  });

export const createServiceSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: categorySchema,
  description: z.string().trim().max(1200).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  // Optional by design — Nurella has not published prices, so none are invented.
  price: z.coerce.number().min(0).optional(),
  currency: z.string().trim().max(8).optional(),
  imageUrl: imageUrlSchema.optional(),
  // 0 = Sunday … 6 = Saturday. Empty means every day the lounge is open; a
  // non-empty list restricts the treatment to a visiting practitioner's days.
  availableWeekdays: z
    .array(z.coerce.number().int().min(0).max(6))
    .max(7)
    .optional()
    .default([])
    .refine((days) => new Set(days).size === days.length, {
      message: 'Available weekdays must not repeat.',
    }),
  isActive: z.boolean().optional().default(true),
  displayOrder: z.coerce.number().int().optional().default(0),
});

export const updateServiceSchema = createServiceSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Nothing to update.' },
);

export const listServicesQuerySchema = z.object({
  category: categorySchema.optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  search: z.string().trim().max(120).optional(),
});

export const createGalleryImageSchema = z.object({
  title: z.string().trim().min(2).max(160),
  caption: z.string().trim().max(400).optional(),
  imageUrl: z.string().trim().min(1).max(500),
  beforeImageUrl: z.string().trim().max(500).optional(),
  category: categorySchema.optional(),
  altText: z.string().trim().min(2).max(240),
  isActive: z.boolean().optional().default(true),
  displayOrder: z.coerce.number().int().optional().default(0),
});

export const updateGalleryImageSchema = createGalleryImageSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Nothing to update.' },
);

export const listClientsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Every field optional: the notes box and the details form save independently,
 * and neither should have to resend the other's values.
 *
 * Phone stays required *if sent* — it is the client's sign-in identifier, so
 * clearing it would lock them out of an account they can no longer name.
 */
export const updateClientSchema = z
  .object({
    fullName: z.string().trim().min(2, "Please enter the client's full name.").max(120),
    phone,
    email: optionalEmail,
    notes: z.string().trim().max(2000),
    isActive: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'There is nothing to update.',
  });

export const reorderSchema = z.object({
  items: z
    .array(z.object({ id: objectIdSchema, displayOrder: z.coerce.number().int() }))
    .min(1)
    .max(200),
});
