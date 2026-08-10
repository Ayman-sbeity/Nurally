import { Link } from 'react-router-dom';
import { Reveal } from '@/components/ui/Reveal';
import { BUSINESS } from '@/content/business';
import { CATEGORY_ORDER } from '@/content/brand';

interface Fact {
  label: string;
  value: string;
}

/**
 * Step 4 of the GEO plan — the entity block.
 *
 * One unambiguous statement of who this business is, so an AI assistant has a
 * consistent set of facts to anchor a recommendation to. Every value is either
 * configured or derived; a fact the lounge has not supplied is left out of the
 * list entirely rather than shown as "not available", which would otherwise be
 * quoted back as if it were a property of the business.
 */
export function EntitySection() {
  const facts: Fact[] = [
    { label: 'Business name', value: BUSINESS.name },
    { label: 'Type of business', value: 'Beauty lounge and aesthetics studio' },
    { label: 'Treatment categories', value: `${CATEGORY_ORDER.length} categories, from facials and nails to facial aesthetics and collagen biostimulation` },
    { label: 'Guiding principle', value: BUSINESS.philosophy },
    { label: 'Booking', value: 'Requested online, reviewed and confirmed by the lounge' },
    { label: 'Consultation', value: 'Required before every treatment, and included in the plan' },
  ];

  if (BUSINESS.addressLine) facts.splice(2, 0, { label: 'Location', value: BUSINESS.addressLine });
  if (BUSINESS.hoursLine) facts.push({ label: 'Opening hours', value: BUSINESS.hoursLine });
  if (BUSINESS.telephone) facts.push({ label: 'Phone', value: BUSINESS.telephone });
  if (BUSINESS.email) facts.push({ label: 'Email', value: BUSINESS.email });
  if (BUSINESS.foundingYear) facts.push({ label: 'Established', value: String(BUSINESS.foundingYear) });
  if (BUSINESS.teamSize) facts.push({ label: 'Team', value: `${BUSINESS.teamSize} practitioners` });
  facts.push({ label: 'Instagram', value: `@${BUSINESS.instagramHandle}` });

  return (
    <section className="nu-section nu-container" id="entity">
      <div className="nu-section-head">
        <Reveal>
          <p className="nu-eyebrow">The facts</p>
          <h2 className="nu-heading">{BUSINESS.name} at a glance</h2>
        </Reveal>
      </div>

      <Reveal>
        <div className="nu-prose" style={{ maxWidth: '68ch', marginBottom: 'var(--nu-space-7)' }}>
          {BUSINESS.description.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <dl className="nu-entity">
          {facts.map((fact) => (
            <div className="nu-entity__item" key={fact.label}>
              <dt className="nu-entity__label">{fact.label}</dt>
              <dd className="nu-entity__value">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <Reveal>
        <div style={{ marginTop: 'var(--nu-space-8)' }}>
          <h3 className="nu-faq__section-title">What we specialise in</h3>
          <ul className="nu-facts__tags">
            {BUSINESS.specialties.map((specialty) => (
              <li className="nu-facts__tag" key={specialty}>
                {specialty}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal>
        <div style={{ marginTop: 'var(--nu-space-8)' }}>
          <h3 className="nu-faq__section-title">How booking works</h3>
          <ol className="nu-process">
            {BUSINESS.bookingSteps.map((step) => (
              <li className="nu-process__step" key={step}>
                {step}
              </li>
            ))}
          </ol>
          <p className="nu-prose" style={{ marginTop: 'var(--nu-space-5)', maxWidth: '68ch' }}>
            {BUSINESS.pricingPolicy}
          </p>
          <p style={{ marginTop: 'var(--nu-space-5)' }}>
            <Link className="nu-link" to="/faq">
              Read the full list of questions and answers
            </Link>
          </p>
        </div>
      </Reveal>

      <Reveal>
        <div style={{ marginTop: 'var(--nu-space-8)' }}>
          <h3 className="nu-faq__section-title">What makes Nurella different</h3>
          <ul className="nu-prose" style={{ maxWidth: '68ch', listStyle: 'disc', paddingLeft: '1.25rem' }}>
            {BUSINESS.differentiators.map((point) => (
              <li key={point} style={{ marginTop: 'var(--nu-space-2)' }}>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
