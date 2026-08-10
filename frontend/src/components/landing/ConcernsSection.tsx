import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '@/components/ui/Reveal';
import { CONCERNS, CONCERN_CATEGORIES } from '@/content/brand';
import { useServices } from '@/hooks/queries';

/**
 * "Treatments by concern".
 *
 * Selecting a concern surfaces the matching categories from the real
 * catalogue. It never claims a treatment will produce a result — every path
 * ends at the consultation line the lounge supplied.
 */
export function ConcernsSection() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data } = useServices();

  const categorySlugs = selected ? (CONCERN_CATEGORIES[selected] ?? []) : [];
  const matching = (data?.categories ?? []).filter((category) =>
    categorySlugs.includes(category.slug),
  );

  return (
    <section className="nu-section nu-container nu-section--tint nu-section--taupe" id="concerns">
      <div className="nu-section-head nu-section-head--center">
        <Reveal>
          <p className="nu-eyebrow">Treatments by concern</p>
          <h2 className="nu-heading">{CONCERNS.title}</h2>
          <p className="nu-lede" style={{ marginInline: 'auto' }}>
            {CONCERNS.intro}
          </p>
        </Reveal>
      </div>

      <Reveal>
        <div className="nu-concerns" role="group" aria-label="Select a concern">
          {CONCERNS.items.map((concern) => (
            <button
              key={concern}
              type="button"
              className="nu-concern"
              aria-pressed={selected === concern}
              onClick={() => setSelected((current) => (current === concern ? null : concern))}
            >
              {concern}
            </button>
          ))}
        </div>
      </Reveal>

      {/* Announced politely so the result is not missed by screen-reader users. */}
      <div aria-live="polite">
        {selected && (
          <div className="nu-concern__result">
            <p className="nu-eyebrow">{selected}</p>
            <p className="nu-lede" style={{ marginBlock: 'var(--nu-space-3)' }}>
              {CONCERNS.outcome}
            </p>

            {matching.length > 0 && (
              <div className="nu-row nu-row--wrap" style={{ marginTop: 'var(--nu-space-4)' }}>
                {matching.map((category) => (
                  <Link
                    key={category.slug}
                    to={`/services#category-${category.slug}`}
                    className="nu-btn nu-btn--outline nu-btn--sm"
                  >
                    {category.label}
                  </Link>
                ))}
                <Link to="/booking" className="nu-btn nu-btn--gold nu-btn--sm">
                  Book a consultation
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
