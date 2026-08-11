import { Button } from '@/components/ui/Button';
import { ErrorState, SkeletonList } from '@/components/ui/States';
import { useAvailability } from '@/hooks/queries';
import { formatDayLabel } from '@/utils/format';

interface TimeStepProps {
  serviceId: string;
  date: string;
  selectedSlot: string | null;
  onSelect: (startAt: string) => void;
  onChangeDate: () => void;
}

const CLOSED_MESSAGE: Record<string, string> = {
  DAY_OFF: 'The lounge is closed on this day.',
  BLOCKED: 'The lounge is unavailable on this day.',
  FULLY_BOOKED: 'No appointments are available for this date.',
  PAST: 'This date has already passed.',
  TOO_FAR_AHEAD: 'This date is beyond the current booking window.',
  SERVICE_DAY_OFF: 'This treatment is not performed on this day.',
};

const WEEKDAY_NAMES = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];

/** "Wednesdays", "Mondays and Wednesdays", "Mondays, Wednesdays and Fridays". */
function listWeekdays(days: number[]): string {
  const names = days.map((day) => WEEKDAY_NAMES[day]).filter(Boolean);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function TimeStep({
  serviceId,
  date,
  selectedSlot,
  onSelect,
  onChangeDate,
}: TimeStepProps) {
  const { data, isPending, isError, error, refetch, isFetching } = useAvailability(serviceId, date);

  if (isPending) return <SkeletonList rows={2} height={56} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="nu-stack">
      <div className="nu-row nu-row--between nu-row--wrap">
        <p className="nu-label">{formatDayLabel(`${date}T00:00:00`)}</p>
        <div className="nu-row" style={{ gap: 'var(--nu-space-2)' }}>
          <Button variant="ghost" size="sm" onClick={() => void refetch()} loading={isFetching}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onChangeDate}>
            Change date
          </Button>
        </div>
      </div>

      {data.slots.length === 0 ? (
        <div className="nu-notice nu-notice--warn" role="status">
          <div>
            <p>{CLOSED_MESSAGE[data.closedReason ?? 'FULLY_BOOKED'] ?? CLOSED_MESSAGE.FULLY_BOOKED}</p>
            <p style={{ marginTop: 'var(--nu-space-2)' }}>
              {data.serviceAvailableWeekdays?.length
                ? `It is available on ${listWeekdays(data.serviceAvailableWeekdays)} — please pick one of those dates.`
                : 'Please select another date.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="nu-slots" role="group" aria-label="Choose a time">
            {data.slots.map((slot) => (
              <button
                key={slot.startAt}
                type="button"
                className="nu-slot"
                aria-pressed={selectedSlot === slot.startAt}
                onClick={() => onSelect(slot.startAt)}
              >
                {slot.label}
              </button>
            ))}
          </div>
          {/* Times are shown in the lounge's timezone, which may differ from
              the visitor's device. Saying so avoids a nasty surprise. */}
          <p className="nu-hint">
            All times are shown in the lounge's local time ({data.timezone}).
          </p>
        </>
      )}
    </div>
  );
}
