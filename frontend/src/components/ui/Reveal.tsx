import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { createElement } from 'react';

interface RevealProps {
  children: ReactNode;
  /** Stagger position when several items reveal together. */
  delay?: number;
  direction?: 'up' | 'left' | 'right' | 'none';
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}

const OFFSET = 28;

/**
 * Scroll-triggered entrance used across the landing page.
 *
 * Two deliberate escape hatches, because a decorative animation must never be
 * the reason content is invisible:
 *
 * 1. `prefers-reduced-motion` renders the children plainly, with no animation
 *    and no starting opacity of 0.
 * 2. If `IntersectionObserver` is unavailable, the same plain path is used —
 *    otherwise the entrance would never trigger and the section would stay
 *    blank.
 */
export function Reveal({
  children,
  delay = 0,
  direction = 'up',
  className,
  as = 'div',
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const canObserve = typeof IntersectionObserver !== 'undefined';

  if (reduceMotion || !canObserve) {
    return createElement(as, className ? { className } : {}, children);
  }

  const offset =
    direction === 'none'
      ? {}
      : { up: { y: OFFSET }, left: { x: -OFFSET }, right: { x: OFFSET } }[direction];

  const Component = motion[as];

  return (
    <Component
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}
