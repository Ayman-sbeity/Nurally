import { useId, useRef } from 'react';

export interface SegmentedTab<T extends string> {
  key: T;
  label: string;
  /** Optional count shown after the label, e.g. "Upcoming 3". */
  count?: number;
}

interface SegmentedTabsProps<T extends string> {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Labels the tablist for screen readers, e.g. "Filter appointments". */
  label: string;
  /** `id` of the element the tabs control; it must carry role="tabpanel". */
  controls: string;
  className?: string;
}

/**
 * The segmented filter control, implemented as real ARIA tabs.
 *
 * The markup this replaces used role="tablist"/role="tab" without the two
 * things that make the pattern work: an association with the panel being
 * switched, and roving-tabindex keyboard support. Announced as tabs but
 * behaving like plain buttons is worse than either — a screen-reader user is
 * told to expect arrow-key navigation that does not exist.
 *
 * Here: exactly one tab is tabbable, arrows move between them (wrapping),
 * Home/End jump to the ends, and each tab points at the panel it controls.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  controls,
  className,
}: SegmentedTabsProps<T>) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const move = (delta: number) => {
    const index = tabs.findIndex((tab) => tab.key === value);
    if (index < 0) return;
    // Wraps, which is what the WAI-ARIA tabs pattern specifies.
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    if (next) focusAndSelect(next.key);
  };

  const focusAndSelect = (key: T) => {
    onChange(key);
    // Selection follows focus, so the newly selected tab must also hold it.
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${baseId}-${key}`)}`)?.focus();
    });
  };

  return (
    <div
      ref={listRef}
      className={className ? `nu-segmented ${className}` : 'nu-segmented'}
      role="tablist"
      aria-label={label}
      onKeyDown={(event) => {
        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            event.preventDefault();
            move(1);
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            event.preventDefault();
            move(-1);
            break;
          case 'Home':
            event.preventDefault();
            if (tabs[0]) focusAndSelect(tabs[0].key);
            break;
          case 'End':
            event.preventDefault();
            if (tabs[tabs.length - 1]) focusAndSelect(tabs[tabs.length - 1]!.key);
            break;
          default:
        }
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <button
            key={tab.key}
            id={`${baseId}-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={controls}
            // Roving tabindex: Tab enters the group once, arrows move within it.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className="nu-segmented__count" aria-hidden="true">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
