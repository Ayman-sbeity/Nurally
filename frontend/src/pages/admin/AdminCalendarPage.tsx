import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Seo } from '@/components/ui/Seo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { clientOf, serviceName } from '@/components/client/AppointmentCard';
import { useAdminCalendar } from '@/hooks/queries';
import type { Appointment } from '@/types/api';
import { formatTime } from '@/utils/format';

type View = 'day' | 'week' | 'month';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

/** Visible range for each view, expanded to whole weeks for the month grid. */
function rangeFor(view: View, anchor: Date): { start: Date; end: Date } {
  if (view === 'day') return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) };
  if (view === 'week') {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }
  return {
    start: startOfWeek(startOfMonth(anchor)),
    end: addDays(endOfWeek(endOfMonth(anchor)), 1),
  };
}

function AgendaItem({ appointment }: { appointment: Appointment }) {
  const client = clientOf(appointment);
  return (
    <Link to={`/admin/appointments/${appointment._id}`} className="nu-agenda__item">
      <span className="nu-agenda__time">{formatTime(appointment.startAt)}</span>
      <span className="nu-agenda__who">
        <span className="nu-agenda__name">{client?.fullName ?? 'Client'}</span>
        <span className="nu-agenda__service">{serviceName(appointment)}</span>
      </span>
      <StatusBadge status={appointment.status} />
    </Link>
  );
}

export function AdminCalendarPage() {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => new Date());

  const { start, end } = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const { data, isPending, isError, error, refetch } = useAdminCalendar(
    start.toISOString(),
    end.toISOString(),
  );

  const appointments = data?.appointments ?? [];

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = format(new Date(appointment.startAt), 'yyyy-MM-dd');
      const list = map.get(key);
      if (list) list.push(appointment);
      else map.set(key, [appointment]);
    }
    return map;
  }, [appointments]);

  const step = (direction: number) => {
    setAnchor((current) => {
      if (view === 'day') return addDays(current, direction);
      if (view === 'week') return addDays(current, direction * 7);
      return addMonths(current, direction);
    });
  };

  const label =
    view === 'month'
      ? format(anchor, 'MMMM yyyy')
      : view === 'week'
        ? `${format(start, 'd MMM')} – ${format(addDays(end, -1), 'd MMM yyyy')}`
        : format(anchor, 'EEEE, d MMMM yyyy');

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let day = new Date(start); day < end; day = addDays(day, 1)) result.push(new Date(day));
    return result;
  }, [start, end]);

  return (
    <>
      <Seo title="Calendar — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <h1 className="nu-admin-head__title">Calendar</h1>
        <div className="nu-segmented" role="tablist" aria-label="Calendar view">
          {(['day', 'week', 'month'] as View[]).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={view === option}
              onClick={() => setView(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="nu-cal__toolbar">
        <div className="nu-row">
          <Button variant="outline" size="sm" onClick={() => step(-1)} aria-label="Previous period">
            ←
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => step(1)} aria-label="Next period">
            →
          </Button>
        </div>
        <p className="nu-cal__label">{label}</p>
      </div>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && view === 'day' && (
        <div className="nu-agenda">
          {appointments.length === 0 ? (
            <EmptyState title="No appointments on this day" />
          ) : (
            appointments.map((appointment) => (
              <AgendaItem key={appointment._id} appointment={appointment} />
            ))
          )}
        </div>
      )}

      {data && view === 'week' && (
        <div className="nu-cal__week">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const items = byDay.get(key) ?? [];
            return (
              <div key={key} className="nu-cal__daycol">
                <p className="nu-cal__daycol-head">
                  {format(day, 'EEE d')}
                  {isSameDay(day, new Date()) && ' · today'}
                </p>
                {items.length === 0 ? (
                  <p className="nu-hint">—</p>
                ) : (
                  items.map((appointment) => (
                    <Link
                      key={appointment._id}
                      to={`/admin/appointments/${appointment._id}`}
                      className={`nu-cal__chip nu-cal__chip--${appointment.status}`}
                      title={`${formatTime(appointment.startAt)} ${serviceName(appointment)}`}
                    >
                      {formatTime(appointment.startAt)} · {clientOf(appointment)?.fullName ?? 'Client'}
                    </Link>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {data && view === 'month' && (
        <>
          <div className="nu-cal__month">
            {DOW.map((name) => (
              <div key={name} className="nu-cal__dow">
                {name}
              </div>
            ))}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const items = byDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`nu-cal__cell${isSameMonth(day, anchor) ? '' : ' is-outside'}${
                    isSameDay(day, new Date()) ? ' is-today' : ''
                  }`}
                >
                  <span className="nu-cal__daynum">{format(day, 'd')}</span>
                  {items.slice(0, MAX_CHIPS).map((appointment) => (
                    <Link
                      key={appointment._id}
                      to={`/admin/appointments/${appointment._id}`}
                      className={`nu-cal__chip nu-cal__chip--${appointment.status}`}
                    >
                      {formatTime(appointment.startAt)} {clientOf(appointment)?.fullName ?? ''}
                    </Link>
                  ))}
                  {items.length > MAX_CHIPS && (
                    <span className="nu-cal__more">+{items.length - MAX_CHIPS} more</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* A month grid does not work on a phone — the same data as a list. */}
          <div className="nu-cal__month-fallback nu-agenda">
            {appointments.length === 0 ? (
              <EmptyState title="No appointments this month" />
            ) : (
              appointments.map((appointment) => (
                <AgendaItem key={appointment._id} appointment={appointment} />
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}

export default AdminCalendarPage;
