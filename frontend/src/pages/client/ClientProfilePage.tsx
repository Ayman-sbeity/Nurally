import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { usePwaInstall } from '@/hooks/usePwaInstall';

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name.').max(120),
  phone: z
    .string()
    .trim()
    .min(6, 'Please enter a valid phone number.')
    .max(32)
    .regex(/^[+()\d\s-]+$/, 'Digits, spaces, +, -, ( and ) only.'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password.'),
  newPassword: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export function ClientProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { notify } = useToast();
  const { canInstall, isInstalled, promptInstall, showIosHint } = usePwaInstall();
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user?.fullName ?? '', phone: user?.phone ?? '' },
  });

  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const saveProfile = useMutation({
    mutationFn: (values: ProfileValues) => authApi.updateProfile(values),
    onSuccess: ({ user: updated }) => {
      updateUser(updated);
      notify('Your details were updated.', 'success');
    },
    onError: (error) =>
      notify(
        error instanceof ApiRequestError ? error.message : 'We could not save your details.',
        'error',
      ),
  });

  const changePassword = useMutation({
    mutationFn: (values: PasswordValues) =>
      authApi.changePassword(values.currentPassword, values.newPassword),
    onSuccess: async () => {
      notify('Password updated. Please sign in again.', 'success');
      // The server rotates the token version, so every session is now invalid.
      await logout();
    },
    onError: (error) =>
      setPasswordError(
        error instanceof ApiRequestError ? error.message : 'We could not update your password.',
      ),
  });

  return (
    <>
      <Seo title="Your profile — Nurella" noIndex />

      <div className="nu-page-head">
        <h1 className="nu-page-head__title">Your profile</h1>
        <p className="nu-page-head__sub">{user?.email}</p>
      </div>

      <div className="nu-stack" style={{ gap: 'var(--nu-space-6)' }}>
        <section className="nu-card">
          <h2 className="nu-label" style={{ marginBottom: 'var(--nu-space-4)' }}>
            Your details
          </h2>
          <form
            className="nu-stack"
            onSubmit={profileForm.handleSubmit((values) => saveProfile.mutate(values))}
            noValidate
          >
            <TextField
              label="Full name"
              autoComplete="name"
              error={profileForm.formState.errors.fullName?.message}
              {...profileForm.register('fullName')}
            />
            <TextField
              label="Phone"
              type="tel"
              autoComplete="tel"
              error={profileForm.formState.errors.phone?.message}
              {...profileForm.register('phone')}
            />
            <div>
              <Button type="submit" loading={saveProfile.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </section>

        <section className="nu-card">
          <h2 className="nu-label" style={{ marginBottom: 'var(--nu-space-4)' }}>
            Password
          </h2>
          <form
            className="nu-stack"
            onSubmit={passwordForm.handleSubmit((values) => {
              setPasswordError(null);
              changePassword.mutate(values);
            })}
            noValidate
          >
            {passwordError && (
              <div className="nu-notice nu-notice--danger" role="alert">
                {passwordError}
              </div>
            )}
            <TextField
              label="Current password"
              type="password"
              autoComplete="current-password"
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register('currentPassword')}
            />
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters, including a letter and a number."
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register('newPassword')}
            />
            <p className="nu-hint">Changing your password signs you out of all devices.</p>
            <div>
              <Button type="submit" variant="outline" loading={changePassword.isPending}>
                Update password
              </Button>
            </div>
          </form>
        </section>

        <section className="nu-card">
          <h2 className="nu-label" style={{ marginBottom: 'var(--nu-space-3)' }}>
            App
          </h2>
          {isInstalled ? (
            <p className="nu-hint">Nurella is installed on this device.</p>
          ) : showIosHint ? (
            <p className="nu-hint">
              To install: tap the Share button in Safari, then “Add to Home Screen”.
            </p>
          ) : canInstall ? (
            <Button variant="outline" onClick={() => void promptInstall()}>
              Add to home screen
            </Button>
          ) : (
            <p className="nu-hint">
              Install Nurella from your browser menu to book from your home screen.
            </p>
          )}
        </section>

        <div>
          <Button variant="danger" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </div>
    </>
  );
}

export default ClientProfilePage;
