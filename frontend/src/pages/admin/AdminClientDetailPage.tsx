import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextAreaField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { ClientDocuments } from '@/components/admin/ClientDocuments';
import { ClientPhotoSets } from '@/components/admin/ClientPhotoSets';
import { CreateAppointmentDialog } from '@/components/admin/CreateAppointmentDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useAdminClient } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate, formatShortDateTime } from '@/utils/format';

export function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { can } = usePermissions();
  const [notes, setNotes] = useState('');
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  /** Held only for as long as the dialog is open — never persisted anywhere. */
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);

  const { data, isPending, isError, error, refetch } = useAdminClient(id);

  // Seed the notes field once the client loads.
  useEffect(() => {
    if (data?.client) setNotes(data.client.clientProfile?.notes ?? '');
  }, [data?.client]);

  const resetPassword = useMutation({
    mutationFn: () => adminApi.resetClientPassword(id as string),
    onSuccess: ({ temporaryPassword: password }) => {
      setTemporaryPassword(password);
      setResetOpen(true);
    },
    onError: (error) =>
      notify(
        error instanceof ApiRequestError
          ? error.message
          : 'That password could not be reset.',
        'error',
      ),
  });

  const update = useMutation({
    mutationFn: (payload: { notes?: string; isActive?: boolean }) =>
      adminApi.updateClient(id as string, payload),
    onSuccess: () => {
      setDeactivateOpen(false);
      notify('Client updated.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (mutationError) =>
      notify(
        mutationError instanceof ApiRequestError
          ? mutationError.message
          : 'We could not update this client.',
        'error',
      ),
  });

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { client, appointments, preferredServices } = data;

  return (
    <>
      <Seo title={`${client.fullName} — Nurella Admin`} noIndex />

      <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--nu-space-4)' }}>
        <Link to="/admin/clients" className="nu-eyebrow">
          ← All clients
        </Link>
      </nav>

      <div className="nu-admin-head">
        <div>
          <h1 className="nu-admin-head__title">{client.fullName}</h1>
          <p className="nu-admin-head__sub">Client since {formatDate(client.createdAt)}</p>
        </div>
        {client.isActive ? (
          can('APPOINTMENTS', 'CREATE') && (
            <Button onClick={() => setBookOpen(true)}>Book appointment</Button>
          )
        ) : (
          <span className="nu-badge">Deactivated</span>
        )}
      </div>

      {bookOpen && (
        <CreateAppointmentDialog client={client} onClose={() => setBookOpen(false)} />
      )}

      <div className="nu-detail">
        <section className="nu-panel">
          <div className="nu-panel__head">
            <h2 className="nu-panel__title">Appointment history</h2>
          </div>
          <div className="nu-panel__body nu-panel__body--flush">
            {appointments.length === 0 ? (
              <div className="nu-panel__body">
                <EmptyState title="No appointments yet" />
              </div>
            ) : (
              <div className="nu-table-wrap" style={{ border: 0, borderRadius: 0 }}>
                <table className="nu-table">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Treatment</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="nu-sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appointment) => (
                      <tr key={appointment._id}>
                        <td>{formatShortDateTime(appointment.startAt)}</td>
                        <td>{appointment.serviceNameSnapshot}</td>
                        <td>
                          <StatusBadge status={appointment.status} />
                        </td>
                        <td>
                          <Link
                            to={`/admin/appointments/${appointment._id}`}
                            className="nu-btn nu-btn--ghost nu-btn--sm"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <div className="nu-stack" style={{ gap: 'var(--nu-space-5)' }}>
          <section className="nu-panel">
            <div className="nu-panel__head">
              <h2 className="nu-panel__title">Contact</h2>
            </div>
            <div className="nu-panel__body nu-stack">
              {client.phone && (
                <a className="nu-link" href={`tel:${client.phone.replace(/\s/g, '')}`}>
                  {client.phone}
                </a>
              )}
              {client.email ? (
                <a className="nu-link" href={`mailto:${client.email}`}>
                  {client.email}
                </a>
              ) : (
                <p className="nu-hint">
                  No email address on file — this client cannot reset their own password.
                </p>
              )}
            </div>
          </section>

          {preferredServices.length > 0 && (
            <section className="nu-panel">
              <div className="nu-panel__head">
                <h2 className="nu-panel__title">Most booked</h2>
              </div>
              <div className="nu-panel__body">
                <ul className="nu-stack" style={{ gap: 'var(--nu-space-2)' }}>
                  {preferredServices.map((service) => (
                    <li key={service._id} className="nu-row nu-row--between">
                      <span>{service.name}</span>
                      <span className="nu-hint">{service.count}×</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section className="nu-panel">
            <div className="nu-panel__head">
              <h2 className="nu-panel__title">Internal notes</h2>
            </div>
            <div className="nu-panel__body nu-stack">
              <TextAreaField
                label="Notes"
                value={notes}
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                hint="Visible to the lounge only. Never shown to the client."
              />
              <div>
                <Button
                  variant="outline"
                  loading={update.isPending}
                  onClick={() => update.mutate({ notes })}
                >
                  Save notes
                </Button>
              </div>
            </div>
          </section>

          <section className="nu-panel">
            <div className="nu-panel__head">
              <h2 className="nu-panel__title">Account</h2>
            </div>
            <div className="nu-panel__body">
              <div className="nu-stack" style={{ gap: 'var(--nu-space-4)' }}>
                {/* The lounge's stand-in for a reset link: no mail or SMS
                    transport exists, so the desk sets one and reads it out. */}
                {can('CLIENTS', 'EDIT') && (
                  <div>
                    <Button
                      variant="outline"
                      loading={resetPassword.isPending}
                      onClick={() => resetPassword.mutate()}
                    >
                      Reset password
                    </Button>
                    <p className="nu-hint" style={{ marginTop: 'var(--nu-space-2)' }}>
                      Sets a temporary password to read out over the phone. Signs them out
                      everywhere.
                    </p>
                  </div>
                )}

                {client.isActive ? (
                  <div>
                    <Button variant="danger" onClick={() => setDeactivateOpen(true)}>
                      Deactivate account
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Button variant="outline" onClick={() => update.mutate({ isActive: true })}>
                      Reactivate account
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Full width: before/after comparison needs the room. */}
      <ClientPhotoSets clientId={client._id} clientName={client.fullName} />
      <ClientDocuments clientId={client._id} />

      {/* Shown once. The server does not store the plaintext, so closing this
          dialog is the last chance to read it — hence the explicit dismissal
          rather than a toast that could scroll away unread. */}
      <Dialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setTemporaryPassword(null);
        }}
        title="Temporary password"
        description={`Read this to ${client.fullName}. It is shown only now — closing this cannot bring it back.`}
        footer={
          <Button
            onClick={() => {
              setResetOpen(false);
              setTemporaryPassword(null);
            }}
          >
            Done
          </Button>
        }
      >
        <div className="nu-stack">
          <p className="nu-temppass">{temporaryPassword}</p>
          <p className="nu-hint">
            They sign in with their phone number and this password, then change it under Profile →
            Password. Every device they were signed in on has been signed out.
          </p>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        title="Deactivate this client?"
        description="They will no longer be able to sign in or book. Existing appointments are unaffected."
        confirmLabel="Deactivate"
        confirmVariant="danger"
        loading={update.isPending}
        onConfirm={() => update.mutate({ isActive: false })}
      />
    </>
  );
}

export default AdminClientDetailPage;
