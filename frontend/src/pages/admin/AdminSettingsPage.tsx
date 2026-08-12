import { PushNotificationsCard } from '@/components/ui/PushNotificationsCard';
import { Seo } from '@/components/ui/Seo';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useAuth } from '@/context/AuthContext';
import { useBookingSettings } from '@/hooks/queries';
import { MISSING_INFORMATION } from '@/content/brand';
import { formatDuration } from '@/utils/format';

/**
 * Read-only view of the booking engine's configuration.
 *
 * These values come from server environment variables rather than the
 * database, so they are shown here for reference instead of being editable —
 * changing them is a deployment decision, not a day-to-day one.
 */
export function AdminSettingsPage() {
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch } = useBookingSettings();

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const rows = [
    { key: 'Lounge timezone', value: data.timezone },
    { key: 'Slot granularity', value: formatDuration(data.slotGranularityMinutes) },
    { key: 'Booking window', value: `${data.maxAdvanceBookingDays} days ahead` },
    { key: 'Minimum notice', value: formatDuration(data.minBookingNoticeMinutes) },
    { key: 'Latest bookable date', value: data.maxBookableDate },
  ];

  return (
    <>
      <Seo title="Settings — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <h1 className="nu-admin-head__title">Settings</h1>
      </div>

      <div className="nu-detail">
        <div className="nu-stack" style={{ gap: 'var(--nu-space-5)' }}>
          <PushNotificationsCard audience="admin" />

          <section className="nu-panel">
            <div className="nu-panel__head">
              <h2 className="nu-panel__title">Booking engine</h2>
            </div>
            <div className="nu-panel__body">
              <dl className="nu-deflist">
                {rows.map((row) => (
                  <div key={row.key} className="nu-deflist__row">
                    <dt className="nu-deflist__key">{row.key}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="nu-hint" style={{ marginTop: 'var(--nu-space-4)' }}>
                These are set through the server's environment variables. Working hours and closures
                are edited in Availability.
              </p>
              {data.timezone === 'UTC' && (
                <div className="nu-notice nu-notice--warn" style={{ marginTop: 'var(--nu-space-4)' }}>
                  <div>
                    <p style={{ fontWeight: 500 }}>Timezone not configured</p>
                    <p>
                      LOUNGE_TIMEZONE is still UTC. Set it to the lounge's IANA timezone before
                      taking real bookings, or times will be shown incorrectly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="nu-panel">
            <div className="nu-panel__head">
              <h2 className="nu-panel__title">Information still needed</h2>
            </div>
            <div className="nu-panel__body">
              <p className="nu-hint" style={{ marginBottom: 'var(--nu-space-3)' }}>
                These details were not supplied, so nothing was invented in their place. Add them
                before launch.
              </p>
              <ul className="nu-stack" style={{ gap: 'var(--nu-space-2)' }}>
                {MISSING_INFORMATION.map((item) => (
                  <li key={item} className="nu-row" style={{ gap: 'var(--nu-space-2)' }}>
                    <span aria-hidden="true">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <section className="nu-panel">
          <div className="nu-panel__head">
            <h2 className="nu-panel__title">Your account</h2>
          </div>
          <div className="nu-panel__body">
            <dl className="nu-deflist">
              <div className="nu-deflist__row">
                <dt className="nu-deflist__key">Name</dt>
                <dd>{user?.fullName}</dd>
              </div>
              <div className="nu-deflist__row">
                <dt className="nu-deflist__key">Email</dt>
                <dd>{user?.email}</dd>
              </div>
              <div className="nu-deflist__row">
                <dt className="nu-deflist__key">Role</dt>
                <dd>{user?.role}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </>
  );
}

export default AdminSettingsPage;
