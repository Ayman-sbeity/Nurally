import { addDays, startOfDay } from 'date-fns';
import type { Types } from 'mongoose';
import { env } from '../config/env';
import { BlockedPeriod } from '../models/BlockedPeriod';
import { Service, type ServiceDocument } from '../models/Service';
import { WorkingHours } from '../models/WorkingHours';
import { ApiError, ErrorCode } from '../utils/ApiError';
import {
  MINUTES_PER_DAY,
  dateKeyInZone,
  gridCellsFor,
  isDateKey,
  rangesOverlap,
  timeLabel,
  weekdayInZone,
  zonedDayBounds,
  zonedMinuteToInstant,
} from '../utils/time';
import { getOccupiedCells } from './slotLock.service';

const GRANULARITY = env.SLOT_GRANULARITY_MINUTES;

export interface AvailableSlot {
  /** ISO instant the appointment would start at. */
  startAt: string;
  /** `HH:mm` in the lounge timezone, ready to render. */
  label: string;
}

export interface DayAvailability {
  date: string;
  isOpen: boolean;
  /** Why the day has no slots — lets the UI explain rather than show an empty list. */
  closedReason?: 'DAY_OFF' | 'BLOCKED' | 'FULLY_BOOKED' | 'PAST' | 'TOO_FAR_AHEAD';
  serviceDurationMinutes: number;
  slots: AvailableSlot[];
}

interface ComputeOptions {
  dateKey: string;
  durationMinutes: number;
  /** Ignore this appointment's own slot claims (re-timing an existing booking). */
  excludeAppointmentId?: Types.ObjectId;
  /** Admins may place appointments inside the minimum-notice window. */
  ignoreNotice?: boolean;
}

function assertValidDateKey(dateKey: string): void {
  if (!isDateKey(dateKey)) {
    throw ApiError.badRequest('Please provide a valid date.', [
      { field: 'date', message: 'Expected format YYYY-MM-DD.' },
    ]);
  }
}

/** Furthest date clients may book into, as a `YYYY-MM-DD` key. */
export function maxBookableDateKey(): string {
  return dateKeyInZone(addDays(new Date(), env.MAX_ADVANCE_BOOKING_DAYS));
}

/**
 * The single source of truth for "can this be booked?".
 *
 * Both the slot list shown to clients and the server-side re-check performed
 * during booking run through this function, so the two can never disagree.
 */
export async function computeDayAvailability(options: ComputeOptions): Promise<DayAvailability> {
  const { dateKey, durationMinutes, excludeAppointmentId, ignoreNotice = false } = options;
  assertValidDateKey(dateKey);

  const empty = (closedReason: DayAvailability['closedReason']): DayAvailability => ({
    date: dateKey,
    isOpen: false,
    closedReason,
    serviceDurationMinutes: durationMinutes,
    slots: [],
  });

  const { start: dayStart, end: dayEnd } = zonedDayBounds(dateKey);
  const now = new Date();

  if (dayEnd <= now) return empty('PAST');
  if (dayStart > addDays(startOfDay(now), env.MAX_ADVANCE_BOOKING_DAYS)) {
    return empty('TOO_FAR_AHEAD');
  }

  const weekday = weekdayInZone(dayStart);
  const hours = await WorkingHours.findOne({ weekday }).lean();
  if (!hours || !hours.isOpen) return empty('DAY_OFF');

  const [blocks, occupiedCells] = await Promise.all([
    BlockedPeriod.find({ startAt: { $lt: dayEnd }, endAt: { $gt: dayStart } }).lean(),
    getOccupiedCells(dayStart, dayEnd, excludeAppointmentId),
  ]);

  // A block covering the entire open window closes the day outright.
  const openInstant = zonedMinuteToInstant(dateKey, hours.openMinute);
  const closeInstant = zonedMinuteToInstant(dateKey, Math.min(hours.closeMinute, MINUTES_PER_DAY));
  const dayFullyBlocked = blocks.some(
    (block) => block.startAt <= openInstant && block.endAt >= closeInstant,
  );
  if (dayFullyBlocked) return empty('BLOCKED');

  const earliestStart = ignoreNotice
    ? now
    : new Date(now.getTime() + env.MIN_BOOKING_NOTICE_MINUTES * 60_000);

  const slots: AvailableSlot[] = [];
  const lastStartMinute = hours.closeMinute - durationMinutes;

  for (let minute = hours.openMinute; minute <= lastStartMinute; minute += GRANULARITY) {
    const startAt = zonedMinuteToInstant(dateKey, minute);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    if (startAt < earliestStart) continue;

    const hitsBreak = hours.breaks.some((brk) =>
      rangesOverlap(
        startAt,
        endAt,
        zonedMinuteToInstant(dateKey, brk.startMinute),
        zonedMinuteToInstant(dateKey, brk.endMinute),
      ),
    );
    if (hitsBreak) continue;

    const hitsBlock = blocks.some((block) =>
      rangesOverlap(startAt, endAt, block.startAt, block.endAt),
    );
    if (hitsBlock) continue;

    const taken = gridCellsFor(startAt, durationMinutes, GRANULARITY).some((cell) =>
      occupiedCells.has(cell.getTime()),
    );
    if (taken) continue;

    slots.push({ startAt: startAt.toISOString(), label: timeLabel(startAt) });
  }

  if (slots.length === 0) {
    return { ...empty('FULLY_BOOKED'), isOpen: true };
  }

  return {
    date: dateKey,
    isOpen: true,
    serviceDurationMinutes: durationMinutes,
    slots,
  };
}

