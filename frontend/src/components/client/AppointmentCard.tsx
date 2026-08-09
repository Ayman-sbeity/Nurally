import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Appointment } from '@/types/api';
import { formatDuration, formatTime, friendlyDay } from '@/utils/format';

/** `client`/`service` may arrive populated or as a bare id. */
export function serviceName(appointment: Appointment): string {
  return typeof appointment.service === 'object'
    ? appointment.service.name
    : appointment.serviceNameSnapshot;
}

export function clientOf(appointment: Appointment) {
  return typeof appointment.client === 'object' ? appointment.client : null;
}

export function AppointmentCard({
  appointment,
  to,
}: {
  appointment: Appointment;
  to?: string;
}) {
  const href = to ?? `/app/appointments/${appointment._id}`;

  return (
    <Link to={href} className="nu-appt">
      <div className="nu-appt__head">
        <h3 className="nu-appt__service">{serviceName(appointment)}</h3>
        <StatusBadge status={appointment.status} />
      </div>

      <div className="nu-appt__when">
        <span className="nu-appt__time">{formatTime(appointment.startAt)}</span>
        <span>{friendlyDay(appointment.startAt)}</span>
        <span>· {formatDuration(appointment.durationMinutes)}</span>
      </div>

      {/* A pending offer is the one thing the client must act on, so it is
          surfaced on the card rather than hidden behind a tap. */}
      {appointment.status === 'TIME_OFFERED' && (
        <p className="nu-hint" style={{ marginTop: 'var(--nu-space-3)' }}>
          A new time has been proposed — open to accept or decline.
        </p>
      )}
    </Link>
  );
}
