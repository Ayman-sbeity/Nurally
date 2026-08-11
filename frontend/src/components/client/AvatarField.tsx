import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/auth.api';
import { ApiRequestError } from '@/api/client';
import { Avatar, forgetAvatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

/** Mirrors the formats the server's signature check accepts. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 15;

/**
 * Upload, replace and remove your own profile photo.
 *
 * The file is validated here before it is sent — not as a security measure,
 * since the server checks the actual bytes regardless, but so that picking a
 * 40MB HEIC from a phone fails instantly instead of after a long upload on a
 * mobile connection.
 */
export function AvatarField() {
  const { user, updateUser } = useAuth();
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: ({ avatarUpdatedAt }) => {
      if (user) {
        forgetAvatar(user._id);
        updateUser({ ...user, avatarUpdatedAt });
      }
      notify('Your photo was updated.', 'success');
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiRequestError
          ? mutationError.message
          : 'That photo could not be uploaded.',
      ),
  });

  const remove = useMutation({
    mutationFn: () => authApi.removeAvatar(),
    onSuccess: () => {
      if (user) {
        forgetAvatar(user._id);
        const { avatarUpdatedAt: _removed, ...rest } = user;
        updateUser(rest);
      }
      notify('Your photo was removed.');
    },
    onError: () => notify('That photo could not be removed.', 'error'),
  });

  if (!user) return null;

  const choose = (file: File | undefined) => {
    setError(null);
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      setError('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That image is larger than ${MAX_MB} MB.`);
      return;
    }
    upload.mutate(file);
  };

  const busy = upload.isPending || remove.isPending;

  return (
    <div className="nu-avatar-field">
      <Avatar
        userId={user._id}
        fullName={user.fullName}
        updatedAt={user.avatarUpdatedAt}
        size={88}
      />

      <div className="nu-avatar-field__controls">
        <p className="nu-label">Profile photo</p>
        <p className="nu-hint">
          JPEG, PNG or WebP, up to {MAX_MB} MB. Only you and the lounge can see it.
        </p>

        <div className="nu-row" style={{ gap: 'var(--nu-space-3)', marginTop: 'var(--nu-space-3)' }}>
          {/* A hidden input driven by a real button: the native file control
              cannot be styled, and its default label reads "No file chosen". */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            className="nu-sr-only"
            // Clearing the value lets the same file be re-picked after an error.
            onChange={(event) => {
              choose(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            size="sm"
            variant="outline"
            loading={upload.isPending}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {user.avatarUpdatedAt ? 'Change photo' : 'Upload photo'}
          </Button>

          {user.avatarUpdatedAt && (
            <Button
              size="sm"
              variant="ghost"
              loading={remove.isPending}
              disabled={busy}
              onClick={() => remove.mutate()}
            >
              Remove
            </Button>
          )}
        </div>

        {error && (
          <p className="nu-error" role="alert" style={{ marginTop: 'var(--nu-space-3)' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
