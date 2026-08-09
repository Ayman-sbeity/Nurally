import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import { AppointmentCard } from '@/components/client/AppointmentCard';
import { useMyAppointments } from '@/hooks/queries';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Previous' },
  { key: 'all', label: 'All' },
] as const;

type Scope = (typeof TABS)[number]['key'];

export function ClientAppointmentsPage() {
  const [scope, setScope] = useState<Scope>('upcoming');
  const { data, isPending, isError, error, refetch } = useMyAppointments({ scope, limit: 50 });

  return (
    <>
      <Seo title="My appointments — Nurella" noIndex />

      <div className="nu-page-head">
        <h1 className="nu-page-head__title">My appointments</h1>
      </div>

      <div
        className="nu-segmented"
        role="tablist"
        aria-label="Filter appointments"
        style={{ marginBottom: 'var(--nu-space-5)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={scope === tab.key}
            onClick={() => setScope(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isPending && <SkeletonList rows={3} />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={scope === 'past' ? 'No previous appointments' : 'No appointments yet'}
          message={
            scope === 'past'
              ? 'Your completed visits will appear here.'
              : 'Book your personalized consultation to get started.'
          }
          action={
            scope !== 'past' ? (
              <Link to="/app/book" className="nu-btn nu-btn--primary">
                Book an appointment
              </Link>
            ) : undefined
          }
        />
      )}

      <div className="nu-stack">
        {data?.items.map((appointment) => (
          <AppointmentCard key={appointment._id} appointment={appointment} />
        ))}
      </div>
    </>
  );
}

export default ClientAppointmentsPage;
