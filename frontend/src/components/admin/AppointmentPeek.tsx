import { Button, ButtonLink } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { clientOf, serviceName } from '@/components/client/AppointmentCard';
import type { Appointment } from '@/types/api';
import { dateTimeIn, isMovable, moveKindFor, timeIn } from '@/utils/calendar';
import { formatDuration } from '@/utils/format';

interface AppointmentPeekProps {
  appointment: Appointment;
  timezone: string;
  approving?: boolean;
  onClose: () => void;
  onApprove: () => void;
  onPickTime: () => void;
  onCancel: () => void;
}

/**
 * What opens when an appointment is clicked: the whole booking at a glance and
 * the actions an admin actually takes from a calendar. Anything deeper lives on
 * the appointment record itself.
 *
 * This is also the keyboard and touch route to a move — the drag is the fast
 * path, never the only one.
 */
export function AppointmentPeek({
  appointment,
  timezone,
  approving,
  onClose,
  onApprove,
  onPickTime,
  onCancel,
}: AppointmentPeekProps) {
  const client = clientOf(appointment);
  const movable = isMovable(appointment);
  const closed = ['COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'].includes(appointment.status);

  return (
    <Dialog open onClose={onClose} title={client?.fullName ?? 'Appointment'}>
      <div className="nu-stack">
        <div className="nu-peek__head">
          <StatusBadge status={appointment.status} />
          <span className="nu-peek__duration">{formatDuration(appointment.durationMinutes)}</span>
        </div>

        <dl className="nu-deflist">
          <div className="nu-deflist__row">
            <dt className="nu-deflist__key">Treatment</dt>
            <dd>{serviceName(appointment)}</dd>
          </div>
          <div className="nu-deflist__row">
            <dt className="nu-deflist__key">When</dt>
            <dd>
              {dateTimeIn(appointment.startAt, timezone)} – {timeIn(appointment.endAt, timezone)}
            </dd>
          </div>
          {client?.phone && (
            <div className="nu-deflist__row">
              <dt className="nu-deflist__key">Phone</dt>
              <dd>
                <a className="nu-link" href={`tel:${client.phone.replace(/\s/g, '')}`}>
                  {client.phone}
                </a>
              </dd>
            </div>
          )}
          {client?.email && (
            <div className="nu-deflist__row">
              <dt className="nu-deflist__key">Email</dt>
              <dd>
                <a className="nu-link" href={`mailto:${client.email}`}>
                  {client.email}
                </a>
              </dd>
            </div>
          )}
          {appointment.clientNotes && (
            <div className="nu-deflist__row">
              <dt className="nu-deflist__key">Notes</dt>
              <dd>{appointment.clientNotes}</dd>
            </div>
          )}
        </dl>

        <div className="nu-actions">
          {appointment.status === 'PENDING' && (
            <Button size="sm" loading={approving} onClick={onApprove}>
              Approve
            </Button>
          )}
          {movable && (
            <Button size="sm" variant="outline" onClick={onPickTime}>
              {moveKindFor(appointment) === 'reschedule' ? 'Pick a new time' : 'Offer another time'}
            </Button>
          )}
          <ButtonLink to={`/admin/appointments/${appointment._id}`} variant="ghost" size="sm">
            Open record
          </ButtonLink>
          {movable && (
            <Button size="sm" variant="danger" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        {closed ? (
          <p className="nu-hint">This appointment is closed and can no longer be moved.</p>
        ) : (
          <p className="nu-hint nu-peek__tip">
            Tip: drag an appointment on the calendar to move it to another time.
          </p>
        )}
      </div>
    </Dialog>
  );
}
