import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { CreateClientDialog } from '@/components/admin/CreateClientDialog';
import { useAdminClients } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';

/** The row the delete dialog is asking about — held whole so the dialog can
 *  name the client even as the list refetches underneath it. */
interface DeleteTarget {
  _id: string;
  fullName: string;
}

export function AdminClientsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { can } = usePermissions();

  const { data, isPending, isError, error, refetch } = useAdminClients({
    ...(search ? { search } : {}),
    ...(activeFilter ? { isActive: activeFilter === 'true' } : {}),
    page,
  });

  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteConfirmation('');
  };

  const remove = useMutation({
    mutationFn: (clientId: string) => adminApi.deleteClient(clientId),
    onSuccess: ({ message }) => {
      notify(message, 'success');
      // Deleting the only row on a trailing page would otherwise leave the
      // table on a page that no longer exists, showing "No clients found".
      if (data && data.items.length === 1 && page > 1) setPage((value) => value - 1);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      closeDelete();
    },
    onError: (error) =>
      notify(
        error instanceof ApiRequestError ? error.message : 'That client could not be deleted.',
        'error',
      ),
  });

  return (
    <>
      <Seo title="Clients — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <div>
          <h1 className="nu-admin-head__title">Clients</h1>
          {data && <p className="nu-admin-head__sub">{data.total} registered</p>}
        </div>
        {can('CLIENTS', 'CREATE') && (
          <Button onClick={() => setCreateOpen(true)}>Add client</Button>
        )}
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
                      <div className="nu-row" style={{ gap: 'var(--nu-space-3)' }}>
                        <Avatar
                          userId={client._id}
                          fullName={client.fullName}
                          updatedAt={client.avatarUpdatedAt}
                          size={36}
                        />
                        <div>
                          <div>{client.fullName}</div>
                          {!client.isActive && <span className="nu-badge">Deactivated</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {client.email && <div className="nu-hint">{client.email}</div>}
                      {client.phone && <div className="nu-hint">{client.phone}</div>}
                    </td>
                    <td>
                      {client.appointmentStats.total} total
                      <div className="nu-hint">{client.appointmentStats.upcoming} upcoming</div>
                    </td>
                    <td>{formatDate(client.createdAt)}</td>
                    <td>
                      <div className="nu-row" style={{ justifyContent: 'flex-end' }}>
                        <Link
                          to={`/admin/clients/${client._id}`}
                          className="nu-btn nu-btn--outline nu-btn--sm"
                        >
                          Open
                        </Link>
                        {can('CLIENTS', 'DELETE') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteTarget({ _id: client._id, fullName: client.fullName })
                            }
                          >
                            Delete
                          </Button>
                        )}
                      </div>
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

      {/* Same safeguard as the client detail page: erasure is unreviewable, so
          it stays behind the client's typed name rather than a single click
          sitting next to Open. */}
      <Dialog
        open={deleteTarget !== null}
        onClose={closeDelete}
        title={deleteTarget ? `Delete ${deleteTarget.fullName}?` : 'Delete client?'}
        description="This erases the client together with every appointment, before/after photograph and document. It cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={closeDelete} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!deleteTarget || deleteConfirmation.trim() !== deleteTarget.fullName}
              loading={remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget._id)}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="nu-stack">
          <div className="nu-notice nu-notice--danger" role="alert">
            <div>
              <p style={{ fontWeight: 500 }}>Consider deactivating instead</p>
              <p>
                Deactivating stops them signing in and booking while keeping their treatment
                history — which is usually what is wanted when a client stops coming. Open the
                client to deactivate.
              </p>
            </div>
          </div>
          <TextField
            label={`Type “${deleteTarget?.fullName ?? ''}” to confirm`}
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            autoComplete="off"
          />
        </div>
      </Dialog>
    </>
  );
}

export default AdminClientsPage;
