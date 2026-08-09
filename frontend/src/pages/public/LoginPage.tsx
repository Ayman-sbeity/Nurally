import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { useAuth } from '@/context/AuthContext';

const schema = z.object({
  email: z.string().trim().min(1, 'Please enter your email.').email('Please enter a valid email.'),
  password: z.string().min(1, 'Please enter your password.'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  // Set by the route guard or a "book this service" click.
  const redirectTo = (location.state as { from?: string } | null)?.from;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      const fallback = user.role === 'ADMIN' ? '/admin' : '/app';
      navigate(redirectTo ?? fallback, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError ? error.message : 'We could not sign you in. Please try again.',
      );
    }
  });

  return (
    <>
      <Seo title="Sign in — Nurella Beauty Lounge" noIndex />

      <div>
        <h1 className="nu-heading" style={{ fontSize: 'var(--nu-text-2xl)' }}>
          Welcome back
        </h1>
        <p className="nu-hint" style={{ marginTop: 'var(--nu-space-2)' }}>
          Sign in to book and manage your appointments.
        </p>
      </div>

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
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" block loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <div className="nu-stack" style={{ gap: 'var(--nu-space-2)', textAlign: 'center' }}>
        <Link to="/forgot-password" className="nu-hint">
          Forgot your password?
        </Link>
        <p className="nu-hint">
          New to Nurella?{' '}
          <Link to="/register" state={redirectTo ? { from: redirectTo } : undefined} className="nu-link">
            Create an account
          </Link>
        </p>
      </div>
    </>
  );
}

export default LoginPage;
