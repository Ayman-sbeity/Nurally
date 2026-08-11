import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingApi } from '@/api/booking.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { RescheduleDialog } from '@/components/client/RescheduleDialog';
import { Seo } from '@/components/ui/Seo';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useAppointment, qk } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import {
  STATUS_EXPLANATION,
  STATUS_LABEL,
  formatDateTime,
  formatDuration,
  formatShortDateTime,
} from '@/utils/format';

export function ClientAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const { data, isPending, isError, error, refetch } = useAppointment(id);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: qk.appointment(id ?? '') });
    void queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
    void queryClient.invalidateQueries({ queryKey: qk.notifications });
    void queryClient.invalidateQueries({ queryKey: ['availability'] });
  };

  const onError = (mutationError: unknown) => {
    notify(
      mutationError instanceof ApiRequestError
        ? mutationError.message
        : 'That action could not be completed.',
      'error',
    );
  };

  const accept = useMutation({
    mutationFn: () => bookingApi.acceptOffer(id as string),
    onSuccess: () => {
      notify('Your appointment is confirmed.', 'success');
      refresh();
    },
    onError,
  });

  const decline = useMutation({
    mutationFn: () => bookingApi.declineOffer(id as string),
    onSuccess: () => {
      setDeclineOpen(false);
      notify('The offered time was declined.');
      refresh();
    },
    onError,
  });

  const cancel = useMutation({
    mutationFn: () => bookingApi.cancel(id as string),
    onSuccess: () => {
      setCancelOpen(false);
      notify('Your appointment was cancelled.');
      refresh();
    },
    onError,
  });

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { appointment } = data;
  const canCancel = ['PENDING', 'CONFIRMED', 'TIME_OFFERED', 'RESCHEDULE_REQUESTED'].includes(
    appointment.status,
  );
  // Asking for a different time only makes sense while a time is actually
  // held. A request already awaiting an answer is excluded so the client
  // cannot stack two proposals on the same appointment.
  const canReschedule = ['PENDING', 'CONFIRMED'].includes(appointment.status);
  const offerExpired =
    appointment.offer && new Date(appointment.offer.expiresAt).getTime() < Date.now();

  return (
    <>
      <Seo title={`${appointment.serviceNameSnapshot} — Nurella`} noIndex />

      <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--nu-space-4)' }}>
        <Link to="/app/appointments" className="nu-eyebrow">
          ← My appointments
        </Link>
      </nav>

      <div className="nu-stack" style={{ gap: 'var(--nu-space-5)' }}>
        <div>
          <div className="nu-row nu-row--between nu-row--wrap" style={{ marginBottom: 'var(--nu-space-3)' }}>
            <h1 className="nu-page-head__title">{appointment.serviceNameSnapshot}</h1>
            <StatusBadge status={appointment.status} />
          </div>
          <p className="nu-page-head__sub">{STATUS_EXPLANATION[appointment.status]}</p>
        </div>

        {/* --- The one action the client may need to take --- */}
        {appointment.status === 'TIME_OFFERED' && appointment.offer && (
          <div className="nu-card" style={{ borderColor: 'var(--nu-status-offered)' }}>
            <p className="nu-eyebrow">A new time has been offered</p>
            <p style={{ fontFamily: 'var(--nu-font-display)', fontSize: 'var(--nu-text-xl)', marginBlock: 'var(--nu-space-2)' }}>
              {formatDateTime(appointment.offer.startAt)}
            </p>
            {appointment.offer.message && (
              <p className="nu-hint" style={{ marginBottom: 'var(--nu-space-3)' }}>
                “{appointment.offer.message}”
              </p>
            )}

            {offerExpired ? (
              <div className="nu-notice nu-notice--warn" role="status">
                This offer has expired. Please book again or contact the lounge.
              </div>
            ) : (
              <>
                <p className="nu-hint">
                  Respond by {formatShortDateTime(appointment.offer.expiresAt)}.
                </p>
                <div className="nu-row" style={{ marginTop: 'var(--nu-space-4)', gap: 'var(--nu-space-3)' }}>
                  <Button loading={accept.isPending} onClick={() => accept.mutate()}>
                    Accept this time
                  </Button>
                  <Button variant="outline" onClick={() => setDeclineOpen(true)}>
                    Decline
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* A request the client has made and is waiting on. Without this the
            proposed time is invisible to the person who proposed it. */}
        {appointment.status === 'RESCHEDULE_REQUESTED' && appointment.rescheduleRequest && (
          <div className="nu-card" style={{ borderColor: 'var(--nu-status-reschedule)' }}>
            <p className="nu-eyebrow">Your reschedule request</p>
            <p
              style={{
                fontFamily: 'var(--nu-font-display)',
                fontSize: 'var(--nu-text-xl)',
                marginBlock: 'var(--nu-space-2)',
              }}
            >
              {formatDateTime(appointment.rescheduleRequest.proposedStartAt)}
            </p>
            {appointment.rescheduleRequest.message && (
              <p className="nu-hint">“{appointment.rescheduleRequest.message}”</p>
            )}
            <p className="nu-hint" style={{ marginTop: 'var(--nu-space-3)' }}>
              Sent {formatShortDateTime(appointment.rescheduleRequest.requestedAt)}. Your current
              time below is still held until the lounge responds.
            </p>
          </div>
        )}

        <div className="nu-card">
          <dl className="nu-deflist">
            <div className="nu-deflist__row">
              <dt className="nu-deflist__key">When</dt>
              <dd>{formatDateTime(appointment.startAt)}</dd>
            </div>
            <div className="nu-deflist__row">
              <dt className="nu-deflist__key">Duration</dt>
              <dd>{formatDuration(appointment.durationMinutes)}</dd>
            </div>
            {/* Shown only when the lounge moved the appointment. */}
            {appointment.requestedStartAt !== appointment.startAt && (
              <div className="nu-deflist__row">
                <dt className="nu-deflist__key">Originally requested</dt>
                <dd>{formatDateTime(appointment.requestedStartAt)}</dd>
              </div>
            )}
            {appointment.clientNotes && (
              <div className="nu-deflist__row">
                <dt className="nu-deflist__key">Your note</dt>
                <dd>{appointment.clientNotes}</dd>
              </div>
            )}
            {appointment.cancellationReason && (
              <div className="nu-deflist__row">
                <dt className="nu-deflist__key">Reason</dt>
                <dd>{appointment.cancellationReason}</dd>
              </div>
            )}
          </dl>
        </div>

        {(canReschedule || canCancel) && (
          <div className="nu-actions">
            {/* Asking for another time comes first: it is the constructive
                action, and burying it behind Cancel is what pushes clients
                into cancelling when all they wanted was a different slot. */}
            {canReschedule && (
              <Button variant="outline" onClick={() => setRescheduleOpen(true)}>
                Request a different time
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                Cancel appointment
              </Button>
            )}
          </div>
        )}

        <section className="nu-card">
          <h2 className="nu-label" style={{ marginBottom: 'var(--nu-space-4)' }}>
            History
          </h2>
          <ol className="nu-timeline">
            {appointment.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="nu-timeline__item">
                <p style={{ fontWeight: 500 }}>{STATUS_LABEL[entry.status]}</p>
                <p className="nu-timeline__when">{formatShortDateTime(entry.at)}</p>
                {entry.note && <p className="nu-hint">{entry.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <RescheduleDialog
        appointment={appointment}
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
      />

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this appointment?"
        description="This releases the time so another client can book it. This cannot be undone."
        footer={
          <>
            {/* Most cancellations are really "this time no longer suits me".
                Offering the reschedule here saves the slot for both sides. */}
            {canReschedule && (
              <Button
                variant="ghost"
                onClick={() => {
                  setCancelOpen(false);
                  setRescheduleOpen(true);
                }}
              >
                Change the time instead
              </Button>
            )}
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel appointment
            </Button>
          </>
        }
      />

      <Dialog
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Decline the offered time?"
        description="Your request will be closed. You can book a new appointment at any time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)}>
              Back
            </Button>
            <Button variant="danger" loading={decline.isPending} onClick={() => decline.mutate()}>
              Decline
            </Button>
          </>
        }
      />
    </>
  );
}

export default ClientAppointmentDetailPage;
