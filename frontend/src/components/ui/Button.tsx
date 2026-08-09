import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export type ButtonVariant =
  | 'primary'
  | 'gold'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'on-dark'
  | 'on-dark-outline';

interface CommonProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

const classesFor = ({ variant = 'primary', size, block, className }: CommonProps): string =>
  clsx(
    'nu-btn',
    `nu-btn--${variant}`,
    size === 'sm' && 'nu-btn--sm',
    block && 'nu-btn--block',
    className,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, loading, children, className, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classesFor({ variant, size, block, className, children })}
      disabled={disabled || loading}
      // Tells assistive tech the control is working rather than unresponsive.
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="nu-spinner nu-spinner--sm" aria-hidden="true" />}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends CommonProps {
  to: string;
  state?: unknown;
  onClick?: () => void;
}

/** Same visual language as `Button`, but a real link for real navigation. */
export function ButtonLink({ to, state, onClick, ...rest }: ButtonLinkProps) {
  return (
    <Link to={to} state={state} onClick={onClick} className={classesFor(rest)}>
      {rest.children}
    </Link>
  );
}
