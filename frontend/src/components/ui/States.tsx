import type { ReactNode } from 'react';
import { ApiRequestError } from '@/api/client';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="nu-state" role="status" aria-live="polite">
      <span className="nu-spinner" aria-hidden="true" />
      <span className="nu-sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="nu-state">
      <p className="nu-state__title">{title}</p>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

/**
 * Turns any thrown error into a message the visitor can act on. Auth and
 * network failures read very differently, so they are separated here rather
 * than collapsed into a generic "something went wrong".
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = error instanceof ApiRequestError ? error : null;

  const title =
    apiError?.status === 403
      ? 'You do not have access to this'
      : apiError?.status === 404
        ? 'Not found'
        : apiError?.code === 'NETWORK_ERROR'
          ? 'No connection'
          : 'Something went wrong';

  const message =
    apiError?.message ?? 'We could not complete that request. Please try again in a moment.';

  return (
    <div className="nu-state" role="alert">
      <p className="nu-state__title">{title}</p>
      <p>{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function SkeletonList({ rows = 3, height = 88 }: { rows?: number; height?: number }) {
  return (
    <div className="nu-stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="nu-skeleton" style={{ height }} />
      ))}
    </div>
  );
}
