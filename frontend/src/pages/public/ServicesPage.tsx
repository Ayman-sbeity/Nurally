import { useMemo } from 'react';
import { Seo } from '@/components/ui/Seo';
import { JsonLd } from '@/components/ui/JsonLd';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';
import { BUSINESS } from '@/content/business';
import { useServices } from '@/hooks/queries';
import { breadcrumbSchema, serviceListSchema } from '@/lib/geo.js';

export function ServicesPage() {
  const { data } = useServices();

  const itemList = useMemo(
    () => (data ? serviceListSchema(BUSINESS, data.categories) : null),
    [data],
  );
  const breadcrumb = useMemo(
    () =>
      breadcrumbSchema(BUSINESS, [
        { name: 'Home', path: '/' },
        { name: 'Treatments', path: '/services' },
      ]),
    [],
  );

  return (
    <>
      <Seo
        title="Treatments — Nurella Beauty Lounge"
        description="The full treatment menu at Nurella Beauty Lounge: facial aesthetics, collagen biostimulation, skin boosters and rejuvenation, advanced skin treatments, lifting and contouring, laser, skin care facials, permanent makeup and nails."
        canonicalPath="/services"
      />
      {itemList && <JsonLd id="itemlist" data={itemList} />}
      <JsonLd id="breadcrumb" data={breadcrumb} />

      <div style={{ paddingTop: '7rem' }}>
        <div className="nu-container">
          <p className="nu-eyebrow">Nurella Beauty Lounge</p>
          <h1 className="nu-heading" style={{ marginBlock: 'var(--nu-space-3)' }}>
            Our Treatments
          </h1>
          {/* Fact first, atmosphere second: what is on the menu, how a
              treatment is chosen, and what it costs — before any styling. */}
          <p className="nu-lede">
            Nurella offers treatments across ten categories — facial aesthetics, collagen and
            biostimulation, skin boosters and rejuvenation, advanced skin treatments, lifting and
            contouring, laser, professional skin care, permanent makeup, nails, and combined beauty
            and nail services. Each treatment below shows its appointment length, and each category
            explains what it is and who it is for.
          </p>
          <p className="nu-lede" style={{ marginTop: 'var(--nu-space-4)' }}>
            Every treatment begins with a personalized consultation and a plan based on your
            features, skin needs and desired results. {BUSINESS.pricingPolicy}
          </p>
        </div>
      </div>

      <ServicesSection showCategoryFacts />
      <BookingCtaSection />
    </>
  );
}

export default ServicesPage;
