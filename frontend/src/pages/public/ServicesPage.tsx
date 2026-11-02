import { useMemo } from 'react';
import { Seo } from '@/components/ui/Seo';
import { JsonLd } from '@/components/ui/JsonLd';
import { Icon } from '@/components/ui/Icon';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';
import { PILLARS, SERVICES_HERO } from '@/content/brand';
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

      {/* The landing hero's look at banner height: no entrance animation or
          parallax, because this is the first thing the page paints. */}
      <section className="nu-hero nu-hero--page" aria-labelledby="services-title">
        <div className="nu-hero__media">
          <img
            src={SERVICES_HERO.image.src}
            alt=""
            width={SERVICES_HERO.image.width}
            height={SERVICES_HERO.image.height}
            style={{ objectPosition: SERVICES_HERO.image.position }}
            fetchPriority="high"
            decoding="async"
          />
        </div>

        <div className="nu-container nu-hero__layout">
          <div className="nu-hero__content">
            {/* The eyebrow sits inside the h1 so the page's heading says what
                the page is, not only the tagline. */}
            <h1 className="nu-hero__title" id="services-title">
              <span className="nu-eyebrow nu-eyebrow--ruled nu-hero__eyebrow">
                {SERVICES_HERO.eyebrow}
              </span>
              {SERVICES_HERO.title.lead} <em>{SERVICES_HERO.title.accent}</em>
            </h1>
            <p className="nu-hero__body">{SERVICES_HERO.body}</p>
            <ul className="nu-hero__pillars">
              {PILLARS.map((pillar) => (
                <li key={pillar.label} className="nu-hero__pillar">
                  <Icon name={pillar.icon} />
                  {pillar.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ServicesSection
        variant="menu"
        intro={
          // Fact first: what is on the menu, how a treatment is chosen, and
          // what it costs — before the cards.
          <div className="nu-catalogue__intro">
            <p>
              Nurella offers treatments across ten categories — facial aesthetics, collagen and
              biostimulation, skin boosters and rejuvenation, advanced skin treatments, lifting and
              contouring, laser, professional skin care, permanent makeup, nails, and combined
              beauty and nail services. Each treatment below shows its appointment length, and
              each category explains what it is and who it is for.
            </p>
            <p>
              Every treatment begins with a personalized consultation and a plan based on your
              features, skin needs and desired results. {BUSINESS.pricingPolicy}
            </p>
          </div>
        }
      />
      <BookingCtaSection />
    </>
  );
}

export default ServicesPage;
