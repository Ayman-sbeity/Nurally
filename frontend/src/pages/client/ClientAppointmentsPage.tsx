import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import { AppointmentCard } from '@/components/client/AppointmentCard';
import { useMyAppointments } from '@/hooks/queries';
import type { Appointment } from '@/types/api';
import { groupByDay } from '@/utils/format';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Previous' },
  { key: 'all', label: 'All' },
] as const;

type Scope = (typeof TABS)[number]['key'];

const PANEL_ID = 'appointments-panel';

export function ClientAppointmentsPage() {
  const [scope, setScope] = useState<Scope>('upcoming');
  const { data, isPending, isError, error, refetch } = useMyAppointments({ scope, limit: 50 });

  // A flat list of 50 cards is hard to scan. Grouping under a day heading
  // turns "when is my next one" into a glance instead of a read.
  const groups = useMemo(() => groupByDay(data?.items ?? []), [data]);

  return (
    <>
      <Seo title="My appointments — Nurella" noIndex />

      <div className="nu-page-head">
        <h1 className="nu-page-head__title">My appointments</h1>
      </div>

      <SegmentedTabs
        tabs={TABS}
        value={scope}
        onChange={setScope}
        label="Filter appointments"
        controls={PANEL_ID}
        className="nu-segmented--spaced"
      />

      <div id={PANEL_ID} role="tabpanel" tabIndex={-1}>
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

        {groups.map((group) => (
          <section key={group.key} className="nu-daygroup">
            <h2 className="nu-daygroup__label">{group.label}</h2>
            <div className="nu-stack">
              {group.items.map((appointment: Appointment) => (
                <AppointmentCard key={appointment._id} appointment={appointment} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default ClientAppointmentsPage;
