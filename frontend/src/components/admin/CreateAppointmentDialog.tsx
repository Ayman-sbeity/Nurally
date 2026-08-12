import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useAdminAvailability, useAdminClients, useServices } from '@/hooks/queries';
import type { Appointment, User } from '@/types/api';
import { dateKey, formatDayLabel, formatDuration } from '@/utils/format';

/** The subset of a client this dialog needs — a list row or a full record. */
type PickedClient = Pick<User, '_id' | 'fullName' | 'email' | 'phone'>;

interface CreateAppointmentDialogProps {
  onClose: () => void;
  /** Preselects the client, for booking from their own record. */
  client?: PickedClient;
  /** Day to open on — the calendar day the admin was looking at. */
  defaultDate?: string;
  onCreated?: (appointment: Appointment) => void;
}

const CLOSED_MESSAGE: Record<string, string> = {
  DAY_OFF: 'The lounge is closed on this day.',
  BLOCKED: 'The lounge is unavailable on this day.',
  FULLY_BOOKED: 'Every slot on this date is taken.',
  PAST: 'This date has already passed.',
  TOO_FAR_AHEAD: 'This date is beyond the booking window.',
  SERVICE_DAY_OFF: 'This treatment is not performed on this day.',
};

/**
 * Books a client in from the front desk.
 *
 * Staff pick from the same slot ladder the booking flow uses, so a phone or
 * walk-in booking can never land on a closed day or on top of another
 * appointment — with one deliberate difference: the minimum-notice window is
 * lifted, because the client whose booking this is may be standing at the desk.
 * The appointment is created already confirmed and the client is notified.
 */
export function CreateAppointmentDialog({
  onClose,
  client,
  defaultDate,
  onCreated,
}: CreateAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [selectedClient, setSelectedClient] = useState<PickedClient | null>(client ?? null);
  const [clientQuery, setClientQuery] = useState('');
  const [search, setSearch] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(() => defaultDate ?? dateKey(new Date()));
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Search as the admin types, once they pause. A front-desk picker that needs
  // a button press before it shows anyone gets used wrong under pressure.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(clientQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [clientQuery]);

  const clients = useAdminClients({
    ...(search ? { search } : {}),
    isActive: true,
    page: 1,
  });
  const services = useServices();
  const availability = useAdminAvailability(serviceId || undefined, serviceId ? date : undefined);

  const categories = services.data?.categories ?? [];
  const service = useMemo(
    () => services.data?.services.find((entry) => entry._id === serviceId),
    [services.data, serviceId],
  );

  const create = useMutation({
    mutationFn: () =>
      adminApi.createAppointment({
        clientId: selectedClient?._id as string,
        serviceId,
        startAt: slot as string,
        ...(notes.trim() ? { clientNotes: notes.trim() } : {}),
      }),
    onSuccess: ({ appointment }) => {
      notify('Appointment booked. The client has been notified.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
      onCreated?.(appointment);
      onClose();
    },
    onError: (error) => {
      notify(
        error instanceof ApiRequestError ? error.message : 'This appointment could not be booked.',
        'error',
      );
      // The slot list the admin saw is now suspect — refetch before they retry.
      void availability.refetch();
    },
  });

  const ready = Boolean(selectedClient && serviceId && slot);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Book an appointment"
      description="Books an existing client in directly. It is confirmed straight away — no approval step — and the client is notified."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button disabled={!ready} loading={create.isPending} onClick={() => create.mutate()}>
            Book appointment
          </Button>
        </>
      }
    >
      <div className="nu-stack">
        {selectedClient ? (
          <div className="nu-picked">
            <div>
              <p className="nu-label">Client</p>
              <p>{selectedClient.fullName}</p>
              <p className="nu-hint">{selectedClient.phone ?? selectedClient.email}</p>
            </div>
            {/* Preselected from a client's own record — changing who the
                appointment is for there would be a surprise, so it is fixed. */}
            {!client && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                Change
              </Button>
            )}
          </div>
        ) : (
          <div>
            <TextField
              label="Client"
              type="search"
              placeholder="Search by name, email or phone"
              value={clientQuery}
              onChange={(event) => setClientQuery(event.target.value)}
              hint="Only registered clients can be booked. Add the client first if they are new."
              autoComplete="off"
              autoFocus
            />

            {clients.isPending && <LoadingState label="Searching…" />}
            {clients.isError && (
              <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
            )}

            {clients.data && clients.data.items.length === 0 && (
              <div className="nu-notice nu-notice--warn" role="status">
                {search
                  ? `No active client matches “${search}”.`
                  : 'There are no active clients yet.'}
              </div>
            )}

            {clients.data && clients.data.items.length > 0 && (
              <ul className="nu-picker">
                {clients.data.items.slice(0, 6).map((entry) => (
                  <li key={entry._id}>
                    <button
                      type="button"
                      className="nu-picker__option"
                      onClick={() => setSelectedClient(entry)}
                    >
                      <span>{entry.fullName}</span>
                      <span className="nu-hint">{entry.phone ?? entry.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <SelectField
          label="Treatment"
          value={serviceId}
          onChange={(event) => {
            setServiceId(event.target.value);
            setSlot(null);
          }}
          hint={service ? formatDuration(service.durationMinutes) : undefined}
        >
          <option value="">Choose a treatment…</option>
          {categories.map((category) => (
            <optgroup key={category.slug} label={category.label}>
              {category.services.map((entry) => (
                <option key={entry._id} value={entry._id}>
                  {entry.name}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>

        {serviceId && (
          <>
            <TextField
              label="Date"
              type="date"
              value={date}
              min={dateKey(new Date())}
              max={availability.data?.maxBookableDate ?? dateKey(addDays(new Date(), 60))}
              onChange={(event) => {
                setDate(event.target.value);
                setSlot(null);
              }}
            />

            <div>
              <p className="nu-label" style={{ marginBottom: 'var(--nu-space-2)' }}>
                Available times — {formatDayLabel(`${date}T00:00:00`)}
              </p>

              {availability.isFetching && <LoadingState label="Checking availability…" />}

              {!availability.isFetching && availability.data && availability.data.slots.length === 0 && (
                <div className="nu-notice nu-notice--warn" role="status">
                  {CLOSED_MESSAGE[availability.data.closedReason ?? 'FULLY_BOOKED'] ??
                    CLOSED_MESSAGE.FULLY_BOOKED}{' '}
                  Please choose another date.
                </div>
              )}

              {!availability.isFetching && availability.data && availability.data.slots.length > 0 && (
                <>
                  <div className="nu-slots" role="group" aria-label="Choose a time">
                    {availability.data.slots.map((option) => (
                      <button
                        key={option.startAt}
                        type="button"
                        className="nu-slot"
                        aria-pressed={slot === option.startAt}
                        onClick={() => setSlot(option.startAt)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="nu-hint" style={{ marginTop: 'var(--nu-space-2)' }}>
                    Times are in the lounge timezone ({availability.data.timezone}).
                  </p>
                </>
              )}
            </div>
          </>
        )}

        <TextAreaField
          label="Booking notes (optional)"
          value={notes}
          maxLength={1000}
          rows={2}
          onChange={(event) => setNotes(event.target.value)}
          hint="Anything the client asked for. Shown on the appointment."
        />
      </div>
    </Dialog>
  );
}
