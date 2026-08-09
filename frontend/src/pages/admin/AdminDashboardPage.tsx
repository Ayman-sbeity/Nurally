import { Link } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import { clientOf, serviceName } from '@/components/client/AppointmentCard';
import { useAdminDashboard } from '@/hooks/queries';
import type { Appointment } from '@/types/api';
import { formatTime, friendlyDay } from '@/utils/format';

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const client = clientOf(appointment);
  return (
    <Link to={`/admin/appointments/${appointment._id}`} className="nu-agenda__item">
      <span className="nu-agenda__time">{formatTime(appointment.startAt)}</span>
      <span className="nu-agenda__who">
        <span className="nu-agenda__name">{client?.fullName ?? 'Client'}</span>
        <span className="nu-agenda__service">
          {serviceName(appointment)} · {friendlyDay(appointment.startAt)}
        </span>
      </span>
      <StatusBadge status={appointment.status} />
    </Link>
  );
}

export function AdminDashboardPage() {
  const { data, isPending, isError, error, refetch } = useAdminDashboard();

  if (isPending) return <SkeletonList rows={4} height={96} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { stats, todaysAppointments, pendingRequests, upcomingAppointments, popularServices } = data;

  const tiles = [
    { label: "Today's appointments", value: stats.todayCount },
    { label: 'Pending requests', value: stats.pendingCount },
    { label: 'Confirmed', value: stats.confirmedCount },
    { label: 'Upcoming', value: stats.upcomingCount },
    { label: 'Completed', value: stats.completedCount },
    { label: 'Cancelled', value: stats.cancelledCount },
    { label: 'Total clients', value: stats.totalClients },
  ];

  return (
    <>
      <Seo title="Dashboard — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <div>
          <h1 className="nu-admin-head__title">Overview</h1>
          <p className="nu-admin-head__sub">{friendlyDay(new Date().toISOString())}</p>
        </div>
        <div className="nu-row" style={{ gap: 'var(--nu-space-2)' }}>
          <Link to="/admin/calendar" className="nu-btn nu-btn--outline nu-btn--sm">
            Calendar
          </Link>
          <Link to="/admin/appointments?status=PENDING" className="nu-btn nu-btn--primary nu-btn--sm">
            Review requests
          </Link>
        </div>
      </div>

      <div className="nu-stats">
        {tiles.map((tile) => (
          <div key={tile.label} className="nu-stat">
            <p className="nu-stat__value">{tile.value}</p>
            <p className="nu-stat__label">{tile.label}</p>
          </div>
        ))}
      </div>

      <div className="nu-panels nu-panels--split">
        <section className="nu-panel">
          <div className="nu-panel__head">
            <h2 className="nu-panel__title">Pending requests</h2>
            <Link to="/admin/appointments?status=PENDING" className="nu-link">
              View all
            </Link>
          </div>
          <div className="nu-panel__body">
            {pendingRequests.length === 0 ? (
              <EmptyState title="Nothing waiting" message="All booking requests have been reviewed." />
            ) : (
              <div className="nu-agenda">
                {pendingRequests.map((appointment) => (
                  <AppointmentRow key={appointment._id} appointment={appointment} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="nu-panel">
          <div className="nu-panel__head">
            <h2 className="nu-panel__title">Today</h2>
          </div>
          <div className="nu-panel__body">
            {todaysAppointments.length === 0 ? (
              <EmptyState title="No appointments today" />
            ) : (
              <div className="nu-agenda">
                {todaysAppointments.map((appointment) => (
                  <AppointmentRow key={appointment._id} appointment={appointment} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="nu-panels nu-panels--split" style={{ marginTop: 'var(--nu-space-5)' }}>
        <section className="nu-panel">
          <div className="nu-panel__head">
            <h2 className="nu-panel__title">Coming up</h2>
          </div>
          <div className="nu-panel__body">
            {upcomingAppointments.length === 0 ? (
              <EmptyState title="No upcoming appointments" />
            ) : (
              <div className="nu-agenda">
                {upcomingAppointments.map((appointment) => (
                  <AppointmentRow key={appointment._id} appointment={appointment} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="nu-panel">
          <div className="nu-panel__head">
            <h2 className="nu-panel__title">Most booked treatments</h2>
          </div>
          <div className="nu-panel__body">
            {popularServices.length === 0 ? (
              <EmptyState title="Not enough data yet" />
            ) : (
              <ol className="nu-stack" style={{ gap: 'var(--nu-space-3)' }}>
                {popularServices.map((service) => {
                  const top = popularServices[0]?.count ?? 1;
                  return (
                    <li key={service._id}>
                      <div className="nu-row nu-row--between" style={{ marginBottom: 4 }}>
                        <span>{service.name}</span>
                        <span className="nu-hint">{service.count}</span>
                      </div>
                      {/* A plain proportional bar — more useful here than a chart. */}
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: 'var(--nu-sand-deep)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round((service.count / top) * 100)}%`,
                            height: '100%',
                            background: 'var(--nu-champagne-deep)',
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export default AdminDashboardPage;
