import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CreateAppointmentDialog } from '@/components/admin/CreateAppointmentDialog';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { clientOf, serviceName } from '@/components/client/AppointmentCard';
import { useAdminAppointments } from '@/hooks/queries';
import { usePermissions } from '@/hooks/usePermissions';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '@/types/api';
import { STATUS_LABEL, formatShortDateTime } from '@/utils/format';

export function AdminAppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const { can } = usePermissions();

  const status = searchParams.get('status') as AppointmentStatus | null;
  const scope = (searchParams.get('scope') as 'upcoming' | 'past' | 'all' | null) ?? 'all';

  const { data, isPending, isError, error, refetch } = useAdminAppointments({
    ...(status ? { status: [status] } : {}),
    scope,
    ...(searchParams.get('search') ? { search: searchParams.get('search') as string } : {}),
    page,
    limit: 20,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  return (
    <>
      <Seo title="Appointments — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <h1 className="nu-admin-head__title">Appointments</h1>
        {can('APPOINTMENTS', 'CREATE') && (
          <Button onClick={() => setCreateOpen(true)}>Book appointment</Button>
        )}
      </div>

      {createOpen && <CreateAppointmentDialog onClose={() => setCreateOpen(false)} />}

      <form
        className="nu-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setParam('search', search.trim());
        }}
      >
        <TextField
          label="Search"
          type="search"
          placeholder="Client name, email, phone or treatment"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <SelectField
          label="Status"
          value={status ?? ''}
          onChange={(event) => setParam('status', event.target.value)}
        >
          <option value="">All statuses</option>
          {APPOINTMENT_STATUSES.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABEL[option]}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Period"
          value={scope}
          onChange={(event) => setParam('scope', event.target.value)}
        >
          <option value="all">All time</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </SelectField>

        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState title="No appointments match these filters." message="Try widening your search." />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="nu-table-wrap">
            <table className="nu-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Client</th>
                  <th scope="col">Treatment</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="nu-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((appointment) => {
                  const client = clientOf(appointment);
                  return (
                    <tr key={appointment._id}>
                      <td>{formatShortDateTime(appointment.startAt)}</td>
                      <td>
                        <div>{client?.fullName ?? '—'}</div>
                        <div className="nu-hint">{client?.phone ?? client?.email ?? ''}</div>
                      </td>
                      <td>{serviceName(appointment)}</td>
                      <td>
                        <StatusBadge status={appointment.status} />
                      </td>
                      <td>
                        <Link
                          to={`/admin/appointments/${appointment._id}`}
                          className="nu-btn nu-btn--outline nu-btn--sm"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="nu-pagination">
            <span>
              Page {data.page} of {data.totalPages} · {data.total} total
            </span>
            <div className="nu-row">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default AdminAppointmentsPage;
