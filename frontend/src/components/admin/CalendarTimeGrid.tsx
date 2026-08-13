import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { addDays, format } from 'date-fns';
import { clientOf, serviceName } from '@/components/client/AppointmentCard';
import { useCalendarDrag } from '@/hooks/useCalendarDrag';
import type { Appointment, BlockedPeriod, WorkingHours } from '@/types/api';
import {
  MINUTES_PER_DAY,
  clamp,
  dayKeyIn,
  gridRange,
  hoursForDay,
  instantAt,
  isMovable,
  minuteOfDayIn,
  moveIssue,
  placeDay,
  slotIssue,
  snapToSlot,
  timeIn,
} from '@/utils/calendar';
import { dateKey, minutesToTime } from '@/utils/format';

interface CalendarTimeGridProps {
  days: Date[];
  appointments: Appointment[];
  workingHours: WorkingHours[];
  blockedPeriods: BlockedPeriod[];
  slotMinutes: number;
  /** The lounge's timezone — the clock this grid is drawn against. */
  timezone: string;
  /** Vertical scale. The day view gets more room per hour than the week view. */
  hourHeight: number;
  /** The appointment currently being saved, shown as pending. */
  busyId?: string | null;
  onSelect: (appointment: Appointment) => void;
  onMove: (appointment: Appointment, start: Date) => void;
  onRejectMove: (issue: string) => void;
  onSelectDay?: (day: Date) => void;
  /**
   * Book into an empty patch of the grid. Omitted when the admin may not create
   * appointments, which is also what turns the whole affordance off.
   */
  onCreateAt?: (start: Date) => void;
}

/** Below this height a block only has room for one line. */
const COMPACT_HEIGHT = 34;

/**
 * The day and week views: a real time grid where an appointment's position and
 * height are its actual start and duration, and dragging one changes its time.
 */
