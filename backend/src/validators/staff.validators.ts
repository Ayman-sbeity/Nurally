import { z } from 'zod';
import { ADMIN_RESOURCES, PERMISSION_ACTIONS } from '../types/domain';
import { optionalEmail, phone } from './common';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/\d/, 'Password must contain a number.');


/**
 * The permission grid as the admin submits it. The service normalises it
 * afterwards (`normalizePermissions`) — this only rejects values that are not
 * part of the vocabulary at all.
 */
const permissions = z
  .array(
    z.object({
      resource: z.enum(ADMIN_RESOURCES as [string, ...string[]]),
      actions: z.array(z.enum(PERMISSION_ACTIONS as [string, ...string[]])).default([]),
    }),
  )
  .max(ADMIN_RESOURCES.length, 'Too many permission entries.')
  .default([]);

/**
 * Employees sign in with their phone number, exactly as clients do — it is the
 * one identifier everyone here has, and it keeps a single sign-in rule across
 * the whole app rather than one for staff and another for clients.
 *
 * Email is optional. Nothing depends on it: the owner resets an employee's
 * password from the Staff page, so there is no reset link needing an address.
 */
export const createStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter the employee's full name.").max(120),
  phone,
  email: optionalEmail,
  jobTitle: z.string().trim().max(80).optional(),
  password,
  permissions,
});

/**
 * Every field is optional — the permission grid is saved on its own, without
 * resending the account details.
 *
 * `password` is absent unless the owner is resetting it, so that saving
 * permissions cannot silently blank an employee's password.
 */
export const updateStaffSchema = z
  .object({
    fullName: z.string().trim().min(2, "Please enter the employee's full name.").max(120),
    phone,
    email: optionalEmail,
    jobTitle: z.string().trim().max(80).optional(),
    password,
    permissions,
    isActive: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'There is nothing to update.',
  });

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
