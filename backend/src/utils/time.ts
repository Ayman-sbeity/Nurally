import { addMinutes } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { env } from '../config/env';

export const MINUTES_PER_DAY = 1440;

const TZ = env.LOUNGE_TIMEZONE;

const pad = (value: number): string => String(value).padStart(2, '0');

/** `true` for strings shaped `YYYY-MM-DD`. */
export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * Converts a wall-clock minute-of-day in the lounge timezone into an absolute
 * instant. DST-correct because the offset is resolved per concrete wall time
 * rather than by adding minutes to midnight.
 */
export function zonedMinuteToInstant(dateKey: string, minuteOfDay: number): Date {
  if (minuteOfDay >= MINUTES_PER_DAY) {
    // 1440 means "midnight at the end of this day" — resolve on the next date.
    const nextDay = addMinutes(fromZonedTime(`${dateKey}T00:00:00`, TZ), MINUTES_PER_DAY);
    return addMinutes(nextDay, minuteOfDay - MINUTES_PER_DAY);
  }
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return fromZonedTime(`${dateKey}T${pad(hours)}:${pad(minutes)}:00`, TZ);
}

/** Absolute instants bounding a calendar day in the lounge timezone. */
export function zonedDayBounds(dateKey: string): { start: Date; end: Date } {
  return {
    start: zonedMinuteToInstant(dateKey, 0),
    end: zonedMinuteToInstant(dateKey, MINUTES_PER_DAY),
  };
}

/** 0 = Sunday … 6 = Saturday, evaluated in the lounge timezone. */
export function weekdayInZone(instant: Date): number {
  return toZonedTime(instant, TZ).getDay();
}

/** `YYYY-MM-DD` for an instant, as seen in the lounge timezone. */
export function dateKeyInZone(instant: Date): string {
  return formatInTimeZone(instant, TZ, 'yyyy-MM-dd');
}

export function formatInLoungeZone(instant: Date, pattern: string): string {
  return formatInTimeZone(instant, TZ, pattern);
}

/** Human-readable slot label, e.g. `14:30`. */
export function timeLabel(instant: Date): string {
  return formatInTimeZone(instant, TZ, 'HH:mm');
}

/** Minutes elapsed since midnight (lounge timezone) for an instant. */
export function minuteOfDayInZone(instant: Date): number {
  const zoned = toZonedTime(instant, TZ);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/**
 * Rounds an instant **down** to the booking grid. Grid cells are anchored to
 * the Unix epoch so alignment is globally consistent and independent of which
 * day is being queried.
 */
export function floorToGrid(instant: Date, granularityMinutes: number): Date {
  const ms = granularityMinutes * 60_000;
  return new Date(Math.floor(instant.getTime() / ms) * ms);
}

/** `true` when the instant sits exactly on a grid boundary. */
export function isOnGrid(instant: Date, granularityMinutes: number): boolean {
  return instant.getTime() % (granularityMinutes * 60_000) === 0;
}

/**
 * Every grid cell start covered by `[startAt, startAt + durationMinutes)`.
 * These are the cells an appointment must claim to hold the slot.
 */
export function gridCellsFor(
  startAt: Date,
  durationMinutes: number,
  granularityMinutes: number,
): Date[] {
  const first = floorToGrid(startAt, granularityMinutes);
  const endMs = startAt.getTime() + durationMinutes * 60_000;
  const cells: Date[] = [];
  for (let ms = first.getTime(); ms < endMs; ms += granularityMinutes * 60_000) {
    cells.push(new Date(ms));
  }
  return cells;
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export const loungeTimezone = TZ;