export function CalendarTimeGrid({
  days,
  appointments,
  workingHours,
  blockedPeriods,
  slotMinutes,
  timezone,
  hourHeight,
  busyId,
  onSelect,
  onMove,
  onRejectMove,
  onSelectDay,
  onCreateAt,
}: CalendarTimeGridProps) {
  const columnsRef = useRef<HTMLDivElement>(null);
  const pxPerMinute = hourHeight / 60;

  /** The empty slot under the pointer, drawn as a preview of what a click books. */
  const [hover, setHover] = useState<{ key: string; minute: number } | null>(null);

  const keys = useMemo(() => days.map((day) => dateKey(day)), [days]);

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

  const range = useMemo(
    () => gridRange(keys, appointments, workingHours, timezone),
    [keys, appointments, workingHours, timezone],
  );

  const rules = useMemo(
    () => ({ appointments, workingHours, blockedPeriods }),
    [appointments, workingHours, blockedPeriods],
  );

  const columns = useMemo(
    () =>
      days.map((day, index) => {
        const key = keys[index] as string;
        const dayStart = instantAt(key, 0, timezone);
        const dayEnd = instantAt(dateKey(addDays(day, 1)), 0, timezone);

        return {
          day,
          key,
          hours: hoursForDay(workingHours, key),
          placed: placeDay(byDay.get(key) ?? [], timezone),
          count: (byDay.get(key) ?? []).length,
          blocks: blockedPeriods.flatMap((period) => {
            const from = new Date(period.startAt);
            const to = new Date(period.endAt);
            if (!(from < dayEnd && dayStart < to)) return [];
            return [
              {
                period,
                fromMinute: from <= dayStart ? 0 : minuteOfDayIn(from, timezone),
                toMinute: to >= dayEnd ? MINUTES_PER_DAY : minuteOfDayIn(to, timezone),
              },
            ];
          }),
        };
      }),
    [days, keys, byDay, workingHours, blockedPeriods, timezone],
  );

  /** A minute span as an absolutely positioned box, clipped to the grid. */
  const spanStyle = useCallback(
    (fromMinute: number, toMinute: number) => {
      const top = clamp(fromMinute, range.startMinute, range.endMinute) - range.startMinute;
      const bottom = clamp(toMinute, range.startMinute, range.endMinute) - range.startMinute;
      return {
        top: `${top * pxPerMinute}px`,
        height: `${Math.max(bottom - top, 0) * pxPerMinute}px`,
      };
    },
    [range, pxPerMinute],
  );

  const resolve = useCallback(
    (
      point: { x: number; y: number },
      { appointment, grabMinutes }: { appointment: Appointment; grabMinutes: number },
    ) => {
      const element = columnsRef.current;
      if (!element) return null;

      const rect = element.getBoundingClientRect();
      const columnWidth = rect.width / keys.length;
      const index = clamp(Math.floor((point.x - rect.left) / columnWidth), 0, keys.length - 1);
      const key = keys[index];
      if (!key) return null;

      // Slots are generated from the day's opening minute, so snapping has to
      // use the same anchor or a drop lands between two real slots.
      const hours = hoursForDay(workingHours, key);
      const anchor = hours?.isOpen ? hours.openMinute : range.startMinute;
      const raw = range.startMinute + (point.y - rect.top) / pxPerMinute - grabMinutes;
      const minute = clamp(
        snapToSlot(raw, anchor, slotMinutes),
        range.startMinute,
        Math.max(range.startMinute, range.endMinute - appointment.durationMinutes),
      );

      const start = instantAt(key, minute, timezone);
      return { start, issue: moveIssue(appointment, start, rules, timezone) };
    },
    [keys, range, pxPerMinute, slotMinutes, workingHours, rules, timezone],
  );

  const { session, startDrag, consumedByDrag } = useCalendarDrag({
    resolve,
    onDrop: (appointment, proposal) => onMove(appointment, proposal.start),
    onReject: (_appointment, issue) => onRejectMove(issue),
  });

  /**
   * The bookable slot a pointer position falls on, or null where nothing may
   * start — closed hours, a break, a blocked period or another appointment.
   *
   * The probe is one slot long because the treatment is not chosen yet: this
   * only answers "could a booking begin here", and the dialog re-checks the real
   * duration against the server's own slot list once a treatment is picked.
   */
  const emptySlotAt = useCallback(
    (key: string, clientY: number, rect: DOMRect): Date | null => {
      const hours = hoursForDay(workingHours, key);
      const anchor = hours?.isOpen ? hours.openMinute : range.startMinute;
      const raw = range.startMinute + (clientY - rect.top) / pxPerMinute;
      const minute = clamp(
        snapToSlot(raw, anchor, slotMinutes),
        range.startMinute,
        Math.max(range.startMinute, range.endMinute - slotMinutes),
      );

      const start = instantAt(key, minute, timezone);
      return slotIssue({ start, durationMinutes: slotMinutes }, rules, timezone) ? null : start;
    },
    [workingHours, range, pxPerMinute, slotMinutes, rules, timezone],
  );

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    // The closing edge gets no label — there is no hour below it to name.
    for (
      let minute = Math.ceil(range.startMinute / 60) * 60;
      minute < range.endMinute;
      minute += 60
    ) {
      marks.push(minute);
    }
    return marks;
  }, [range]);

  const now = new Date();
  const todayKey = dayKeyIn(now, timezone);
  const nowMinute = minuteOfDayIn(now, timezone);
  const showNow = nowMinute >= range.startMinute && nowMinute <= range.endMinute;

  const ghost = session?.proposal ?? null;
  const ghostIndex = ghost ? keys.indexOf(dayKeyIn(ghost.start, timezone)) : -1;

  return (
    <div
      className="nu-tg"
      style={
        {
          '--tg-hour': `${hourHeight}px`,
          '--tg-cols': days.length,
          '--tg-height': `${(range.endMinute - range.startMinute) * pxPerMinute}px`,
        } as CSSProperties
      }
    >
      <div className="nu-tg__head">
        <div className="nu-tg__corner" aria-hidden="true" />
        {columns.map(({ day, key, count }) => (
          <button
            key={key}
            type="button"
            className={`nu-tg__dayhead${key === todayKey ? ' is-today' : ''}`}
            onClick={() => onSelectDay?.(day)}
            aria-label={`${format(day, 'EEEE d MMMM')} — ${count} appointment${
              count === 1 ? '' : 's'
            }`}
          >
            <span className="nu-tg__dow">{format(day, 'EEE')}</span>
            <span className="nu-tg__daynum">{format(day, 'd')}</span>
            {count > 0 && <span className="nu-tg__daycount">{count}</span>}
          </button>
        ))}
      </div>

      <div className="nu-tg__body">
        <div className="nu-tg__gutter" aria-hidden="true">
          {hourMarks.map((minute) => (
            <span
              key={minute}
              className="nu-tg__hour"
              style={{ top: `${(minute - range.startMinute) * pxPerMinute}px` }}
            >
              {minutesToTime(minute % MINUTES_PER_DAY)}
            </span>
          ))}
        </div>

        <div className="nu-tg__cols" ref={columnsRef}>
          {columns.map(({ key, hours, placed, blocks }) => (
            <div
              key={key}
              className={[
                'nu-tg__col',
                key === todayKey ? 'is-today' : '',
                onCreateAt ? 'is-creatable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onPointerMove={
                onCreateAt &&
                ((event) => {
                  // A drag already owns the pointer; two ghosts would compete.
                  if (session) return;
                  const start = emptySlotAt(
                    key,
                    event.clientY,
                    event.currentTarget.getBoundingClientRect(),
                  );
                  const next = start ? { key, minute: minuteOfDayIn(start, timezone) } : null;
                  // Pointer moves arrive continuously; only a changed slot is
                  // worth re-rendering the grid for.
                  setHover((current) =>
                    current?.key === next?.key && current?.minute === next?.minute ? current : next,
                  );
                })
              }
              onPointerLeave={
                onCreateAt &&
                (() => setHover((current) => (current?.key === key ? null : current)))
              }
              onClick={
                onCreateAt &&
                ((event) => {
                  if (consumedByDrag()) return;
                  // Clicks on an appointment are its own — opening the booking
                  // form over the card the admin meant to read would be wrong.
                  if ((event.target as HTMLElement).closest('.nu-tg__event')) return;
                  const start = emptySlotAt(
                    key,
                    event.clientY,
                    event.currentTarget.getBoundingClientRect(),
                  );
                  if (start) onCreateAt(start);
                })
              }
            >
              {!hours?.isOpen && <div className="nu-tg__closed" title="Closed" />}

              {hours?.isOpen && (
                <>
                  <div
                    className="nu-tg__closed"
                    style={spanStyle(range.startMinute, hours.openMinute)}
                  />
                  <div
                    className="nu-tg__closed"
                    style={spanStyle(hours.closeMinute, range.endMinute)}
                  />
                  {hours.breaks.map((brk) => (
                    <div
                      key={`${brk.startMinute}-${brk.endMinute}`}
                      className="nu-tg__break"
                      style={spanStyle(brk.startMinute, brk.endMinute)}
                      title={`Break ${minutesToTime(brk.startMinute)}–${minutesToTime(
                        brk.endMinute,
                      )}`}
                    />
                  ))}
                </>
              )}

              {blocks.map(({ period, fromMinute, toMinute }) => (
                <div
                  key={period._id}
                  className="nu-tg__block"
                  style={spanStyle(fromMinute, toMinute)}
                  title={period.reason ? `Blocked — ${period.reason}` : 'Blocked'}
                >
                  <span>{period.reason ?? 'Blocked'}</span>
                </div>
              ))}

              {placed.map(({ appointment, startMinute, endMinute, lane, laneCount }) => {
                const client = clientOf(appointment);
                const height = Math.max((endMinute - startMinute) * pxPerMinute, 18);
                const movable = isMovable(appointment);

                return (
                  <button
                    key={appointment._id}
                    type="button"
                    className={[
                      'nu-tg__event',
                      `nu-tg__event--${appointment.status}`,
                      movable ? 'is-movable' : 'is-locked',
                      session?.appointment._id === appointment._id ? 'is-dragging' : '',
                      busyId === appointment._id ? 'is-busy' : '',
                      height < COMPACT_HEIGHT ? 'is-compact' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{
                      top: `${(startMinute - range.startMinute) * pxPerMinute}px`,
                      height: `${height}px`,
                      left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                      width: `calc(${100 / laneCount}% - 4px)`,
                    }}
                    onPointerDown={(event) => {
                      if (!movable) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      startDrag(event, appointment, (event.clientY - rect.top) / pxPerMinute);
                    }}
                    onClick={() => {
                      if (consumedByDrag()) return;
                      onSelect(appointment);
                    }}
                    aria-label={`${timeIn(appointment.startAt, timezone)} ${
                      client?.fullName ?? 'Client'
                    }, ${serviceName(appointment)}`}
                  >
                    <span className="nu-tg__event-time">
                      {timeIn(appointment.startAt, timezone)}
                      <span className="nu-tg__event-end">
                        {' '}
                        – {timeIn(appointment.endAt, timezone)}
                      </span>
                    </span>
                    <span className="nu-tg__event-name">{client?.fullName ?? 'Client'}</span>
                    <span className="nu-tg__event-service">{serviceName(appointment)}</span>
                  </button>
                );
              })}

              {hover?.key === key && !session && (
                <div
                  className="nu-tg__new"
                  style={spanStyle(hover.minute, hover.minute + slotMinutes)}
                  aria-hidden="true"
                >
                  <span>+ {minutesToTime(hover.minute % MINUTES_PER_DAY)}</span>
                </div>
              )}

              {key === todayKey && showNow && (
                <div
                  className="nu-tg__now"
                  style={{ top: `${(nowMinute - range.startMinute) * pxPerMinute}px` }}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}

          {ghost && session && ghostIndex >= 0 && (
            <div
              className={`nu-tg__ghost${ghost.issue ? ' is-invalid' : ''}`}
              style={{
                top: `${(minuteOfDayIn(ghost.start, timezone) - range.startMinute) * pxPerMinute}px`,
                height: `${session.appointment.durationMinutes * pxPerMinute}px`,
                left: `calc(${(ghostIndex / keys.length) * 100}% + 2px)`,
                width: `calc(${100 / keys.length}% - 4px)`,
              }}
              aria-hidden="true"
            >
              <span className="nu-tg__ghost-time">
                {formatGhost(ghost.start, timezone)}
              </span>
              {ghost.issue && <span className="nu-tg__ghost-issue">{ghost.issue}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const formatGhost = (start: Date, timezone: string): string =>
  `${format(new Date(`${dayKeyIn(start, timezone)}T00:00:00`), 'EEE d')} · ${timeIn(
    start,
    timezone,
  )}`;
