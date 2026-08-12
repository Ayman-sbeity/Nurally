import type { Request, Response } from 'express';
import { BlockedPeriod } from '../models/BlockedPeriod';
import { WorkingHours } from '../models/WorkingHours';
import {
  getAvailabilityForService,
  getAvailabilityOverview,
  maxBookableDateKey,
} from '../services/availability.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';
import { env } from '../config/env';
import { loungeTimezone } from '../utils/time';

export const getAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { serviceId, date } = req.query as unknown as { serviceId: string; date: string };
  const availability = await getAvailabilityForService(serviceId, date);
  ok(res, {
    ...availability,
    timezone: loungeTimezone,
    maxBookableDate: maxBookableDateKey(),
  });
});

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const { serviceId, from, days } = req.query as unknown as {
    serviceId: string;
    from: string;
    days: number;
  };
  const overview = await getAvailabilityOverview(serviceId, from, days);
  ok(res, { days: overview, timezone: loungeTimezone, maxBookableDate: maxBookableDateKey() });
});

/** Public booking configuration the client app needs to render the calendar. */
export const getBookingSettings = asyncHandler(async (_req: Request, res: Response) => {
  const workingHours = await WorkingHours.find().sort({ weekday: 1 }).lean();
  ok(res, {
    timezone: loungeTimezone,
    slotGranularityMinutes: env.SLOT_GRANULARITY_MINUTES,
    maxAdvanceBookingDays: env.MAX_ADVANCE_BOOKING_DAYS,
    minBookingNoticeMinutes: env.MIN_BOOKING_NOTICE_MINUTES,
    maxBookableDate: maxBookableDateKey(),
    workingHours,
  });
});

// --- Admin -----------------------------------------------------------------

/**
 * Slots for a booking the lounge is making itself.
 *
 * Identical to the public list except that the minimum-notice window is
 * ignored: that rule exists to stop clients booking five minutes out, and it
 * would otherwise stop the front desk entering the walk-in in front of them.
 */
export const getAdminAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { serviceId, date } = req.query as unknown as { serviceId: string; date: string };
  const availability = await getAvailabilityForService(serviceId, date, { ignoreNotice: true });
  ok(res, {
    ...availability,
    timezone: loungeTimezone,
    maxBookableDate: maxBookableDateKey(),
  });
});

export const listWorkingHours = asyncHandler(async (_req: Request, res: Response) => {
  const workingHours = await WorkingHours.find().sort({ weekday: 1 }).lean();
  ok(res, { workingHours });
});

export const updateWorkingHours = asyncHandler(async (req: Request, res: Response) => {
  const { days } = req.body as {
    days: {
      weekday: number;
      isOpen: boolean;
      openMinute: number;
      closeMinute: number;
      breaks: { startMinute: number; endMinute: number }[];
    }[];
  };

  await WorkingHours.bulkWrite(
    days.map((day) => ({
      updateOne: {
        filter: { weekday: day.weekday },
        update: { $set: day },
        upsert: true,
      },
    })),
  );

  const workingHours = await WorkingHours.find().sort({ weekday: 1 }).lean();
  ok(res, { workingHours });
});

export const listBlockedPeriods = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const filter: Record<string, unknown> = {};
  if (from) filter.endAt = { $gte: new Date(from) };
  if (to) filter.startAt = { $lte: new Date(to) };

  const blockedPeriods = await BlockedPeriod.find(filter).sort({ startAt: 1 }).limit(500).lean();
  ok(res, { blockedPeriods });
});

export const createBlockedPeriod = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const blockedPeriod = await BlockedPeriod.create({
    ...req.body,
    startAt: new Date(req.body.startAt),
    endAt: new Date(req.body.endAt),
    createdBy: req.user._id,
  });
  ok(res, { blockedPeriod }, 201);
});

export const deleteBlockedPeriod = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await BlockedPeriod.findByIdAndDelete(req.params.id);
  if (!deleted) throw ApiError.notFound('That blocked period could not be found.');
  ok(res, { message: 'Blocked period removed.' });
});
