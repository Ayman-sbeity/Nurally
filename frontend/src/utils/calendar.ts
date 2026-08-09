/**
 * Geometry and rules for the admin calendar.
 *
 * Two things make this more than arithmetic. Everything is expressed in the
 * lounge's timezone rather than the device's, because the working day, the slot
 * ladder and every rule the server applies are wall-clock facts about the
 * lounge — an admin travelling, or a server left on UTC, must not shift the
 * diary. And every function here is pure, so the grid stays about rendering and
 * a drag can ask "may this land here?" without a round trip. The server still
 * re-validates each move; these checks exist to keep the pointer honest while
 * it is in the air.
 */

import { format, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { Appointment, AppointmentStatus, BlockedPeriod, WorkingHours } from '@/types/api';
import { minutesToTime } from './format';

/** Statuses an admin may still move to another time. */
const MOVABLE: readonly AppointmentStatus[] = [
  'PENDING',
  'CONFIRMED',
  'TIME_OFFERED',
  'RESCHEDULE_REQUESTED',
];

/**
 * Statuses that still hold their slot. Cancelled and rejected bookings release
 * the time server-side, so they must not block a drop; completed and no-show
 * keep it, because the hour really was used.
 */
const OCCUPYING: readonly AppointmentStatus[] = [...MOVABLE, 'COMPLETED', 'NO_SHOW'];

export const isMovable = (appointment: Appointment): boolean =>
  MOVABLE.includes(appointment.status);

export const occupiesSlot = (appointment: Appointment): boolean =>
  OCCUPYING.includes(appointment.status);

/**
 * A confirmed appointment moves directly; anything still awaiting the client is
 * sent as an offer instead. This mirrors the server's state machine, where
 * `rescheduleByAdmin` refuses everything that is not CONFIRMED.
 */
export const moveKindFor = (appointment: Appointment): 'reschedule' | 'offer' =>
  appointment.status === 'CONFIRMED' ? 'reschedule' : 'offer';

export const MINUTES_PER_DAY = 1440;
const DEFAULT_OPEN_MINUTE = 9 * 60;
const DEFAULT_CLOSE_MINUTE = 19 * 60;
/** Never draw a grid shorter than this, however narrow the opening hours are. */
const MIN_GRID_MINUTES = 6 * 60;

/** A calendar date in the lounge's timezone, `YYYY-MM-DD`. */
export type DayKey = string;

export const deviceZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const toInstant = (value: string | Date): Date => (typeof value === 'string' ? new Date(value) : value);

const pad = (value: number): string => String(value).padStart(2, '0');

/** Which lounge day an instant falls on. */
export const dayKeyIn = (value: string | Date, timezone: string): DayKey =>
  formatInTimeZone(toInstant(value), timezone, 'yyyy-MM-dd');

/** Minutes since lounge midnight for an instant. */
export function minuteOfDayIn(value: string | Date, timezone: string): number {
  const zoned = toZonedTime(toInstant(value), timezone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/**
 * The instant at a wall-clock minute on a lounge day. DST-safe because the
 * offset is resolved for that concrete wall time, which is exactly how the
 * server builds its slots.
 */
export const instantAt = (day: DayKey, minute: number, timezone: string): Date =>
  fromZonedTime(`${day}T${pad(Math.floor(minute / 60))}:${pad(minute % 60)}:00`, timezone);

export const timeIn = (value: string | Date, timezone: string): string =>
  formatInTimeZone(toInstant(value), timezone, 'HH:mm');

export const stampIn = (value: string | Date, timezone: string): string =>
  formatInTimeZone(toInstant(value), timezone, 'EEE d MMM · HH:mm');

export const dateTimeIn = (value: string | Date, timezone: string): string =>
  formatInTimeZone(toInstant(value), timezone, "EEEE, d MMMM yyyy 'at' HH:mm");

/** Today's date in the lounge, as a floating date for calendar navigation. */
export const todayInZone = (timezone: string): Date => parseISO(dayKeyIn(new Date(), timezone));

/**
 * Working hours for a lounge day. The weekday is read off the key itself so the
 * answer never depends on where the browser is.
 */
export const hoursForDay = (
  workingHours: WorkingHours[],
  day: DayKey,
): WorkingHours | undefined => {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return workingHours.find((entry) => entry.weekday === weekday);
};

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  aStart < bEnd && bStart < aEnd;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * The server generates slots as `openMinute + n × granularity`, so a dropped
 * appointment has to land on that ladder rather than on round hours.
 */
export function snapToSlot(minute: number, openMinute: number, slotMinutes: number): number {
  const step = Math.max(1, slotMinutes);
  return openMinute + Math.round((minute - openMinute) / step) * step;
}

export interface GridRange {
  startMinute: number;
  endMinute: number;
}

/**
 * Vertical extent of the time grid: the opening hours of the visible days,
 * widened so an appointment booked outside them is never cropped out of sight.
 */
export function gridRange(
  days: DayKey[],
  appointments: Appointment[],
  workingHours: WorkingHours[],
  timezone: string,
): GridRange {
  let open = Number.POSITIVE_INFINITY;
  let close = Number.NEGATIVE_INFINITY;

  for (const day of days) {
    const hours = hoursForDay(workingHours, day);
    if (!hours?.isOpen) continue;
    open = Math.min(open, hours.openMinute);
    close = Math.max(close, hours.closeMinute);
  }

  if (!Number.isFinite(open) || !Number.isFinite(close)) {
    open = DEFAULT_OPEN_MINUTE;
    close = DEFAULT_CLOSE_MINUTE;
  }

  for (const appointment of appointments) {
    const start = minuteOfDayIn(appointment.startAt, timezone);
    open = Math.min(open, start);
    close = Math.max(close, start + appointment.durationMinutes);
  }

  const startMinute = clamp(Math.floor(open / 60) * 60, 0, MINUTES_PER_DAY);
  const endMinute = clamp(
    Math.max(Math.ceil(close / 60) * 60, startMinute + MIN_GRID_MINUTES),
    0,
    MINUTES_PER_DAY,
  );

  return { startMinute, endMinute };
}

export interface PlacedAppointment {
  appointment: Appointment;
  startMinute: number;
  endMinute: number;
  /** Column index within a cluster of overlapping appointments. */
  lane: number;
  laneCount: number;
}

/**
 * Side-by-side placement for one day: overlapping appointments are grouped into
 * clusters and each takes the first free lane, so two bookings at the same hour
 * sit next to each other instead of hiding one another.
 */
export function placeDay(appointments: Appointment[], timezone: string): PlacedAppointment[] {
  const items = appointments
    .map((appointment) => {
      const startMinute = minuteOfDayIn(appointment.startAt, timezone);
      return {
        appointment,
        startMinute,
        endMinute: startMinute + Math.max(appointment.durationMinutes, 5),
      };
    })
    .sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);

  const placed: PlacedAppointment[] = [];
  let cluster: typeof items = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.startMinute);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.endMinute;
      return { ...item, lane };
    });
    for (const item of assigned) placed.push({ ...item, laneCount: laneEnds.length });
    cluster = [];
  };

  for (const item of items) {
    if (item.startMinute >= clusterEnd) {
      flush();
      clusterEnd = item.endMinute;
    } else {
      clusterEnd = Math.max(clusterEnd, item.endMinute);
    }
    cluster.push(item);
  }
  flush();

  return placed;
}