export async function getServiceForBooking(serviceId: string): Promise<ServiceDocument> {
  const service = await Service.findById(serviceId);
  if (!service) throw ApiError.notFound('That service could not be found.');
  if (!service.isActive) {
    throw ApiError.conflict('That service is not currently available for booking.');
  }
  return service;
}

/** Availability for one service on one day, as requested by the booking UI. */
export async function getAvailabilityForService(
  serviceId: string,
  dateKey: string,
  options: { excludeAppointmentId?: Types.ObjectId; ignoreNotice?: boolean } = {},
): Promise<DayAvailability> {
  const service = await getServiceForBooking(serviceId);
  return computeDayAvailability({
    dateKey,
    durationMinutes: service.durationMinutes,
    ...options,
  });
}

/**
 * Re-validates a specific instant server-side before an appointment is written.
 * The frontend's slot list is a convenience; this is the authority.
 */
export async function assertSlotIsBookable(params: {
  startAt: Date;
  durationMinutes: number;
  excludeAppointmentId?: Types.ObjectId;
  ignoreNotice?: boolean;
}): Promise<void> {
  const { startAt, durationMinutes, excludeAppointmentId, ignoreNotice } = params;
  const dateKey = dateKeyInZone(startAt);

  const availability = await computeDayAvailability({
    dateKey,
    durationMinutes,
    ...(excludeAppointmentId ? { excludeAppointmentId } : {}),
    ...(ignoreNotice ? { ignoreNotice } : {}),
  });

  const target = startAt.toISOString();
  if (!availability.slots.some((slot) => slot.startAt === target)) {
    throw ApiError.conflict(
      'That time is no longer available. Please pick another slot.',
      ErrorCode.SLOT_UNAVAILABLE,
    );
  }
}

/**
 * Which of the next `days` calendar days have at least one opening — powers the
 * date picker so clients never tap into an empty day.
 */
export async function getAvailabilityOverview(
  serviceId: string,
  fromDateKey: string,
  days: number,
): Promise<{ date: string; hasSlots: boolean; slotCount: number }[]> {
  assertValidDateKey(fromDateKey);
  const service = await getServiceForBooking(serviceId);
  const { start } = zonedDayBounds(fromDateKey);

  const results: { date: string; hasSlots: boolean; slotCount: number }[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const dateKey = dateKeyInZone(addDays(start, offset));
    // Sequential on purpose: each day is a couple of indexed reads, and this
    // keeps the connection pool free for interactive requests.
    const availability = await computeDayAvailability({
      dateKey,
      durationMinutes: service.durationMinutes,
    });
    results.push({
      date: dateKey,
      hasSlots: availability.slots.length > 0,
      slotCount: availability.slots.length,
    });
  }
  return results;
}
