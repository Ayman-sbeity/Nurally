import { useState } from 'react';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextAreaField } from '@/components/ui/Field';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
  /** Shows a free-text reason field, passed back to `onConfirm`. */
  withReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason?: string) => void;
}

/** Used for every state change an admin cannot undo. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  loading,
  withReason,
  reasonLabel = 'Reason (optional)',
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');

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
            variant={confirmVariant}
            loading={loading}
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {withReason && (
        <TextAreaField
          label={reasonLabel}
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          hint="This is shared with the client."
        />
      )}
    </Dialog>
  );
}
