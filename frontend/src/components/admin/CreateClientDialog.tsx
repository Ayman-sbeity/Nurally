import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';

interface CreateClientDialogProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY = { fullName: '', email: '', phone: '', notes: '' };

/**
 * Adds a client from the front desk.
 *
 * No password is collected: the account is created unusable and the client
 * claims it later through "forgot password", so staff never handle client
 * credentials. The copy says so, because the obvious question at reception is
 * "what do I tell them their password is?".
 */
export function CreateClientDialog({ open, onClose }: CreateClientDialogProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const close = () => {
    setForm(EMPTY);
    setIssues({});
    onClose();
  };

  const create = useMutation({
    mutationFn: () =>
      adminApi.createClient({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      }),
    onSuccess: ({ client }) => {
      notify(`${client.fullName} added.`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      close();
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        setIssues(Object.fromEntries(error.issues.map((issue) => [issue.field, issue.message])));
        notify(error.message, 'error');
        return;
      }
      notify('We could not add this client.', 'error');
    },
  });

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add a client"
      description="Creates a client record you can book, photograph and attach files to. No password is set — the client claims their own login with “forgot password” whenever they want app access."
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            Add client
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
        style={{ display: 'grid', gap: 'var(--nu-space-4)' }}
      >
        <TextField
          label="Full name"
          value={form.fullName}
          onChange={(event) => set('fullName')(event.target.value)}
          error={issues.fullName}
          autoComplete="off"
          required
        />
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={(event) => set('email')(event.target.value)}
          error={issues.email}
          hint="Used to identify the client and to claim their login later."
          autoComplete="off"
          required
        />
        <TextField
          label="Phone"
          value={form.phone}
          onChange={(event) => set('phone')(event.target.value)}
          error={issues.phone}
          autoComplete="off"
          required
        />
        <TextAreaField
          label="Internal notes (optional)"
          value={form.notes}
          onChange={(event) => set('notes')(event.target.value)}
          error={issues.notes}
          hint="Only the lounge sees these — never shown to the client."
          rows={3}
        />
        {/* Lets Enter submit the form without a second visible button. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
