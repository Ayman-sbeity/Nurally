import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { CreateClientDialog } from '@/components/admin/CreateClientDialog';
import { useAdminClients } from '@/hooks/queries';
import { formatDate } from '@/utils/format';

export function AdminClientsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isPending, isError, error, refetch } = useAdminClients({
    ...(search ? { search } : {}),
    ...(activeFilter ? { isActive: activeFilter === 'true' } : {}),
    page,
  });

  return (
    <>
      <Seo title="Clients — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <div>
          <h1 className="nu-admin-head__title">Clients</h1>
          {data && <p className="nu-admin-head__sub">{data.total} registered</p>}
        </div>
        <Button onClick={() => setCreateOpen(true)}>Add client</Button>
      </div>

      <CreateClientDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <form
        className="nu-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput.trim());
          setPage(1);
        }}
      >
        <TextField
          label="Search"
          type="search"
          placeholder="Name, email or phone"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <SelectField
          label="Status"
          value={activeFilter}
          onChange={(event) => {
            setActiveFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Deactivated</option>
        </SelectField>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {isPending && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState title="No clients found" message="Try a different search." />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="nu-table-wrap">
            <table className="nu-table">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Appointments</th>
                  <th scope="col">Joined</th>
                  <th scope="col">
                    <span className="nu-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((client) => (
                  <tr key={client._id}>
                    <td>
                      <div>{client.fullName}</div>
                      {!client.isActive && <span className="nu-badge">Deactivated</span>}
                    </td>
                    <td>
                      <div className="nu-hint">{client.email}</div>
                      {client.phone && <div className="nu-hint">{client.phone}</div>}
                    </td>
                    <td>
                      {client.appointmentStats.total} total
                      <div className="nu-hint">{client.appointmentStats.upcoming} upcoming</div>
                    </td>
                    <td>{formatDate(client.createdAt)}</td>
                    <td>
                      <Link
                        to={`/admin/clients/${client._id}`}
                        className="nu-btn nu-btn--outline nu-btn--sm"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="nu-pagination">
            <span>
              Page {data.page} of {data.totalPages}
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

export default AdminClientsPage;