export interface MoveRules {
  appointments: Appointment[];
  workingHours: WorkingHours[];
  blockedPeriods: BlockedPeriod[];
}

const nameOf = (appointment: Appointment): string =>
  typeof appointment.client === 'object' ? appointment.client.fullName : 'another client';

/**
 * Why this appointment cannot start at `start`, or `null` when it can.
 *
 * These are the availability engine's rules minus the minimum notice period —
 * an admin rearranging their own diary is trusted with short notice, exactly as
 * the server's `ignoreNotice` flag allows.
 */
export function moveIssue(
  appointment: Appointment,
  start: Date,
  rules: MoveRules,
  timezone: string,
): string | null {
  const end = new Date(start.getTime() + appointment.durationMinutes * 60_000);

  if (end.getTime() <= Date.now()) return 'That time has already passed.';

  const day = dayKeyIn(start, timezone);
  const hours = hoursForDay(rules.workingHours, day);
  if (!hours || !hours.isOpen) {
    return `The lounge is closed on ${format(parseISO(day), 'EEEE')}s.`;
  }

  const from = minuteOfDayIn(start, timezone);
  const to = from + appointment.durationMinutes;
  if (from < hours.openMinute || to > hours.closeMinute) {
    return `Outside opening hours (${minutesToTime(hours.openMinute)}–${minutesToTime(
      hours.closeMinute,
    )}).`;
  }

  if (hours.breaks.some((brk) => from < brk.endMinute && brk.startMinute < to)) {
    return 'That overlaps a break.';
  }

  const block = rules.blockedPeriods.find((period) =>
    overlaps(start, end, new Date(period.startAt), new Date(period.endAt)),
  );
  if (block) return block.reason ? `Blocked — ${block.reason}.` : 'That period is blocked.';

  const clash = rules.appointments.find(
    (other) =>
      other._id !== appointment._id &&
      occupiesSlot(other) &&
      overlaps(start, end, new Date(other.startAt), new Date(other.endAt)),
  );
  if (clash) return `Overlaps ${nameOf(clash)} at ${timeIn(clash.startAt, timezone)}.`;

  return null;
}
