import { Seo } from '@/components/ui/Seo';
import { Hero } from '@/components/landing/Hero';
import { AboutSection } from '@/components/landing/AboutSection';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { ConcernsSection } from '@/components/landing/ConcernsSection';
import { PhilosophySection } from '@/components/landing/PhilosophySection';
import { GallerySection } from '@/components/landing/GallerySection';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';

export function LandingPage() {
  return (
    <>
      <Seo
        title="Nurella Beauty Lounge — Advanced Aesthetics, Skin & Beauty"
        description="Where advanced aesthetics meet elegance, precision, and personalized care. Book your personalized consultation at Nurella Beauty Lounge."
        canonicalPath="/"
      />
      <Hero />
      <AboutSection />
      {/* The landing page previews each category; the full menu lives at /services. */}
      <ServicesSection limitPerCategory={3} showViewAll />
      <ConcernsSection />
      <PhilosophySection />
      <GallerySection limit={6} />
      <BookingCtaSection />
    </>
  );
}

export default LandingPage;
