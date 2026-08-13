import { useMemo } from 'react';
import { Seo } from '@/components/ui/Seo';
import { JsonLd } from '@/components/ui/JsonLd';
import { AboutSection } from '@/components/landing/AboutSection';
import { EntitySection } from '@/components/landing/EntitySection';
import { PhilosophySection } from '@/components/landing/PhilosophySection';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';
import { LocationSection } from '@/components/landing/LocationSection';
import { BUSINESS } from '@/content/business';
import { aboutPageSchema, breadcrumbSchema } from '@/lib/geo.js';

export function AboutPage() {
  const schema = useMemo(() => aboutPageSchema(BUSINESS), []);
  const breadcrumb = useMemo(
    () =>
      breadcrumbSchema(BUSINESS, [
        { name: 'Home', path: '/' },
        { name: 'About', path: '/about' },
      ]),
    [],
  );

  return (
    <>
      <Seo
        title="About Nurella Beauty Lounge — Advanced Aesthetics, Skin & Beauty"
        description={BUSINESS.summary}
        canonicalPath="/about"
      />
      <JsonLd id="about" data={schema} />
      <JsonLd id="breadcrumb" data={breadcrumb} />

      <div style={{ paddingTop: '5rem' }} />
      <AboutSection />
      {/* The entity block: one unambiguous statement of who this business is,
          which is what an AI assistant anchors a recommendation to. */}
      <EntitySection />
      <PhilosophySection />
      <LocationSection />
      <BookingCtaSection />
    </>
  );
}

export default AboutPage;
