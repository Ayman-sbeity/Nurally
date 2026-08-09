import { useCallback, useMemo } from 'react';
import { format, isSameMonth } from 'date-fns';
import { clientOf, serviceName } from '@/components/client/AppointmentCard';
import { useCalendarDrag } from '@/hooks/useCalendarDrag';
import type { Appointment, BlockedPeriod, WorkingHours } from '@/types/api';
import {
  dayKeyIn,
  hoursForDay,
  instantAt,
  isMovable,
  minuteOfDayIn,
  moveIssue,
  timeIn,
} from '@/utils/calendar';
import { dateKey } from '@/utils/format';

interface CalendarMonthGridProps {
  days: Date[];
  month: Date;
  appointments: Appointment[];
  workingHours: WorkingHours[];
  blockedPeriods: BlockedPeriod[];
  timezone: string;
  busyId?: string | null;
  onSelect: (appointment: Appointment) => void;
  onMove: (appointment: Appointment, start: Date) => void;
  onRejectMove: (issue: string) => void;
  onSelectDay: (day: Date) => void;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

/**
 * The month overview. Dragging a chip onto another date keeps its time of day
 * and only changes the date — a minute has no position here, so the fine-
 * grained move belongs to the week and day grids.
 */
export function CalendarMonthGrid({
  days,
  month,
  appointments,
  workingHours,
  blockedPeriods,
  timezone,
  busyId,
  onSelect,
  onMove,
  onRejectMove,
  onSelectDay,
}: CalendarMonthGridProps) {
  const rules = useMemo(
    () => ({ appointments, workingHours, blockedPeriods }),
    [appointments, workingHours, blockedPeriods],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = dayKeyIn(appointment.startAt, timezone);
      const list = map.get(key);
      if (list) list.push(appointment);
      else map.set(key, [appointment]);
    }
    return map;
  }, [appointments, timezone]);

  const resolve = useCallback(
    (point: { x: number; y: number }, { appointment }: { appointment: Appointment }) => {
      const cell = document
        .elementFromPoint(point.x, point.y)
        ?.closest<HTMLElement>('[data-cell-day]');
      const key = cell?.dataset.cellDay;
      if (!key) return null;

      const start = instantAt(key, minuteOfDayIn(appointment.startAt, timezone), timezone);
      return { start, issue: moveIssue(appointment, start, rules, timezone) };
    },
    [rules, timezone],
  );

  const { session, startDrag, consumedByDrag } = useCalendarDrag({
    resolve,
    onDrop: (appointment, proposal) => onMove(appointment, proposal.start),
    onReject: (_appointment, issue) => onRejectMove(issue),
  });

  const hoveredKey = session?.proposal ? dayKeyIn(session.proposal.start, timezone) : null;
  const hoverIssue = session?.proposal?.issue ?? null;
  const todayKey = dayKeyIn(new Date(), timezone);

  return (
    <div className="nu-month" role="grid" aria-label="Month">
      {DOW.map((name) => (
        <div key={name} className="nu-month__dow" role="columnheader">
          {name}
        </div>
      ))}

      {days.map((day) => {
        const key = dateKey(day);
        const items = byDay.get(key) ?? [];
        const closed = !hoursForDay(workingHours, key)?.isOpen;
        const hovered = hoveredKey === key;

        return (
          <div
            key={key}
            role="gridcell"
            data-cell-day={key}
            className={[
              'nu-month__cell',
              isSameMonth(day, month) ? '' : 'is-outside',
              key === todayKey ? 'is-today' : '',
              closed ? 'is-closed' : '',
              hovered ? (hoverIssue ? 'is-invalid-target' : 'is-target') : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="nu-month__cellhead">
              <button
                type="button"
                className="nu-month__daynum"
                onClick={() => onSelectDay(day)}
                aria-label={`Open ${format(day, 'EEEE d MMMM')}`}
              >
                {format(day, 'd')}
              </button>
              {closed && <span className="nu-month__closed">closed</span>}
            </div>

            {items.slice(0, MAX_CHIPS).map((appointment) => {
              const movable = isMovable(appointment);
              return (
                <button
                  key={appointment._id}
                  type="button"
                  className={[
                    'nu-chip',
                    `nu-chip--${appointment.status}`,
                    movable ? 'is-movable' : '',
                    session?.appointment._id === appointment._id ? 'is-dragging' : '',
                    busyId === appointment._id ? 'is-busy' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onPointerDown={(event) => {
                    if (movable) startDrag(event, appointment, 0);
                  }}
                  onClick={() => {
                    if (consumedByDrag()) return;
                    onSelect(appointment);
                  }}
                  title={`${timeIn(appointment.startAt, timezone)} · ${serviceName(appointment)}`}
                >
                  <span className="nu-chip__time">{timeIn(appointment.startAt, timezone)}</span>
                  <span className="nu-chip__label">
                    {clientOf(appointment)?.fullName ?? 'Client'}
                  </span>
                </button>
              );
            })}

            {items.length > MAX_CHIPS && (
              <button type="button" className="nu-month__more" onClick={() => onSelectDay(day)}>
                +{items.length - MAX_CHIPS} more
              </button>
            )}

            {hovered && hoverIssue && <span className="nu-month__issue">{hoverIssue}</span>}
          </div>
        );
      })}
    </div>
  );
}
