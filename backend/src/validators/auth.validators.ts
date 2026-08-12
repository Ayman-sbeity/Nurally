import { z } from 'zod';
import { optionalEmail } from './common';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/\d/, 'Password must contain a number.');

const email = z.string().trim().toLowerCase().email('Please enter a valid email address.');

/**
 * Deliberately permissive: Nurella's clients may be in any country, so we
 * check shape rather than enforce a national format.
 */
const phone = z
  .string()
  .trim()
  .min(6, 'Please enter a valid phone number.')
  .max(32, 'Please enter a valid phone number.')
  .regex(/^[+()\d\s-]+$/, 'Phone number may only contain digits, spaces, +, -, ( and ).');

/**
 * Email is optional; the phone number is not. One of the two has to identify
 * the account at sign-in, and the phone is the one every client has — several
 * are booked in at the desk with nothing else.
 *
 * An empty string is treated as "not supplied" rather than rejected, so an
 * untouched optional field in the form does not fail validation.
 */
export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name.').max(120),
  email: optionalEmail,
  phone,
  password,
});

/**
 * Sign-in accepts either identifier in one field. `email` is still read as a
 * fallback so that a client running a cached copy of the previous frontend can
 * still sign in.
 */
export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    password: z.string().min(1, 'Please enter your password.'),
  })
  .refine((value) => Boolean(value.identifier ?? value.email), {
    message: 'Please enter your email address or phone number.',
    path: ['identifier'],
  })
  .transform((value) => ({
    identifier: (value.identifier ?? value.email) as string,
    password: value.password,
  }));

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password.'),
  newPassword: password,
});

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: phone.optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update.',
  });

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
