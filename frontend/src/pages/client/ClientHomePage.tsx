import { Link } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AppointmentCard, serviceName } from '@/components/client/AppointmentCard';
import { useAuth } from '@/context/AuthContext';
import { useMyAppointments, useNotifications } from '@/hooks/queries';
import { STATUS_EXPLANATION, formatDateTime, formatDuration, timeUntil } from '@/utils/format';

export function ClientHomePage() {
  const { user } = useAuth();
  const upcoming = useMyAppointments({ scope: 'upcoming', limit: 5 });
  const past = useMyAppointments({ scope: 'past', limit: 3 });
  const { data: notifications } = useNotifications();

  const next = upcoming.data?.items[0];
  const rest = upcoming.data?.items.slice(1) ?? [];
  const unread = notifications?.unreadCount ?? 0;

  return (
    <>
      <Seo title="Your appointments — Nurella" noIndex />

      <div className="nu-page-head">
        <h1 className="nu-page-head__title">
          Hello, {user?.fullName.split(' ')[0] ?? 'there'}
        </h1>
        <p className="nu-page-head__sub">Your appointments at Nurella Beauty Lounge.</p>
      </div>

      <div className="nu-stack" style={{ gap: 'var(--nu-space-6)' }}>
        {unread > 0 && (
          <Link to="/app/notifications" className="nu-notice nu-notice--info">
            You have {unread} unread update{unread === 1 ? '' : 's'}.
          </Link>
        )}

        <section aria-labelledby="next-heading">
          <h2 id="next-heading" className="nu-sr-only">
            Your next appointment
          </h2>

          {upcoming.isPending && <SkeletonList rows={1} height={180} />}
          {upcoming.isError && (
            <ErrorState error={upcoming.error} onRetry={() => void upcoming.refetch()} />
          )}

          {upcoming.data && !next && (
            <EmptyState
              title="No upcoming appointments"
              message="Book your personalized consultation and we will confirm it shortly."
              action={
                <Link to="/app/book" className="nu-btn nu-btn--primary">
                  Book an appointment
                </Link>
              }
            />
          )}

          {next && (
            <Link to={`/app/appointments/${next._id}`} className="nu-highlight" style={{ display: 'block' }}>
              <p className="nu-highlight__label">Your next appointment</p>
              <p className="nu-highlight__service">{serviceName(next)}</p>
              <p className="nu-highlight__when">{formatDateTime(next.startAt)}</p>
              <p className="nu-highlight__when" style={{ fontSize: 'var(--nu-text-sm)' }}>
                {/* "in 3 days" answers the question people actually open the
                    app to ask, without making them work out the date. */}
                {timeUntil(next.startAt)} · {formatDuration(next.durationMinutes)}
              </p>
              <div style={{ marginTop: 'var(--nu-space-4)' }}>
                <StatusBadge status={next.status} />
              </div>
              <p
                style={{
                  marginTop: 'var(--nu-space-3)',
                  fontSize: 'var(--nu-text-sm)',
                  color: 'rgb(var(--nu-cream-rgb) / 0.72)',
                }}
              >
                {STATUS_EXPLANATION[next.status]}
              </p>
            </Link>
          )}
        </section>

        <div className="nu-row" style={{ gap: 'var(--nu-space-3)' }}>
          <Link to="/app/book" className="nu-btn nu-btn--primary" style={{ flex: 1 }}>
            Quick book
          </Link>
          <Link to="/app/appointments" className="nu-btn nu-btn--outline" style={{ flex: 1 }}>
            All appointments
          </Link>
        </div>

        {rest.length > 0 && (
          <section aria-labelledby="upcoming-heading" className="nu-stack">
            <h2 id="upcoming-heading" className="nu-page-head__title" style={{ fontSize: 'var(--nu-text-lg)' }}>
              Also coming up
            </h2>
            {rest.map((appointment) => (
              <AppointmentCard key={appointment._id} appointment={appointment} />
            ))}
          </section>
        )}

        {(past.data?.items.length ?? 0) > 0 && (
          <section aria-labelledby="past-heading" className="nu-stack">
            <h2 id="past-heading" className="nu-page-head__title" style={{ fontSize: 'var(--nu-text-lg)' }}>
              Previous appointments
            </h2>
            {past.data?.items.map((appointment) => (
              <AppointmentCard key={appointment._id} appointment={appointment} />
            ))}
          </section>
        )}
      </div>
    </>
  );
}

export default ClientHomePage;
