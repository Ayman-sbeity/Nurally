import { z } from 'zod';

/**
 * SHARED IDENTIFIER SCHEMAS
 * -------------------------
 * Email and phone are validated in four places (registration, admin client
 * creation, staff creation, staff updates). They live here so a fix lands
 * everywhere at once rather than in whichever copy someone remembers.
 */

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address.');

/**
 * Deliberately permissive: Nurella's clients may be in any country, so we
 * check shape rather than enforce a national format.
 */
export const phone = z
  .string()
  .trim()
  .min(6, 'Please enter a valid phone number.')
  .max(32, 'Please enter a valid phone number.')
  .regex(/^[+()\d\s-]+$/, 'Phone number may only contain digits, spaces, +, -, ( and ).');

/**
 * Makes a text field genuinely optional.
 *
 * The obvious spelling — `z.union([email, z.literal('')])` — is subtly wrong:
 * `z.literal('')` matches the empty string *exactly*, so a field containing
 * only whitespace matches neither branch and fails as a malformed address.
 * An optional field that rejects a stray space reads to the person filling it
 * in as a required one. `null` failed the same way, and JSON clients send it
 * routinely for "no value".
 *
 * Preprocessing instead of a union settles all three: trim first, treat
 * blank/null/undefined as absent, and only then validate what remains.
 */
export function optional<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }, schema.optional());
}

export const optionalEmail = optional(email);
export const optionalPhone = optional(phone);
