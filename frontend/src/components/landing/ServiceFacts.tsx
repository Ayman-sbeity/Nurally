import type { ReactNode } from 'react';
import { BUSINESS, treatmentFacts } from '@/content/business';
import { formatDuration, formatPrice } from '@/utils/format';
import type { Service, ServiceCategory } from '@/types/api';

interface ServiceFactsProps {
  service: Service;
  category?: ServiceCategory;
}

/**
 * The plain-answer block that sits above the marketing copy on a treatment
 * page: what it is, who it is for, what it addresses, how long it takes and
 * what it costs.
 *
 * Facts only. The lounge's own description is used when it has written one,
 * otherwise the category's plain-language summary stands in — and price is
 * shown only when a real one is configured, with the lounge's actual pricing
 * policy stated in place of a made-up figure.
 */
export function ServiceFacts({ service, category }: ServiceFactsProps) {
  const facts = treatmentFacts(service.category);
  const price = formatPrice(service.price, service.currency);

  return (
    <div className="nu-facts">
      <Row label="What it is">
        {service.description ?? facts?.whatItIs ?? `${service.name}, offered at ${BUSINESS.name}.`}
      </Row>

      {facts?.whoItIsFor && <Row label="Who it's for">{facts.whoItIsFor}</Row>}

      {facts && facts.addresses.length > 0 && (
        <Row label="What it addresses">
          <span className="nu-facts__tags">
            {facts.addresses.map((concern) => (
              <span className="nu-facts__tag" key={concern}>
                {concern}
              </span>
            ))}
          </span>
        </Row>
      )}

      <Row label="Appointment length">{formatDuration(service.durationMinutes)}</Row>

      <Row label="Price">{price ?? BUSINESS.pricingPolicy}</Row>

      {category && <Row label="Category">{category.label}</Row>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="nu-facts__row">
      <p className="nu-facts__key">{label}</p>
      <div className="nu-facts__value">{children}</div>
    </div>
  );
}
