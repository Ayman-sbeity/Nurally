import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';

const schema = z.object({
  email: z.string().trim().min(1, 'Please enter your email.').email('Please enter a valid email.'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await authApi.forgotPassword(values.email);
      setSent(true);
      // Development only: no mail transport is configured, so the API returns
      // the token directly to keep the flow testable end to end.
      setDevToken(result.resetToken ?? null);
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError ? error.message : 'We could not process that request.',
      );
    }
  });

  return (
    <>
      <Seo title="Reset your password — Nurella Beauty Lounge" noIndex />

      <div>
        <h1 className="nu-heading" style={{ fontSize: 'var(--nu-text-2xl)' }}>
          Reset your password
        </h1>
        <p className="nu-hint" style={{ marginTop: 'var(--nu-space-2)' }}>
          Enter the email address on your account.
        </p>
      </div>

      {sent ? (
        <div className="nu-stack">
          <div className="nu-notice nu-notice--success" role="status">
            If an account exists for that email address, a password reset link has been generated.
          </div>

          {devToken && (
            <div className="nu-notice nu-notice--warn">
              <div>
                <strong>Development only.</strong> No email provider is configured, so the reset
                token is shown here.
                <p style={{ wordBreak: 'break-all', marginTop: 'var(--nu-space-2)' }}>{devToken}</p>
                <Link className="nu-link" to={`/reset-password?token=${devToken}`}>
                  Continue to reset your password
                </Link>
              </div>
            </div>
          )}

          <Link to="/login" className="nu-btn nu-btn--outline nu-btn--block">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="nu-stack" onSubmit={onSubmit} noValidate>
          {formError && (
            <div className="nu-notice nu-notice--danger" role="alert">
              {formError}
            </div>
          )}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" block loading={isSubmitting}>
            Send reset link
          </Button>
          <Link to="/login" className="nu-hint" style={{ textAlign: 'center' }}>
            Back to sign in
          </Link>
        </form>
      )}
    </>
  );
}

export default ForgotPasswordPage;
