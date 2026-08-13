import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useAdminAvailability, useServices } from '@/hooks/queries';
import type { Appointment } from '@/types/api';
import { dateKey, formatDayLabel, formatDuration } from '@/utils/format';

interface EditAppointmentDialogProps {
  appointment: Appointment;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Corrects a booking that was taken down wrong — the wrong treatment, the wrong
 * hour, a note in the wrong box.
 *
 * Distinct from *Reschedule*, which announces a move to the client and is the
 * right tool when the lounge changes its mind. This one is for fixing the
 * record, so it leaves the status alone and only notifies the client when
 * something they would turn up for actually changed.
 *
 * Times come from the same availability engine the booking flow uses, so a
 * correction cannot land on a closed day or on top of another appointment.
 */
export function EditAppointmentDialog({
  appointment,
  onClose,
  onSaved,
}: EditAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const currentServiceId =
    typeof appointment.service === 'string' ? appointment.service : appointment.service._id;

  const [serviceId, setServiceId] = useState(currentServiceId);
  const [date, setDate] = useState(() => dateKey(new Date(appointment.startAt)));
  const [slot, setSlot] = useState<string | null>(appointment.startAt);
  const [clientNotes, setClientNotes] = useState(appointment.clientNotes ?? '');
  const [adminNotes, setAdminNotes] = useState(appointment.adminNotes ?? '');

  const services = useServices();
  const availability = useAdminAvailability(serviceId || undefined, date);

  const categories = services.data?.categories ?? [];
  const service = useMemo(
    () => services.data?.services.find((entry) => entry._id === serviceId),
    [services.data, serviceId],
  );

  const save = useMutation({
    mutationFn: () =>
      adminApi.editAppointment(appointment._id, {
        ...(serviceId !== currentServiceId ? { serviceId } : {}),
        ...(slot && slot !== appointment.startAt ? { startAt: slot } : {}),
        clientNotes: clientNotes.trim(),
        adminNotes: adminNotes.trim(),
      }),
    onSuccess: () => {
      notify('Appointment updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
      onSaved();
      onClose();
    },
    onError: (error) => {
      notify(
        error instanceof ApiRequestError ? error.message : 'This appointment could not be updated.',
        'error',
      );
      // The slot list is now suspect — refetch before they try again.
      void availability.refetch();
    },
  });

  /**
   * The appointment's own time is not in the availability list (its cells are
   * held by itself), so it is offered explicitly. Without it, opening the
   * dialog and saving a note would silently move the appointment.
   */
  const slots = useMemo(() => {
    const options = availability.data?.slots ?? [];
    const keepsCurrent =
      serviceId === currentServiceId && dateKey(new Date(appointment.startAt)) === date;
    if (!keepsCurrent || options.some((option) => option.startAt === appointment.startAt)) {
      return options;
    }
    return [
      {
        startAt: appointment.startAt,
        label: `${new Date(appointment.startAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })} (current)`,
      },
      ...options,
    ];
  }, [availability.data, appointment.startAt, serviceId, currentServiceId, date]);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit appointment"
      description="Corrects the booking without changing its status. The client is told only if the treatment or time changes."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button disabled={!slot} loading={save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="nu-stack">
        <SelectField
          label="Treatment"
          value={serviceId}
          onChange={(event) => {
            setServiceId(event.target.value);
            setSlot(null);
          }}
          hint={service ? formatDuration(service.durationMinutes) : undefined}
        >
          {categories.map((category) => (
            <optgroup key={category.slug} label={category.label}>
              {category.services.map((entry) => (
                <option key={entry._id} value={entry._id}>
                  {entry.name}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>

        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setSlot(null);
          }}
        />

        <div>
          <p className="nu-label" style={{ marginBottom: 'var(--nu-space-2)' }}>
            Time — {formatDayLabel(`${date}T00:00:00`)}
          </p>

          {availability.isFetching && <LoadingState label="Checking availability…" />}

          {!availability.isFetching && slots.length === 0 && (
            <div className="nu-notice nu-notice--warn" role="status">
              Nothing is free on this date. Choose another day.
            </div>
          )}

          {!availability.isFetching && slots.length > 0 && (
            <div className="nu-slots" role="group" aria-label="Choose a time">
              {slots.map((option) => (
                <button
                  key={option.startAt}
                  type="button"
                  className="nu-slot"
                  aria-pressed={slot === option.startAt}
                  onClick={() => setSlot(option.startAt)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <TextAreaField
          label="Booking notes"
          value={clientNotes}
          maxLength={1000}
          rows={2}
          onChange={(event) => setClientNotes(event.target.value)}
          hint="What the client asked for."
        />
        <TextAreaField
          label="Internal notes"
          value={adminNotes}
          maxLength={1000}
          rows={2}
          onChange={(event) => setAdminNotes(event.target.value)}
          hint="Only the lounge sees these."
        />
      </div>
    </Dialog>
  );
}
