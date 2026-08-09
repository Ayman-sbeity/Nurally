import { z } from 'zod';

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

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name.').max(120),
  email,
  phone,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Please enter your password.'),
});

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
