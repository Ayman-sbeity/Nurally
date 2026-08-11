import { useMemo } from 'react';
import { Seo } from '@/components/ui/Seo';
import { JsonLd } from '@/components/ui/JsonLd';
import { FaqSection } from '@/components/landing/FaqSection';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';
import { BUSINESS, FAQ_ENTRIES } from '@/content/business';
import { breadcrumbSchema, faqSchema } from '@/lib/geo.js';

export function FaqPage() {
  // Built from the entries actually rendered below, so the structured data can
  // never advertise a question the page does not answer.
  const schema = useMemo(() => faqSchema(BUSINESS, FAQ_ENTRIES), []);
  const breadcrumb = useMemo(
    () =>
      breadcrumbSchema(BUSINESS, [
        { name: 'Home', path: '/' },
        { name: 'FAQ', path: '/faq' },
      ]),
    [],
  );

  return (
    <>
      <Seo
        title="Frequently Asked Questions — Nurella Beauty Lounge"
        description="Direct answers about treatments, booking, consultations and pricing at Nurella Beauty Lounge — what we offer, which treatment suits which concern, and how appointments are confirmed."
        canonicalPath="/faq"
      />
      <JsonLd id="faq" data={schema} />
      <JsonLd id="breadcrumb" data={breadcrumb} />

      <div style={{ paddingTop: '7rem' }}>
        <div className="nu-container">
          <p className="nu-eyebrow">Nurella Beauty Lounge</p>
          <h1 className="nu-heading" style={{ marginBlock: 'var(--nu-space-3)' }}>
            Frequently Asked Questions
          </h1>
          <p className="nu-lede">
            Straight answers about our treatments, how appointments work, and what happens at your
            consultation. If your question is not here, the fastest route to an answer is a booking
            request — the lounge replies to every one.
          </p>
        </div>
      </div>

      {/* The jump links live in the section's own sticky column, so they stay
          reachable while reading rather than scrolling away with the intro. */}
      <FaqSection grouped showSectionNav eyebrow="" heading="" />
      <BookingCtaSection />
    </>
  );
}

export default FaqPage;
