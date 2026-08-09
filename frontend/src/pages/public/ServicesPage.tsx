import { Seo } from '@/components/ui/Seo';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';

export function ServicesPage() {
  return (
    <>
      <Seo
        title="Treatments — Nurella Beauty Lounge"
        description="Explore the full treatment menu at Nurella Beauty Lounge: laser, skin care, permanent makeup, nails, facial aesthetics, collagen biostimulation and more."
        canonicalPath="/services"
      />

      <div style={{ paddingTop: '7rem' }}>
        <div className="nu-container">
          <p className="nu-eyebrow">Nurella Beauty Lounge</p>
          <h1 className="nu-heading" style={{ marginBlock: 'var(--nu-space-3)' }}>
            Our Treatments
          </h1>
          <p className="nu-lede">
            Every treatment begins with a personalized consultation and a carefully designed plan
            based on your features, skin needs, and desired results.
          </p>
        </div>
      </div>

      <ServicesSection />
      <BookingCtaSection />
    </>
  );
}

export default ServicesPage;
