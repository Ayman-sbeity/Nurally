import { Fragment } from 'react';

export const BOOKING_STEPS = ['Service', 'Date', 'Time', 'Review'] as const;

export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="nu-steps" aria-label={`Step ${current + 1} of ${BOOKING_STEPS.length}`}>
      {BOOKING_STEPS.map((label, index) => (
        <Fragment key={label}>
          {index > 0 && <li className="nu-step__divider" aria-hidden="true" />}
          <li
            className={`nu-step${index === current ? ' is-current' : ''}${
              index < current ? ' is-done' : ''
            }`}
            aria-current={index === current ? 'step' : undefined}
          >
            <span className="nu-step__num" aria-hidden="true">
              {index < current ? '✓' : index + 1}
            </span>
            {/* On narrow screens only the current step keeps its label, so the
                row fits instead of clipping the last word. */}
            <span className="nu-step__label">{label}</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
