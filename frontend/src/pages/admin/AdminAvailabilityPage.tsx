import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useBlockedPeriods, useBookingSettings, useWorkingHours } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import type { WorkingHours } from '@/types/api';
import { WEEKDAY_NAMES, formatShortDateTime, minutesToTime, timeToMinutes } from '@/utils/format';

const DEFAULT_DAY: Omit<WorkingHours, 'weekday'> = {
  isOpen: false,
  openMinute: 540,
  closeMinute: 1020,
  breaks: [],
};

export function AdminAvailabilityPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [days, setDays] = useState<WorkingHours[]>([]);
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState({ start: '', end: '', reason: '' });

  const hours = useWorkingHours();
  const blocked = useBlockedPeriods();
  const settings = useBookingSettings();

  // Seed the editable copy from the server, filling in any missing weekday.
  useEffect(() => {
    if (!hours.data) return;
    setDays(
      Array.from({ length: 7 }, (_, weekday) => {
        const existing = hours.data.workingHours.find((day) => day.weekday === weekday);
        return existing ?? { weekday, ...DEFAULT_DAY };
      }),
    );
  }, [hours.data]);

  const onError = (error: unknown) =>
    notify(error instanceof ApiRequestError ? error.message : 'That did not work.', 'error');

  const saveHours = useMutation({
    mutationFn: () => adminApi.saveWorkingHours(days),
    onSuccess: () => {
      notify('Working hours saved.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
      void queryClient.invalidateQueries({ queryKey: ['booking-settings'] });
    },
    onError,
  });

  const createBlock = useMutation({
    mutationFn: () =>
      adminApi.createBlockedPeriod({
        startAt: new Date(blockForm.start).toISOString(),
        endAt: new Date(blockForm.end).toISOString(),
        ...(blockForm.reason.trim() ? { reason: blockForm.reason.trim() } : {}),
      }),
    onSuccess: () => {
      setBlockOpen(false);
      setBlockForm({ start: '', end: '', reason: '' });
      notify('Blocked period added.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError,
  });

  const removeBlock = useMutation({
    mutationFn: (id: string) => adminApi.deleteBlockedPeriod(id),
    onSuccess: () => {
      setDeleteId(null);
      notify('Blocked period removed.');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError,
  });

  const patchDay = (weekday: number, patch: Partial<WorkingHours>) => {
    setDays((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  };

  if (hours.isPending) return <LoadingState />;
  if (hours.isError) return <ErrorState error={hours.error} onRetry={() => void hours.refetch()} />;

  return (
    <>
      <Seo title="Availability — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <div>
          <h1 className="nu-admin-head__title">Availability</h1>
          <p className="nu-admin-head__sub">
            Times are interpreted in the lounge timezone
            {settings.data ? ` (${settings.data.timezone})` : ''}.
          </p>
        </div>
      </div>

      <section className="nu-panel" style={{ marginBottom: 'var(--nu-space-5)' }}>
        <div className="nu-panel__head">
          <h2 className="nu-panel__title">Working hours</h2>
          <Button loading={saveHours.isPending} onClick={() => saveHours.mutate()}>
            Save schedule
          </Button>
        </div>
        <div className="nu-panel__body">
          {days.map((day) => (
            <div key={day.weekday} className="nu-hours-row">
              <span className="nu-hours-row__day">{WEEKDAY_NAMES[day.weekday]}</span>

              <label className="nu-checkbox">
                <input
                  type="checkbox"
                  checked={day.isOpen}
                  onChange={(event) => patchDay(day.weekday, { isOpen: event.target.checked })}
                />
                <span>Open</span>
              </label>

              <div className="nu-hours-row__times">
                <label>
                  <span className="nu-sr-only">{WEEKDAY_NAMES[day.weekday]} opening time</span>
                  <input
                    type="time"
                    value={minutesToTime(day.openMinute)}
                    disabled={!day.isOpen}
                    onChange={(event) =>
                      patchDay(day.weekday, { openMinute: timeToMinutes(event.target.value) })
                    }
                  />
                </label>
                <span aria-hidden="true">–</span>
                <label>
                  <span className="nu-sr-only">{WEEKDAY_NAMES[day.weekday]} closing time</span>
                  <input
                    type="time"
                    value={minutesToTime(day.closeMinute)}
                    disabled={!day.isOpen}
                    onChange={(event) =>
                      patchDay(day.weekday, { closeMinute: timeToMinutes(event.target.value) })
                    }
                  />
                </label>

                {day.breaks.map((brk, index) => (
                  <span key={index} className="nu-row" style={{ gap: 'var(--nu-space-2)' }}>
                    <span className="nu-hint">break</span>
                    <input
                      type="time"
                      aria-label="Break start"
                      value={minutesToTime(brk.startMinute)}
                      disabled={!day.isOpen}
                      onChange={(event) =>
                        patchDay(day.weekday, {
                          breaks: day.breaks.map((item, position) =>
                            position === index
                              ? { ...item, startMinute: timeToMinutes(event.target.value) }
                              : item,
                          ),
                        })
                      }
                    />
                    <input
                      type="time"
                      aria-label="Break end"
                      value={minutesToTime(brk.endMinute)}
                      disabled={!day.isOpen}
                      onChange={(event) =>
                        patchDay(day.weekday, {
                          breaks: day.breaks.map((item, position) =>
                            position === index
                              ? { ...item, endMinute: timeToMinutes(event.target.value) }
                              : item,
                          ),
                        })
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        patchDay(day.weekday, {
                          breaks: day.breaks.filter((_, position) => position !== index),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </span>
                ))}

                {day.isOpen && day.breaks.length < 6 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patchDay(day.weekday, {
                        breaks: [...day.breaks, { startMinute: 780, endMinute: 840 }],
                      })
                    }
                  >
                    + Break
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="nu-panel">
        <div className="nu-panel__head">
          <h2 className="nu-panel__title">Blocked periods</h2>
          <Button variant="outline" onClick={() => setBlockOpen(true)}>
            Block a period
          </Button>
        </div>
        <div className="nu-panel__body">
          {blocked.isPending && <LoadingState />}
          {blocked.data && blocked.data.blockedPeriods.length === 0 && (
            <EmptyState
              title="No blocked periods"
              message="Add holidays, days off or closures here."
            />
          )}
          <div className="nu-stack" style={{ gap: 'var(--nu-space-2)' }}>
            {blocked.data?.blockedPeriods.map((period) => (
              <div key={period._id} className="nu-agenda__item" style={{ gridTemplateColumns: '1fr auto' }}>
                <div>
                  <p style={{ fontWeight: 500 }}>
                    {formatShortDateTime(period.startAt)} → {formatShortDateTime(period.endAt)}
                  </p>
                  {period.reason && <p className="nu-hint">{period.reason}</p>}
                </div>
                <Button size="sm" variant="danger" onClick={() => setDeleteId(period._id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Dialog
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        title="Block a period"
        description="No appointments can be booked inside a blocked period."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={createBlock.isPending}
              disabled={!blockForm.start || !blockForm.end}
              onClick={() => createBlock.mutate()}
            >
              Block period
            </Button>
          </>
        }
      >
        <div className="nu-stack">
          <TextField
            label="From"
            type="datetime-local"
            value={blockForm.start}
            onChange={(event) => setBlockForm({ ...blockForm, start: event.target.value })}
          />
          <TextField
            label="To"
            type="datetime-local"
            value={blockForm.end}
            onChange={(event) => setBlockForm({ ...blockForm, end: event.target.value })}
          />
          <TextField
            label="Reason (optional)"
            value={blockForm.reason}
            onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })}
          />
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Remove this blocked period?"
        description="Those times become bookable again."
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={removeBlock.isPending}
        onConfirm={() => deleteId && removeBlock.mutate(deleteId)}
      />
    </>
  );
}

export default AdminAvailabilityPage;
