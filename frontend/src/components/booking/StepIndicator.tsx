import { Fragment } from 'react';

export const BOOKING_STEPS = ['Service', 'Date', 'Time', 'Review'] as const;

interface StepIndicatorProps {
  current: number;
  /** Jumps back to an already-completed step. Omit for a read-only indicator. */
  onGoTo?: (step: number) => void;
}

export function StepIndicator({ current, onGoTo }: StepIndicatorProps) {
  return (
    <ol className="nu-steps" aria-label={`Step ${current + 1} of ${BOOKING_STEPS.length}`}>
      {BOOKING_STEPS.map((label, index) => {
        // Completed steps are the only ones worth going back to: a later step
        // has no answer yet, so jumping forward would land on a dead screen.
        const done = index < current;
        const interactive = done && Boolean(onGoTo);

        const content = (
          <>
            <span className="nu-step__num" aria-hidden="true">
              {done ? '✓' : index + 1}
            </span>
            {/* On narrow screens only the current step keeps its label, so the
                row fits instead of clipping the last word. */}
            <span className="nu-step__label">{label}</span>
          </>
        );

        return (
          <Fragment key={label}>
            {index > 0 && <li className="nu-step__divider" aria-hidden="true" />}
            <li
              className={`nu-step${index === current ? ' is-current' : ''}${done ? ' is-done' : ''}`}
              aria-current={index === current ? 'step' : undefined}
            >
              {interactive ? (
                <button
                  type="button"
                  className="nu-step__btn"
                  onClick={() => onGoTo?.(index)}
                  aria-label={`Go back to step ${index + 1}, ${label}`}
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
