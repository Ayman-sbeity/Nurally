import { z } from 'zod';
import { AssetVariant, PhotoPhase } from '../types/domain';
import { objectIdSchema } from './appointment.validators';
import { optionalEmail, phone } from './common';

/**
 * Multipart bodies arrive as strings, so these schemas coerce rather than
 * expect real types — `z.coerce` where a boolean or date is wanted.
 */

export const createClientSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter the client's full name.").max(120),
  // Optional: a walk-in is often booked in with a name and a number only.
  // Blank, whitespace and null all mean "not supplied" rather than failing.
  email: optionalEmail,
  phone,
  notes: z.string().trim().max(2000).optional(),
  marketingOptIn: z.coerce.boolean().optional().default(false),
});

export const createPhotoSetSchema = z.object({
  title: z.string().trim().min(2, 'Give this record a title.').max(160),
  serviceId: objectIdSchema.optional(),
  appointmentId: objectIdSchema.optional(),
  takenAt: z.coerce.date({ invalid_type_error: 'Enter a valid date.' }),
  notes: z.string().trim().max(2000).optional(),
  consentToPublish: z.coerce.boolean().optional().default(false),
});

export const updatePhotoSetSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    takenAt: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).optional(),
    consentToPublish: z.coerce.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update.' });

export const uploadPhotoSchema = z.object({
  phase: z.nativeEnum(PhotoPhase, {
    errorMap: () => ({ message: 'Photos must be marked BEFORE or AFTER.' }),
  }),
  caption: z.string().trim().max(400).optional(),
});

export const uploadDocumentSchema = z.object({
  caption: z.string().trim().max(400).optional(),
});

export const assetIdParamSchema = z.object({ assetId: objectIdSchema });

export const signedVariantParamsSchema = z.object({
  assetId: objectIdSchema,
  variant: z.nativeEnum(AssetVariant),
});

export const signedVariantQuerySchema = z.object({
  exp: z.coerce.number().int().positive(),
  // A SHA-256 HMAC in base64url is 43 characters; anything else is not ours.
  sig: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const setIdParamSchema = z.object({ setId: objectIdSchema });
