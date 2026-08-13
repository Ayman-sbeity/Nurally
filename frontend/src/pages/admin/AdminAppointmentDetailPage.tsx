import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Seo } from '@/components/ui/Seo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { SlotPickerDialog } from '@/components/admin/SlotPickerDialog';
import { clientOf } from '@/components/client/AppointmentCard';
import { useAppointment } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import { EditAppointmentDialog } from '@/components/admin/EditAppointmentDialog';
import {
  STATUS_LABEL,
  formatDateTime,
  formatDuration,
  formatShortDateTime,
} from '@/utils/format';

type DialogKind = 'reject' | 'cancel' | 'complete' | 'noShow' | 'offer' | 'reschedule' | null;

export function AdminAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isPending, isError, error, refetch } = useAppointment(id, true);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
    void queryClient.invalidateQueries({ queryKey: ['availability'] });
  };

  const onError = (mutationError: unknown) =>
    notify(
      mutationError instanceof ApiRequestError
        ? mutationError.message
        : 'That action could not be completed.',
      'error',
    );

  const remove = useMutation({
    mutationFn: () => adminApi.deleteAppointment(id as string),
    onSuccess: ({ message }) => {
      notify(message, 'success');
      refresh();
      navigate('/admin/appointments', { replace: true });
    },
    onError,
  });

  const onDone = (message: string) => () => {
    setDialog(null);
    notify(message, 'success');
    refresh();
  };

  const approve = useMutation({
    mutationFn: () => adminApi.approve(id as string),
    onSuccess: onDone('Appointment confirmed.'),
    onError,
  });
  const reject = useMutation({
    mutationFn: (reason?: string) => adminApi.reject(id as string, reason),
    onSuccess: onDone('Request declined.'),
    onError,
  });
  const cancel = useMutation({
    mutationFn: (reason?: string) => adminApi.cancel(id as string, reason),
    onSuccess: onDone('Appointment cancelled.'),
    onError,
  });
  const complete = useMutation({
    mutationFn: () => adminApi.complete(id as string),
    onSuccess: onDone('Marked as completed.'),
    onError,
  });
  const noShow = useMutation({
    mutationFn: () => adminApi.noShow(id as string),
    onSuccess: onDone('Marked as a no-show.'),
    onError,
  });
  const offerTime = useMutation({
    mutationFn: (payload: { startAt: string; message?: string }) =>
      adminApi.offerTime(id as string, payload),
    onSuccess: onDone('New time offered to the client.'),
    onError,
  });
  const reschedule = useMutation({
    mutationFn: (payload: { startAt: string; message?: string }) =>
      adminApi.reschedule(id as string, payload),
    onSuccess: onDone('Appointment rescheduled.'),
    onError,
  });
  const approveReschedule = useMutation({
    mutationFn: () => adminApi.approveReschedule(id as string),
    onSuccess: onDone('Reschedule approved.'),
    onError,
  });

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { appointment } = data;
  const client = clientOf(appointment);
  const serviceId =
    typeof appointment.service === 'object' ? appointment.service._id : appointment.service;

  const { status } = appointment;
  const isPendingRequest = status === 'PENDING';
  const isReschedule = status === 'RESCHEDULE_REQUESTED';

  // Cancelling is the one desk action held behind Delete; everything else that
  // moves an appointment along is an edit.
  const { can } = usePermissions();
  const canEdit = can('APPOINTMENTS', 'EDIT');
  const canCancel = can('APPOINTMENTS', 'DELETE');
  const canDelete = canCancel;

  return (
    <>
      <Seo title={`${appointment.serviceNameSnapshot} — Nurella Admin`} noIndex />

      <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--nu-space-4)' }}>
        <Link to="/admin/appointments" className="nu-eyebrow">
          ← All appointments
        </Link>
      </nav>

      <div className="nu-admin-head">
        <div>
          <h1 className="nu-admin-head__title">{appointment.serviceNameSnapshot}</h1>
          <p className="nu-admin-head__sub">{formatDateTime(appointment.startAt)}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="nu-detail">
        <div className="nu-stack" style={{ gap: 'var(--nu-space-5)' }}>
          {isReschedule && appointment.rescheduleRequest && (
            <div className="nu-notice nu-notice--info">
              <div>
                <p style={{ fontWeight: 500 }}>The client asked to move this appointment.</p>
                <p style={{ marginTop: 'var(--nu-space-2)' }}>
                  Proposed: {formatDateTime(appointment.rescheduleRequest.proposedStartAt)}
                </p>
                {appointment.rescheduleRequest.message && (
                  <p style={{ marginTop: 'var(--nu-space-2)' }}>
                    “{appointment.rescheduleRequest.message}”
                  </p>
                )}
                {canEdit && (
                  <div
                    className="nu-row"
                    style={{ marginTop: 'var(--nu-space-4)', gap: 'var(--nu-space-2)' }}
                  >
                    <Button
                      size="sm"
                      loading={approveReschedule.isPending}
                      onClick={() => approveReschedule.mutate()}
                    >
                      Approve proposed time
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDialog('offer')}>
                      Offer a different time
                    </Button>
                  </div>
                )}
                {/* The client keeps their original slot until this is resolved. */}
                <p className="nu-hint" style={{ marginTop: 'var(--nu-space-3)' }}>
                  Their original time ({formatShortDateTime(appointment.startAt)}) is still held.
                </p>
              </div>
            </div>
          )}

          {status === 'TIME_OFFERED' && appointment.offer && (
            <div className="nu-notice nu-notice--warn">
              <div>
                <p style={{ fontWeight: 500 }}>Awaiting the client's answer.</p>
                <p style={{ marginTop: 'var(--nu-space-2)' }}>
                  Offered {formatDateTime(appointment.offer.startAt)} · expires{' '}
                  {formatShortDateTime(appointment.offer.expiresAt)}
                </p>
              </div>
            </div>
          )}

          <section className="nu-panel">
            <div className="nu-panel__head">
              <h2 className="nu-panel__title">Appointment</h2>
            </div>
            <div className="nu-panel__body">
              <dl className="nu-deflist">
                <div className="nu-deflist__row">
                  <dt className="nu-deflist__key">Treatment</dt>
                  <dd>{appointment.serviceNameSnapshot}</dd>
                </div>
                <div className="nu-deflist__row">
                  <dt className="nu-deflist__key">Requested date</dt>
                  <dd>{formatDateTime(appointment.requestedStartAt)}</dd>
                </div>
                <div className="nu-deflist__row">
                  <dt className="nu-deflist__key">Current time</dt>
                  <dd>{formatDateTime(appointment.startAt)}</dd>
                </div>
                <div className="nu-deflist__row">
                  <dt className="nu-deflist__key">Duration</dt>
                  <dd>{formatDuration(appointment.durationMinutes)}</dd>
                </div>
                <div className="nu-deflist__row">
                  <dt className="nu-deflist__key">Booking notes</dt>
                  <dd>{appointment.clientNotes || '—'}</dd>
                </div>
                {appointment.cancellationReason && (
                  <div className="nu-deflist__row">
                    <dt className="nu-deflist__key">Reason</dt>
                    <dd>{appointment.cancellationReason}</dd>
                  </div>
                )}
              </dl>
            </div>
          </section>

          <section className="nu-panel">
            <div className="nu-panel__head">
              <h2 className="nu-panel__title">History</h2>
            </div>
            <div className="nu-panel__body">
              <ol className="nu-timeline">
                {appointment.history.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="nu-timeline__item">
                    <p style={{ fontWeight: 500 }}>{STATUS_LABEL[entry.status]}</p>
                    <p className="nu-timeline__when">
                      {formatShortDateTime(entry.at)} · {entry.byRole.toLowerCase()}
                    </p>
                    {entry.note && <p className="nu-hint">{entry.note}</p>}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>

        <div className="nu-stack" style={{ gap: 'var(--nu-space-5)' }}>
          <section className="nu-panel">
            <div className="nu-panel__head">
              <h2 className="nu-panel__title">Client</h2>
            </div>
            <div className="nu-panel__body nu-stack">
              <p style={{ fontWeight: 500 }}>{client?.fullName ?? '—'}</p>
              {client?.phone && (
                <a className="nu-link" href={`tel:${client.phone.replace(/\s/g, '')}`}>
                  {client.phone}
                </a>
              )}
              {client?.email && (
                <a className="nu-link" href={`mailto:${client.email}`}>
                  {client.email}
                </a>
              )}

              <div className="nu-row nu-row--wrap" style={{ marginTop: 'var(--nu-space-3)' }}>
                {client?.phone && (
                  <a
                    className="nu-btn nu-btn--outline nu-btn--sm"
                    href={`tel:${client.phone.replace(/\s/g, '')}`}
                  >
                    Call client
                  </a>
                )}
                {client && (
                  <Link to={`/admin/clients/${client._id}`} className="nu-btn nu-btn--ghost nu-btn--sm">
                    View profile
                  </Link>
                )}
              </div>
            </div>
          </section>

          <section className="nu-panel">
            <div className="nu-panel__head">
              <h2 className="nu-panel__title">Actions</h2>
            </div>
            <div className="nu-panel__body">
              {/* The action set is driven by the status, mirroring the
                  server-side state machine — nothing invalid is offered. */}
              <div className="nu-actions">
                {canEdit && isPendingRequest && (
                  <Button loading={approve.isPending} onClick={() => approve.mutate()}>
                    Approve
                  </Button>
                )}
                {canEdit && (isPendingRequest || status === 'TIME_OFFERED' || isReschedule) && (
                  <Button variant="danger" onClick={() => setDialog('reject')}>
                    Reject
                  </Button>
                )}
                {canEdit && (isPendingRequest || status === 'CONFIRMED' || isReschedule) && (
                  <Button variant="outline" onClick={() => setDialog('offer')}>
                    Offer another time
                  </Button>
                )}
                {canEdit && status === 'CONFIRMED' && (
                  <>
                    <Button variant="outline" onClick={() => setDialog('reschedule')}>
                      Reschedule
                    </Button>
                    <Button variant="outline" onClick={() => setDialog('complete')}>
                      Mark completed
                    </Button>
                    <Button variant="outline" onClick={() => setDialog('noShow')}>
                      Mark no-show
                    </Button>
                  </>
                )}
                {canCancel &&
                  ['PENDING', 'CONFIRMED', 'TIME_OFFERED', 'RESCHEDULE_REQUESTED'].includes(status) && (
                  <Button variant="danger" onClick={() => setDialog('cancel')}>
                    Cancel
                  </Button>
                )}

                {/* Correcting the record, rather than moving the booking along.
                    Available while the appointment is still open. */}
                {canEdit && !['COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'].includes(status) && (
                  <Button variant="outline" onClick={() => setEditOpen(true)}>
                    Edit details
                  </Button>
                )}
              </div>

              {/* Erasure, kept away from the actions above: cancelling is what
                  the desk wants nearly every time, and this leaves no record. */}
              {canDelete && (
                <div style={{ marginTop: 'var(--nu-space-5)' }}>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}>
                    Delete permanently
                  </Button>
                  <p className="nu-hint" style={{ marginTop: 'var(--nu-space-2)' }}>
                    For a duplicate or a booking made against the wrong client. Cancelling keeps the
                    record; this does not.
                  </p>
                </div>
              )}

              {['COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'].includes(status) ? (
                <p className="nu-hint">
                  This appointment is closed. No further changes are possible.
                </p>
              ) : (
                !canEdit &&
                !canCancel && (
                  <p className="nu-hint">
                    Your account can view appointments but not change them.
                  </p>
                )
              )}
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Reject this request?"
        description="The client is told the request was not accepted and the time is released."
        confirmLabel="Reject request"
        confirmVariant="danger"
        withReason
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason)}
      />

      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Cancel this appointment?"
        description="The client is notified and the time is released for other bookings."
        confirmLabel="Cancel appointment"
        confirmVariant="danger"
        withReason
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate(reason)}
      />

      <ConfirmDialog
        open={dialog === 'complete'}
        onClose={() => setDialog(null)}
        title="Mark as completed?"
        description="This closes the appointment. It cannot be reopened."
        confirmLabel="Mark completed"
        loading={complete.isPending}
        onConfirm={() => complete.mutate()}
      />

      <ConfirmDialog
        open={dialog === 'noShow'}
        onClose={() => setDialog(null)}
        title="Mark as a no-show?"
        description="This closes the appointment and keeps the time reserved in the record."
        confirmLabel="Mark no-show"
        confirmVariant="danger"
        loading={noShow.isPending}
        onConfirm={() => noShow.mutate()}
      />

      <SlotPickerDialog
        open={dialog === 'offer'}
        onClose={() => setDialog(null)}
        title="Offer another time"
        description="The client can accept or decline. The chosen slot is held until they respond."
        confirmLabel="Send offer"
        serviceId={serviceId}
        loading={offerTime.isPending}
        onConfirm={(startAt, message) => offerTime.mutate({ startAt, message })}
      />

      {editOpen && (
        <EditAppointmentDialog
          appointment={appointment}
          onClose={() => setEditOpen(false)}
          onSaved={refresh}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this appointment?"
        description="It is removed permanently, with its history, and the time is freed. Cancelling instead keeps the record of what was booked."
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />

      <SlotPickerDialog
        open={dialog === 'reschedule'}
        onClose={() => setDialog(null)}
        title="Reschedule appointment"
        description="Moves this confirmed appointment directly. The client is notified."
        confirmLabel="Move appointment"
        serviceId={serviceId}
        loading={reschedule.isPending}
        onConfirm={(startAt, message) => reschedule.mutate({ startAt, message })}
      />
    </>
  );
}

export default AdminAppointmentDetailPage;
