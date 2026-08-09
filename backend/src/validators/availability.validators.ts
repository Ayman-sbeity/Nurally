import { z } from 'zod';
import { objectIdSchema } from './appointment.validators';

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date format YYYY-MM-DD.');

const minuteOfDay = z.coerce.number().int().min(0).max(1440);

export const availabilityQuerySchema = z.object({
  serviceId: objectIdSchema,
  date: dateKey,
});

export const availabilityOverviewQuerySchema = z.object({
  serviceId: objectIdSchema,
  from: dateKey,
  days: z.coerce.number().int().min(1).max(60).default(14),
});

const timeRangeSchema = z
  .object({ startMinute: minuteOfDay, endMinute: minuteOfDay })
  .refine((range) => range.endMinute > range.startMinute, {
    message: 'A break must end after it starts.',
    path: ['endMinute'],
  });

export const updateWorkingHoursSchema = z.object({
  days: z
    .array(
      z
        .object({
          weekday: z.coerce.number().int().min(0).max(6),
          isOpen: z.boolean(),
          openMinute: minuteOfDay,
          closeMinute: minuteOfDay,
          breaks: z.array(timeRangeSchema).max(6).default([]),
        })
        .refine((day) => !day.isOpen || day.closeMinute > day.openMinute, {
          message: 'Closing time must be after opening time.',
          path: ['closeMinute'],
        }),
    )
    .min(1)
    .max(7),
});

export const createBlockedPeriodSchema = z
  .object({
    startAt: z.string().datetime({ offset: true, message: 'Invalid start date/time.' }),
    endAt: z.string().datetime({ offset: true, message: 'Invalid end date/time.' }),
    allDay: z.boolean().optional().default(false),
    reason: z.string().trim().max(240).optional(),
  })
  .refine((value) => new Date(value.endAt) > new Date(value.startAt), {
    message: 'The blocked period must end after it starts.',
    path: ['endAt'],
  });

export const listBlockedPeriodsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
