import { format, formatDistanceToNowStrict, isToday, isTomorrow, parseISO } from 'date-fns';
import type { AppointmentStatus } from '@/types/api';

/** Short, human labels for each status — used in badges and headings. */
export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: 'Pending approval',
  CONFIRMED: 'Confirmed',
  TIME_OFFERED: 'New time offered',
  RESCHEDULE_REQUESTED: 'Reschedule requested',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Declined',
  NO_SHOW: 'No show',
};

/** One sentence explaining what the status means for the client. */
export const STATUS_EXPLANATION: Record<AppointmentStatus, string> = {
  PENDING: 'Your request has been received. It is not confirmed until the lounge approves it.',
  CONFIRMED: 'Your appointment is confirmed. We look forward to seeing you.',
  TIME_OFFERED: 'The lounge proposed a different time. Please accept or decline it.',
  RESCHEDULE_REQUESTED: 'Your reschedule request is with the lounge. Your original time is still held.',
  COMPLETED: 'This appointment is complete. Thank you for visiting Nurella.',
  CANCELLED: 'This appointment was cancelled.',
  REJECTED: 'This request could not be accepted. You are welcome to choose another time.',
  NO_SHOW: 'This appointment was recorded as a no-show.',
};

export const dateKey = (value: Date): string => format(value, 'yyyy-MM-dd');

export const formatTime = (iso: string): string => format(parseISO(iso), 'HH:mm');

export const formatDate = (iso: string): string => format(parseISO(iso), 'd MMMM yyyy');

export const formatDayLabel = (iso: string): string => format(parseISO(iso), 'EEEE, d MMMM');

export const formatDateTime = (iso: string): string =>
  format(parseISO(iso), "EEEE, d MMMM yyyy 'at' HH:mm");

export const formatShortDateTime = (iso: string): string =>
  format(parseISO(iso), "d MMM yyyy · HH:mm");

/** "Today", "Tomorrow", or the weekday + date. */
export function friendlyDay(iso: string): string {
  const date = parseISO(iso);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE, d MMM');
}

export const relativeTime = (iso: string): string =>
  `${formatDistanceToNowStrict(parseISO(iso))} ago`;

/** "in 3 days", "in 2 hours" — how far off an upcoming appointment is. */
export const timeUntil = (iso: string): string =>
  `in ${formatDistanceToNowStrict(parseISO(iso))}`;

/**
 * Buckets appointments under a day heading, preserving the order the API
 * returned them in. Used by the list screens, where a flat run of cards gives
 * no sense of "which day am I looking at".
 */
export function groupByDay<T extends { startAt: string }>(
  items: T[],
): { key: string; label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = [];

  for (const item of items) {
    const key = dateKey(parseISO(item.startAt));
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    groups.push({ key, label: friendlyDay(item.startAt), items: [item] });
  }

  return groups;
}

/** Minutes from midnight → `HH:mm`, for working-hours editing. */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function timeToMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/**
 * Price is only ever shown when the lounge has configured one — the system
 * never displays a placeholder that could read as a real price.
 */
export function formatPrice(price?: number, currency?: string): string | null {
  if (price === undefined || price === null) return null;
  return currency ? `${currency} ${price.toFixed(2)}` : price.toFixed(2);
}

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
