import { z } from 'zod';
import { APPOINTMENT_STATUSES } from '../types/domain';

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier.');

export const idParamSchema = z.object({ id: objectIdSchema });

const isoDateTime = z.string().datetime({ offset: true, message: 'Invalid date/time.' });

export const createAppointmentSchema = z.object({
  serviceId: objectIdSchema,
  startAt: isoDateTime,
  clientNotes: z.string().trim().max(1000).optional(),
});

/**
 * A booking made at the front desk. The client is named explicitly rather than
 * taken from the session, and the lounge can record its own note at the same
 * time — there is no separate approval step to attach one to.
 */
export const adminCreateAppointmentSchema = z.object({
  clientId: objectIdSchema,
  serviceId: objectIdSchema,
  startAt: isoDateTime,
  clientNotes: z.string().trim().max(1000).optional(),
  adminNotes: z.string().trim().max(1000).optional(),
});

/**
 * Editing an appointment in place. Every field optional — the desk corrects one
 * thing at a time — but at least one has to be present or the request is a
 * no-op dressed up as a change.
 */
export const editAppointmentSchema = z
  .object({
    serviceId: objectIdSchema,
    startAt: isoDateTime,
    clientNotes: z.string().trim().max(1000),
    adminNotes: z.string().trim().max(1000),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'There is nothing to update.',
  });

export const offerTimeSchema = z.object({
  startAt: isoDateTime,
  message: z.string().trim().max(500).optional(),
});

export const rescheduleByAdminSchema = z.object({
  startAt: isoDateTime,
  message: z.string().trim().max(500).optional(),
});

export const requestRescheduleSchema = z.object({
  proposedStartAt: isoDateTime,
  message: z.string().trim().max(500).optional(),
});

export const reasonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const approveSchema = z.object({
  adminNotes: z.string().trim().max(1000).optional(),
});

export const listAppointmentsQuerySchema = z.object({
  status: z
    .union([z.enum(APPOINTMENT_STATUSES as [string, ...string[]]), z.string()])
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => (APPOINTMENT_STATUSES as string[]).includes(entry))
        : undefined,
    ),
  /** `upcoming` | `past` — relative to now. */
  scope: z.enum(['upcoming', 'past', 'all']).optional().default('all'),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().trim().max(120).optional(),
  clientId: objectIdSchema.optional(),
  serviceId: objectIdSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
