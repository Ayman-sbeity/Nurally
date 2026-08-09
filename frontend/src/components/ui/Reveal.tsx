import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

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
 * `prefers-reduced-motion` collapses it to a plain fade with no movement, and
 * `once: true` means content never re-animates as the visitor scrolls back.
 */
export function Reveal({
  children,
  delay = 0,
  direction = 'up',
  className,
  as = 'div',
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];

  const offset = reduceMotion || direction === 'none' ? {} : {
    up: { y: OFFSET },
    left: { x: -OFFSET },
    right: { x: OFFSET },
  }[direction];

  return (
    <Component
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: reduceMotion ? 0.01 : 0.7,
        delay: reduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </Component>
  );
}
