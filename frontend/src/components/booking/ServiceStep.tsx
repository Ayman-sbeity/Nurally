import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import { TextField } from '@/components/ui/Field';
import { useServices } from '@/hooks/queries';
import type { Service } from '@/types/api';
import { formatDuration, formatPrice, weekdayRestrictionLabel } from '@/utils/format';

interface ServiceStepProps {
  selectedId: string | null;
  onSelect: (service: Service) => void;
}

export function ServiceStep({ selectedId, onSelect }: ServiceStepProps) {
  const [query, setQuery] = useState('');
  const { data, isPending, isError, error, refetch } = useServices();

  const categories = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data?.categories ?? [];
    return (data?.categories ?? [])
      .map((category) => ({
        ...category,
        services: category.services.filter(
          (service) =>
            service.name.toLowerCase().includes(term) ||
            category.label.toLowerCase().includes(term),
        ),
      }))
      .filter((category) => category.services.length > 0);
  }, [data, query]);

  if (isPending) return <SkeletonList rows={4} height={64} />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="nu-stack" style={{ gap: 'var(--nu-space-5)' }}>
      <TextField
        label="Find a treatment"
        type="search"
        placeholder="Search treatments…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {categories.length === 0 && (
        <EmptyState
          title="No treatments match that search."
          message="Try a different word, or browse the full list."
        />
      )}

      {categories.map((category) => (
        <section key={category.slug} className="nu-stack" style={{ gap: 'var(--nu-space-2)' }}>
          <h2 className="nu-label">{category.label}</h2>
          {category.services.map((service) => {
            const price = formatPrice(service.price, service.currency);
            const restriction = weekdayRestrictionLabel(service.availableWeekdays);

            return (
              <button
                key={service._id}
                type="button"
                className="nu-appt"
                aria-pressed={selectedId === service._id}
                onClick={() => onSelect(service)}
                style={{
                  textAlign: 'left',
                  width: '100%',
                  borderColor: selectedId === service._id ? 'var(--nu-champagne-deep)' : undefined,
                  borderWidth: selectedId === service._id ? 2 : 1,
                  padding: 'var(--nu-space-4)',
                }}
              >
                <div className="nu-row nu-row--between" style={{ gap: 'var(--nu-space-3)' }}>
                  <span style={{ fontWeight: 500 }}>{service.name}</span>
                  <span className="nu-hint">
                    {formatDuration(service.durationMinutes)}
                    {/* Shown only where the lounge has set one — most treatments
                        are priced at the consultation, and a blank must never
                        read as free. */}
                    {price && ` · ${price}`}
                  </span>
                </div>

                {/* Before the date step, not after it: a customer who learns
                    here that this one is Wednesdays only never meets the strip
                    of thirteen unavailable days. */}
                {restriction && (
                  <span
                    className="nu-badge nu-badge--restricted"
                    style={{ marginTop: 'var(--nu-space-2)' }}
                  >
                    {restriction}
                  </span>
                )}

                {service.description && (
                  <p className="nu-hint" style={{ marginTop: 'var(--nu-space-2)' }}>
                    {service.description}
                  </p>
                )}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
