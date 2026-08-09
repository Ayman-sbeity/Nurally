import { useState } from 'react';
import { addDays } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/States';
import { useAvailability } from '@/hooks/queries';
import { dateKey, formatDayLabel } from '@/utils/format';

interface SlotPickerDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  serviceId: string;
  loading?: boolean;
  /** Optional note sent to the client alongside the new time. */
  withMessage?: boolean;
  onConfirm: (startAt: string, message?: string) => void;
}

/**
 * Lets an admin pick a genuinely free slot for an offer or a reschedule.
 *
 * The slots come from the same availability engine clients use, so an admin
 * can never propose a time that is already taken. The server re-checks anyway.
 */
export function SlotPickerDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  serviceId,
  loading,
  withMessage = true,
  onConfirm,
}: SlotPickerDialogProps) {
  const [date, setDate] = useState(() => dateKey(addDays(new Date(), 1)));
  const [slot, setSlot] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const { data, isFetching } = useAvailability(open ? serviceId : undefined, open ? date : undefined);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!slot}
            loading={loading}
            onClick={() => slot && onConfirm(slot, message.trim() || undefined)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="nu-stack">
        <TextField
          label="Date"
          type="date"
          value={date}
          min={dateKey(new Date())}
          onChange={(event) => {
            setDate(event.target.value);
            setSlot(null);
          }}
        />

        <div>
          <p className="nu-label" style={{ marginBottom: 'var(--nu-space-2)' }}>
            Available times — {formatDayLabel(`${date}T00:00:00`)}
          </p>

          {isFetching && <LoadingState label="Checking availability…" />}

          {!isFetching && data && data.slots.length === 0 && (
            <div className="nu-notice nu-notice--warn" role="status">
              No times are available on this date. Please choose another.
            </div>
          )}

          {!isFetching && data && data.slots.length > 0 && (
            <div className="nu-slots" role="group" aria-label="Choose a time">
              {data.slots.map((option) => (
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
          )}
        </div>

        {withMessage && (
          <TextAreaField
            label="Message to the client (optional)"
            value={message}
            maxLength={500}
            onChange={(event) => setMessage(event.target.value)}
          />
        )}
      </div>
    </Dialog>
  );
}
