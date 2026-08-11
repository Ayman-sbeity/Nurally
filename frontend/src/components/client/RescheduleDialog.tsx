import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingApi } from '@/api/booking.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextAreaField } from '@/components/ui/Field';
import { DateStep } from '@/components/booking/DateStep';
import { TimeStep } from '@/components/booking/TimeStep';
import { useToast } from '@/context/ToastContext';
import { qk } from '@/hooks/queries';
import type { Appointment } from '@/types/api';
import { formatDateTime } from '@/utils/format';

interface RescheduleDialogProps {
  appointment: Appointment;
  open: boolean;
  onClose: () => void;
}

/** `service` arrives populated on the detail endpoint, but may be a bare id. */
function serviceIdOf(appointment: Appointment): string | null {
  if (typeof appointment.service === 'object' && appointment.service) return appointment.service._id;
  return typeof appointment.service === 'string' ? appointment.service : null;
}

/**
 * Lets a client propose a different time for an existing appointment.
 *
 * The backend and `bookingApi.requestReschedule` have always supported this —
 * there was simply no way to reach it, so the only route to a different time
 * was to cancel and rebook, which releases the slot and loses the request's
 * history. The same date and time pickers as the booking flow are reused, so
 * availability, the lounge timezone and the disabled-day logic behave
 * identically in both places.
 */
export function RescheduleDialog({ appointment, open, onClose }: RescheduleDialogProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const serviceId = serviceIdOf(appointment);

  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Reopening after a cancelled attempt should not resume the abandoned one.
  useEffect(() => {
    if (!open) {
      setDate(null);
      setSlot(null);
      setMessage('');
    }
  }, [open]);

  const submit = useMutation({
    mutationFn: () =>
      bookingApi.requestReschedule(appointment._id, {
        proposedStartAt: slot as string,
        ...(message.trim() ? { message: message.trim() } : {}),
      }),
    onSuccess: () => {
      notify('Your reschedule request has been sent to the lounge.', 'success');
      void queryClient.invalidateQueries({ queryKey: qk.appointment(appointment._id) });
      void queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
      void queryClient.invalidateQueries({ queryKey: qk.notifications });
      onClose();
    },
    onError: (error) => {
      notify(
        error instanceof ApiRequestError
          ? error.message
          : 'That reschedule request could not be sent.',
        'error',
      );
    },
  });

  if (!serviceId) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request a different time"
      description="Your current appointment is held until the lounge responds, so you will not lose it by asking."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep current time
          </Button>
          <Button disabled={!slot} loading={submit.isPending} onClick={() => submit.mutate()}>
            Send request
          </Button>
        </>
      }
    >
      <div className="nu-stack" style={{ gap: 'var(--nu-space-5)' }}>
        <div className="nu-summary">
          <div className="nu-summary__row">
            <span className="nu-summary__label">Current time</span>
            <span className="nu-summary__value">{formatDateTime(appointment.startAt)}</span>
          </div>
          {slot && (
            <div className="nu-summary__row">
              <span className="nu-summary__label">You are proposing</span>
              <span className="nu-summary__value">{formatDateTime(slot)}</span>
            </div>
          )}
        </div>

        {!date && (
          <DateStep
            serviceId={serviceId}
            selectedDate={date}
            onSelect={(selected) => {
              setDate(selected);
              setSlot(null);
            }}
          />
        )}

        {date && (
          <TimeStep
            serviceId={serviceId}
            date={date}
            selectedSlot={slot}
            onChangeDate={() => {
              setDate(null);
              setSlot(null);
            }}
            onSelect={setSlot}
          />
        )}

        <TextAreaField
          label="Add a message (optional)"
          value={message}
          maxLength={500}
          onChange={(event) => setMessage(event.target.value)}
          hint="Let the lounge know why, or offer another time that would work."
        />
      </div>
    </Dialog>
  );
}
