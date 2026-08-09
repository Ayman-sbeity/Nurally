import { useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { useAvailabilityOverview } from '@/hooks/queries';
import { dateKey } from '@/utils/format';

interface DateStepProps {
  serviceId: string;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

const WINDOW_DAYS = 14;

/**
 * Horizontal date strip.
 *
 * The overview endpoint reports which days actually have openings, so days
 * with nothing free are disabled rather than letting the visitor tap into an
 * empty screen.
 */
export function DateStep({ serviceId, selectedDate, onSelect }: DateStepProps) {
  const [offset, setOffset] = useState(0);
  const from = dateKey(addDays(new Date(), offset));

  const { data, isPending, isError, error, refetch } = useAvailabilityOverview(
    serviceId,
    from,
    WINDOW_DAYS,
  );

  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const days = data?.days ?? [];
  const maxDate = data?.maxBookableDate;
  const reachedEnd = maxDate ? (days[days.length - 1]?.date ?? '') >= maxDate : false;

  return (
    <div className="nu-stack">
      <div className="nu-row nu-row--between">
        <Button
          variant="ghost"
          size="sm"
          disabled={offset === 0}
          onClick={() => setOffset((value) => Math.max(0, value - WINDOW_DAYS))}
        >
          ← Earlier
        </Button>
        <span className="nu-hint">
          {days.length > 0 &&
            `${format(parseISO(days[0]?.date ?? from), 'd MMM')} – ${format(
              parseISO(days[days.length - 1]?.date ?? from),
              'd MMM',
            )}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={reachedEnd}
          onClick={() => setOffset((value) => value + WINDOW_DAYS)}
        >
          Later →
        </Button>
      </div>

      {isPending ? (
        <div className="nu-skeleton" style={{ height: 88 }} aria-hidden="true" />
      ) : (
        <div className="nu-dates" role="group" aria-label="Choose a date">
          {days.map((day) => {
            const date = parseISO(day.date);
            return (
              <button
                key={day.date}
                type="button"
                className="nu-date"
                aria-pressed={selectedDate === day.date}
                disabled={!day.hasSlots}
                aria-label={`${format(date, 'EEEE d MMMM')}${
                  day.hasSlots ? `, ${day.slotCount} times available` : ', no availability'
                }`}
                onClick={() => onSelect(day.date)}
              >
                <span className="nu-date__dow">{format(date, 'EEE')}</span>
                <span className="nu-date__num">{format(date, 'd')}</span>
                {day.hasSlots ? (
                  <span className="nu-date__dot" aria-hidden="true" />
                ) : (
                  <span style={{ height: 4 }} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {!isPending && days.every((day) => !day.hasSlots) && (
        <div className="nu-notice nu-notice--warn" role="status">
          No appointments are available in these dates. Please look at later dates.
        </div>
      )}
    </div>
  );
}
