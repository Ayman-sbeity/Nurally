import type { ReactNode } from 'react';

/**
 * Line icons for the public site, drawn on a 24px grid in `currentColor` so
 * they take the gold (or ink) of whatever they sit in. Always decorative: every
 * icon is paired with a visible label, so none is announced.
 */
const PATHS = {
  diamond: (
    <>
      <path d="M6.5 4h11L21 9l-9 11L3 9z" />
      <path d="M3 9h18M8 9l4-5 4 5M8 9l4 11 4-11" />
    </>
  ),
  lotus: (
    <>
      <path d="M12 4c2 2.2 3 4.6 3 7.2S13.9 16 12 18c-1.9-2-3-4.2-3-6.8S10 6.2 12 4z" />
      <path d="M12 18c-3.6 0-7-2.2-8.5-6.2 2.8-.4 5 .3 6.6 1.8M12 18c3.6 0 7-2.2 8.5-6.2-2.8-.4-5 .3-6.6 1.8M5 20.5h14" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.3-2.9 7.9-7 9.5-4.1-1.6-7-5.2-7-9.5V6z" />
      <path d="M8.8 12.2l2.2 2.2 4.3-4.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  'chevron-down': <path d="M6 9.5l6 6 6-6" />,
  laser: (
    <>
      <path d="M13.5 3.5l7 7-2.5 2.5-7-7z" />
      <path d="M11 9.5L4 16.5M3 20.5l1.5-1.5M7.5 20.5L7 18.5M3.5 15.5l2 .5" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" />
      <path d="M5 19c3-4 6-7 10-10" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 3.5c3.5 4.2 6 7.6 6 10.5a6 6 0 0 1-12 0c0-2.9 2.5-6.3 6-10.5z" />
      <path d="M9.5 14.5A2.5 2.5 0 0 0 12 17" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
