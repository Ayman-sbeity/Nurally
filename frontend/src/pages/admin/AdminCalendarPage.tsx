import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addDays,
  addMinutes,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { AppointmentPeek } from '@/components/admin/AppointmentPeek';
import { CalendarMonthGrid } from '@/components/admin/CalendarMonthGrid';
import { CalendarTimeGrid } from '@/components/admin/CalendarTimeGrid';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { CreateAppointmentDialog } from '@/components/admin/CreateAppointmentDialog';
import { MoveAppointmentDialog } from '@/components/admin/MoveAppointmentDialog';
import { SlotPickerDialog } from '@/components/admin/SlotPickerDialog';
import { Button } from '@/components/ui/Button';
import { Seo } from '@/components/ui/Seo';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  qk,
  useAdminCalendar,
  useBlockedPeriods,
  useBookingSettings,
  useWorkingHours,
} from '@/hooks/queries';
import type { Appointment, AppointmentStatus } from '@/types/api';
import { dayKeyIn, deviceZone, instantAt, moveKindFor, todayInZone } from '@/utils/calendar';
import { STATUS_LABEL, dateKey } from '@/utils/format';

type View = 'day' | 'week' | 'month';

const VIEWS: View[] = ['day', 'week', 'month'];
const HOUR_HEIGHT: Record<Exclude<View, 'month'>, number> = { day: 96, week: 60 };

/** Visible range per view, expanded to whole weeks for the month grid. */
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

interface MoveVars {
  appointment: Appointment;
  startAt: string;
  message?: string;
}

