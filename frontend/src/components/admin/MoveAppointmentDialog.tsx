import { useState } from 'react';
import { addMinutes } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextAreaField } from '@/components/ui/Field';
import { clientOf, serviceName } from '@/components/client/AppointmentCard';
import type { Appointment } from '@/types/api';
import { moveKindFor, stampIn, timeIn } from '@/utils/calendar';
import { formatDuration } from '@/utils/format';

interface MoveAppointmentDialogProps {
  appointment: Appointment;
  start: Date;
  timezone: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (message?: string) => void;
}

/**
 * Confirms a drag before it is written.
 *
 * A move is not a silent UI change — it notifies the client, and for anything
 * not yet confirmed it becomes an offer they still have to accept. The dialog
 * says which of the two is about to happen.
 */
export function MoveAppointmentDialog({
  appointment,
  start,
  timezone,
  loading,
  onClose,
  onConfirm,
}: MoveAppointmentDialogProps) {
  const [message, setMessage] = useState('');
  const kind = moveKindFor(appointment);
  const client = clientOf(appointment);

  return (
    <Dialog
      open
      onClose={onClose}
      title={kind === 'reschedule' ? 'Move this appointment?' : 'Offer this new time?'}
      description={
        kind === 'reschedule'
          ? 'The appointment moves straight away and the client is notified.'
          : 'This appointment is not confirmed yet, so the new time is sent to the client as an offer. The slot is held until they answer.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep current time
          </Button>
          <Button loading={loading} onClick={() => onConfirm(message.trim() || undefined)}>
            {kind === 'reschedule' ? 'Move appointment' : 'Send new time'}
          </Button>
        </>
      }
    >
      <div className="nu-stack">
        <div className="nu-movecard">
          <p className="nu-movecard__who">{client?.fullName ?? 'Client'}</p>
          <p className="nu-movecard__what">
            {serviceName(appointment)} · {formatDuration(appointment.durationMinutes)}
          </p>
          <div className="nu-movecard__times">
            <span className="nu-movecard__from">{stampIn(appointment.startAt, timezone)}</span>
            <span className="nu-movecard__arrow" aria-hidden="true">
              →
            </span>
            <span className="nu-movecard__to">
              {stampIn(start, timezone)}
              <span className="nu-movecard__until">
                {' '}
                – {timeIn(addMinutes(start, appointment.durationMinutes), timezone)}
              </span>
            </span>
          </div>
        </div>

        <TextAreaField
          label="Message to the client (optional)"
          value={message}
          maxLength={500}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
