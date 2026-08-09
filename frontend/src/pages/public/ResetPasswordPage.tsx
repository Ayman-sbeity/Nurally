import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { useToast } from '@/context/ToastContext';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/\d/, 'Include at least one number.'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const { notify } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authApi.resetPassword(token, values.password);
      notify('Your password has been updated. Please sign in.', 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError ? error.message : 'We could not reset your password.',
      );
    }
  });

  if (!token) {
    return (
      <>
        <Seo title="Reset your password — Nurella Beauty Lounge" noIndex />
        <div className="nu-notice nu-notice--danger" role="alert">
          This reset link is missing its token. Please request a new one.
        </div>
        <Link to="/forgot-password" className="nu-btn nu-btn--outline nu-btn--block">
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <Seo title="Choose a new password — Nurella Beauty Lounge" noIndex />

      <div>
        <h1 className="nu-heading" style={{ fontSize: 'var(--nu-text-2xl)' }}>
          Choose a new password
        </h1>
      </div>

      <form className="nu-stack" onSubmit={onSubmit} noValidate>
        {formError && (
          <div className="nu-notice nu-notice--danger" role="alert">
            {formError}
          </div>
        )}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, including a letter and a number."
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        <Button type="submit" block loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </>
  );
}

export default ResetPasswordPage;
