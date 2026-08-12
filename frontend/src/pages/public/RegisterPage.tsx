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

/** Mirrors the server's rules so the visitor is told before the round trip. */
const schema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name.').max(120),
  // Optional. The phone number identifies the account when this is left blank —
  // but without an address the password cannot be reset without the lounge.
  email: z
    .union([z.string().trim().email('Please enter a valid email.'), z.literal('')])
    .optional(),
  phone: z
    .string()
    .trim()
    .min(6, 'Please enter a valid phone number.')
    .max(32)
    .regex(/^[+()\d\s-]+$/, 'Digits, spaces, +, -, ( and ) only.'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const redirectTo = (location.state as { from?: string } | null)?.from;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp(values);
      navigate(redirectTo ?? '/app', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError
          ? error.message
          : 'We could not create your account. Please try again.',
      );
    }
  });

  return (
    <>
      <Seo title="Create an account — Nurella Beauty Lounge" noIndex />

      <div>
        <h1 className="nu-heading" style={{ fontSize: 'var(--nu-text-2xl)' }}>
          Create your account
        </h1>
        <p className="nu-hint" style={{ marginTop: 'var(--nu-space-2)' }}>
          Book appointments and follow their status in one place.
        </p>
      </div>

      <form className="nu-stack" onSubmit={onSubmit} noValidate>
        {formError && (
          <div className="nu-notice nu-notice--danger" role="alert">
            {formError}
          </div>
        )}

        <TextField
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <TextField
          label="Email (optional)"
          type="email"
          autoComplete="email"
          hint="Add one if you would like to be able to reset your own password. Without it, only the lounge can reset it for you."
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="tel"
          hint="Used to reach you about your appointment, and to sign in if you did not add an email address."
          error={errors.phone?.message}
          {...register('phone')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, including a letter and a number."
          error={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" block loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="nu-hint" style={{ textAlign: 'center' }}>
        Already have an account?{' '}
        <Link to="/login" state={redirectTo ? { from: redirectTo } : undefined} className="nu-link">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default RegisterPage;
