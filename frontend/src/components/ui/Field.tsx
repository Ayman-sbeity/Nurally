import { forwardRef, useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/**
 * Wires label, hint and error message to the control with the right ARIA
 * relationships, so every form in the product is accessible by construction.
 */
function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="nu-field">
      <label className="nu-label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy: describedBy || undefined, invalid: Boolean(error) })}
      {hint && !error && (
        <p className="nu-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="nu-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = { label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>;

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, error, hint, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          ref={ref}
          id={id}
          className="nu-input"
          aria-describedby={describedBy}
          aria-invalid={invalid}
        />
      )}
    </FieldShell>
  );
});

type TextAreaProps = { label: string; error?: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextAreaField(
  { label, error, hint, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...rest}
          ref={ref}
          id={id}
          className="nu-textarea"
          aria-describedby={describedBy}
          aria-invalid={invalid}
        />
      )}
    </FieldShell>
  );
});

type SelectProps = {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>;

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, error, hint, children, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <select
          {...rest}
          ref={ref}
          id={id}
          className="nu-select"
          aria-describedby={describedBy}
          aria-invalid={invalid}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
});
