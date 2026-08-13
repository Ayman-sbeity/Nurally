import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { staffApi, type CreateStaffPayload, type UpdateStaffPayload } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { PermissionGrid } from '@/components/admin/PermissionGrid';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { useToast } from '@/context/ToastContext';
import type { PermissionSchema, StaffMember, StaffPermission } from '@/types/api';

interface StaffDialogProps {
  schema: PermissionSchema;
  /** Absent when adding someone new. */
  member?: StaffMember;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * What a new employee starts with: the two sections that make the admin usable
 * at all, and nothing that writes. The owner grants the rest deliberately.
 */
const DEFAULT_PERMISSIONS: StaffPermission[] = [
  { resource: 'DASHBOARD', actions: ['VIEW'] },
  { resource: 'APPOINTMENTS', actions: ['VIEW'] },
];

export function StaffDialog({ schema, member, onClose, onSaved }: StaffDialogProps) {
  const { notify } = useToast();
  const isEditing = Boolean(member);

  const [fullName, setFullName] = useState(member?.fullName ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [jobTitle, setJobTitle] = useState(member?.jobTitle ?? '');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<StaffPermission[]>(
    member?.staffPermissions ?? DEFAULT_PERMISSIONS,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      if (member) {
        const payload: UpdateStaffPayload = {
          fullName,
          phone: phone.trim(),
          // Sent even when blank: the server reads an empty value as "clear
          // this", which is the only way to remove an address once added.
          email: email.trim(),
          jobTitle: jobTitle.trim(),
          permissions,
          // Only sent when the owner typed one, so saving permissions cannot
          // blank an employee's existing password.
          ...(password ? { password } : {}),
        };
        return staffApi.update(member._id, payload);
      }

      const payload: CreateStaffPayload = {
        fullName,
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
        password,
        permissions,
      };
      return staffApi.create(payload);
    },
    onSuccess: ({ message }) => {
      notify(message, 'success');
      onSaved();
      onClose();
    },
    onError: (cause) =>
      setFormError(
        cause instanceof ApiRequestError
          ? cause.message
          : 'That team member could not be saved.',
      ),
  });

  const ready =
    fullName.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    (isEditing || password.length >= 8);

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEditing ? `Edit ${member?.fullName}` : 'Add team member'}
      description={
        isEditing
          ? 'Changing access signs them out, so the new permissions apply straight away.'
          : 'They sign in with this phone number and see only the sections you tick.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button disabled={!ready} loading={save.isPending} onClick={() => save.mutate()}>
            {isEditing ? 'Save changes' : 'Add team member'}
          </Button>
        </>
      }
    >
      <div className="nu-stack">
        {formError && (
          <div className="nu-notice nu-notice--danger" role="alert">
            {formError}
          </div>
        )}

        <TextField
          label="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="off"
          autoFocus={!isEditing}
        />
        {/* Phone first and required: employees sign in with it, exactly as
            clients do, so the whole app has one sign-in rule. */}
        <TextField
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          hint="This is how they sign in."
          autoComplete="off"
        />
        <TextField
          label="Email (optional)"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          hint="Only for reaching them. Not needed to sign in — you reset their password from this page."
          autoComplete="off"
        />
        <TextField
          label="Job title (optional)"
          value={jobTitle}
          onChange={(event) => setJobTitle(event.target.value)}
          hint="Shown beside their name, e.g. Laser technician."
          autoComplete="off"
        />
        <TextField
          label={isEditing ? 'New password (optional)' : 'Password'}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={
            isEditing
              ? 'Leave blank to keep their current password. Setting one signs them out everywhere.'
              : 'At least 8 characters, including a letter and a number. Share it with them privately.'
          }
          autoComplete="new-password"
        />

        <div>
          <p className="nu-label" style={{ marginBottom: 'var(--nu-space-2)' }}>
            Access
          </p>
          <PermissionGrid
            schema={schema}
            value={permissions}
            onChange={setPermissions}
            disabled={save.isPending}
          />
        </div>
      </div>
    </Dialog>
  );
}
