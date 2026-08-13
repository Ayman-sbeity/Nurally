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
 * Makes a text field genuinely optional, and clearable.
 *
 * The obvious spelling — `z.union([email, z.literal('')])` — is subtly wrong:
 * `z.literal('')` matches the empty string *exactly*, so a field containing
 * only whitespace matches neither branch and fails as a malformed address.
 * An optional field that rejects a stray space reads to the person filling it
 * in as a required one.
 *
 * Three inputs, three meanings, and a partial update has to tell them apart:
 *
 * | Sent            | Parsed      | An update should |
 * | --------------- | ----------- | ---------------- |
 * | nothing         | `undefined` | leave it alone   |
 * | `""`, `"  "`, `null` | `null` | clear it         |
 * | `"a@b.com"`     | `"a@b.com"` | set it          |
 *
 * Collapsing the middle row to `undefined` — the obvious simplification — is
 * what makes a field impossible to empty once filled: the service sees the same
 * value for "left blank" as for "not part of this request", and skips it.
 */
export function optional<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }, schema.nullable().optional());
}

export const optionalEmail = optional(email);
export const optionalPhone = optional(phone);