export function AdminCalendarPage() {
  const { can } = usePermissions();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [pendingMove, setPendingMove] = useState<{ appointment: Appointment; start: Date } | null>(
    null,
  );
  const [pickTimeFor, setPickTimeFor] = useState<Appointment | null>(null);
  const [cancelFor, setCancelFor] = useState<Appointment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  /** Set when the booking form was opened by clicking a slot, not the button. */
  const [createAt, setCreateAt] = useState<Date | null>(null);

  const queryClient = useQueryClient();
  const { notify } = useToast();

  const settings = useBookingSettings();
  /**
   * The lounge's clock, not the device's: opening hours, the slot ladder and
   * every rule the server enforces are wall-clock facts about the salon.
   */
  const timezone = settings.data?.timezone ?? deviceZone();

  const { start, end } = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const fromIso = instantAt(dateKey(start), 0, timezone).toISOString();
  const toIso = instantAt(dateKey(end), 0, timezone).toISOString();

  const calendar = useAdminCalendar(fromIso, toIso);
  const hours = useWorkingHours();
  const blocked = useBlockedPeriods({ from: fromIso, to: toIso });

  const appointments = useMemo(() => calendar.data?.appointments ?? [], [calendar.data]);
  const workingHours = hours.data?.workingHours ?? [];
  const blockedPeriods = blocked.data?.blockedPeriods ?? [];
  const slotMinutes = settings.data?.slotGranularityMinutes ?? 15;

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let day = new Date(start); day < end; day = addDays(day, 1)) result.push(new Date(day));
    return result;
  }, [start, end]);

  const step = useCallback(
    (direction: number) =>
      setAnchor((current) => {
        if (view === 'day') return addDays(current, direction);
        if (view === 'week') return addDays(current, direction * 7);
        return addMonths(current, direction);
      }),
    [view],
  );

  const dialogOpen = Boolean(
    selected || pendingMove || pickTimeFor || cancelFor || createOpen || createAt,
  );

  // Calendar keyboard shortcuts, off while a dialog or a text field has focus.
  useEffect(() => {
    if (dialogOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      const shortcut: Record<string, () => void> = {
        arrowleft: () => step(-1),
        arrowright: () => step(1),
        t: () => setAnchor(todayInZone(timezone)),
        d: () => setView('day'),
        w: () => setView('week'),
        m: () => setView('month'),
      };
      const action = shortcut[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      action();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialogOpen, step, timezone]);

  const onApiError = (error: unknown) =>
    notify(
      error instanceof ApiRequestError ? error.message : 'That action could not be completed.',
      'error',
    );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
    void queryClient.invalidateQueries({ queryKey: ['availability'] });
  };

  /**
   * One mutation covers both routes a move can take: a confirmed appointment is
   * rescheduled outright, anything else is offered to the client. The calendar
   * is updated optimistically so a dropped appointment does not spring back to
   * its old slot while the request is in flight.
   */
  const move = useMutation({
    mutationFn: ({ appointment, startAt, message }: MoveVars) => {
      const payload = { startAt, ...(message ? { message } : {}) };
      return moveKindFor(appointment) === 'reschedule'
        ? adminApi.reschedule(appointment._id, payload)
        : adminApi.offerTime(appointment._id, payload);
    },
    onMutate: async ({ appointment, startAt }: MoveVars) => {
      const key = qk.adminCalendar(fromIso, toIso);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ appointments: Appointment[] }>(key);

      queryClient.setQueryData<{ appointments: Appointment[] }>(key, (current) =>
        current
          ? {
              appointments: current.appointments.map((item) =>
                item._id === appointment._id
                  ? {
                      ...item,
                      startAt,
                      endAt: addMinutes(new Date(startAt), item.durationMinutes).toISOString(),
                    }
                  : item,
              ),
            }
          : current,
      );

      return { key, previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
      onApiError(error);
    },
    onSuccess: (_data, { appointment }) => {
      notify(
        moveKindFor(appointment) === 'reschedule'
          ? 'Appointment moved. The client has been notified.'
          : 'New time offered to the client.',
        'success',
      );
      setPendingMove(null);
      setPickTimeFor(null);
      setSelected(null);
    },
    onSettled: refresh,
  });

  const approve = useMutation({
    mutationFn: (appointment: Appointment) => adminApi.approve(appointment._id),
    onSuccess: () => {
      notify('Appointment confirmed.', 'success');
      setSelected(null);
      refresh();
    },
    onError: onApiError,
  });

  const cancel = useMutation({
    mutationFn: ({ appointment, reason }: { appointment: Appointment; reason?: string }) =>
      adminApi.cancel(appointment._id, reason),
    onSuccess: () => {
      notify('Appointment cancelled.', 'success');
      setCancelFor(null);
      setSelected(null);
      refresh();
    },
    onError: onApiError,
  });

  const openDay = (day: Date) => {
    setAnchor(day);
    setView('day');
  };

  const label =
    view === 'month'
      ? format(anchor, 'MMMM yyyy')
      : view === 'week'
        ? `${format(start, 'd MMM')} – ${format(addDays(end, -1), 'd MMM yyyy')}`
        : format(anchor, 'EEEE, d MMMM yyyy');

  const counts = useMemo(() => {
    const tally = new Map<AppointmentStatus, number>();
    for (const appointment of appointments) {
      tally.set(appointment.status, (tally.get(appointment.status) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]);
  }, [appointments]);

  const pendingCount = appointments.filter(
    (appointment) => appointment.status === 'PENDING',
  ).length;

  const localZone = deviceZone();
  const zonesDiffer = Boolean(settings.data && settings.data.timezone !== localZone);

  const busyId = move.isPending ? move.variables?.appointment._id : null;

  return (
    <>
      <Seo title="Calendar — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <div>
          <h1 className="nu-admin-head__title">Calendar</h1>
          <p className="nu-admin-head__sub">
            {appointments.length} appointment{appointments.length === 1 ? '' : 's'} in view
            {pendingCount > 0 && ` · ${pendingCount} awaiting approval`}
          </p>
        </div>
        <div className="nu-row nu-row--wrap">
          <div className="nu-segmented" role="tablist" aria-label="Calendar view">
            {VIEWS.map((option) => (
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
          {can('APPOINTMENTS', 'CREATE') && (
            <Button onClick={() => setCreateOpen(true)}>Book appointment</Button>
          )}
        </div>
      </div>

      {/* Opens on the day being viewed — the usual reason to book from here is
          the gap the admin is looking at. Clicking the gap itself carries the
          time along too, so the slot list opens on the moment they pointed at. */}
      {(createOpen || createAt) && (
        <CreateAppointmentDialog
          defaultDate={createAt ? dayKeyIn(createAt, timezone) : dateKey(anchor)}
          {...(createAt ? { defaultStartAt: createAt.toISOString() } : {})}
          timezone={timezone}
          onClose={() => {
            setCreateOpen(false);
            setCreateAt(null);
          }}
        />
      )}

      <div className="nu-cal">
        <div className="nu-cal__toolbar">
          <div className="nu-cal__nav">
            <Button variant="outline" size="sm" onClick={() => step(-1)} aria-label="Previous period">
              ←
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(todayInZone(timezone))}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => step(1)} aria-label="Next period">
              →
            </Button>
          </div>

          <p className="nu-cal__label">{label}</p>

          <ul className="nu-cal__legend">
            {counts.map(([status, count]) => (
              <li key={status} className={`nu-cal__legenditem nu-cal__legenditem--${status}`}>
                <span aria-hidden="true" className="nu-cal__swatch" />
                {STATUS_LABEL[status]} · {count}
              </li>
            ))}
          </ul>
        </div>

        {zonesDiffer && (
          <div className="nu-notice nu-notice--info" role="status">
            Times are shown in the lounge timezone ({timezone}). This device is on {localZone}.
          </div>
        )}

        {calendar.isPending && <LoadingState />}
        {calendar.isError && (
          <ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} />
        )}

        {calendar.data && (
          <>
            <div className="nu-cal__scroller">
              {view === 'month' ? (
                <CalendarMonthGrid
                  days={days}
                  month={anchor}
                  appointments={appointments}
                  workingHours={workingHours}
                  blockedPeriods={blockedPeriods}
                  timezone={timezone}
                  busyId={busyId}
                  onSelect={setSelected}
                  onMove={(appointment, nextStart) =>
                    setPendingMove({ appointment, start: nextStart })
                  }
                  onRejectMove={(issue) => notify(issue, 'error')}
                  onSelectDay={openDay}
                />
              ) : (
                <CalendarTimeGrid
                  days={days}
                  appointments={appointments}
                  workingHours={workingHours}
                  blockedPeriods={blockedPeriods}
                  slotMinutes={slotMinutes}
                  timezone={timezone}
                  hourHeight={HOUR_HEIGHT[view]}
                  busyId={busyId}
                  onSelect={setSelected}
                  onMove={(appointment, nextStart) =>
                    setPendingMove({ appointment, start: nextStart })
                  }
                  onRejectMove={(issue) => notify(issue, 'error')}
                  onSelectDay={openDay}
                  {...(can('APPOINTMENTS', 'CREATE') ? { onCreateAt: setCreateAt } : {})}
                />
              )}
            </div>

            <p className="nu-cal__hint">
              {can('APPOINTMENTS', 'CREATE') && 'Click a free slot to book into it. '}
              Drag an appointment to move it, or click it for the full card. Arrow keys change
              period · T today · D/W/M change view.
            </p>
          </>
        )}
      </div>

      {selected && (
        <AppointmentPeek
          appointment={selected}
          timezone={timezone}
          approving={approve.isPending}
          onClose={() => setSelected(null)}
          onApprove={() => approve.mutate(selected)}
          onPickTime={() => {
            setPickTimeFor(selected);
            setSelected(null);
          }}
          onCancel={() => {
            setCancelFor(selected);
            setSelected(null);
          }}
        />
      )}

      {pendingMove && (
        <MoveAppointmentDialog
          appointment={pendingMove.appointment}
          start={pendingMove.start}
          timezone={timezone}
          loading={move.isPending}
          onClose={() => setPendingMove(null)}
          onConfirm={(message) =>
            move.mutate({
              appointment: pendingMove.appointment,
              startAt: pendingMove.start.toISOString(),
              ...(message ? { message } : {}),
            })
          }
        />
      )}

      {pickTimeFor && (
        <SlotPickerDialog
          open
          onClose={() => setPickTimeFor(null)}
          title={
            moveKindFor(pickTimeFor) === 'reschedule' ? 'Move appointment' : 'Offer another time'
          }
          description={
            moveKindFor(pickTimeFor) === 'reschedule'
              ? 'Moves this confirmed appointment directly. The client is notified.'
              : 'The client can accept or decline. The chosen slot is held until they respond.'
          }
          confirmLabel={
            moveKindFor(pickTimeFor) === 'reschedule' ? 'Move appointment' : 'Send offer'
          }
          serviceId={
            typeof pickTimeFor.service === 'object' ? pickTimeFor.service._id : pickTimeFor.service
          }
          loading={move.isPending}
          onConfirm={(startAt, message) =>
            move.mutate({ appointment: pickTimeFor, startAt, ...(message ? { message } : {}) })
          }
        />
      )}

      {cancelFor && (
        <ConfirmDialog
          open
          onClose={() => setCancelFor(null)}
          title="Cancel this appointment?"
          description="The client is notified and the time is released for other bookings."
          confirmLabel="Cancel appointment"
          confirmVariant="danger"
          withReason
          loading={cancel.isPending}
          onConfirm={(reason) => cancel.mutate({ appointment: cancelFor, reason })}
        />
      )}
    </>
  );
}

export default AdminCalendarPage;
