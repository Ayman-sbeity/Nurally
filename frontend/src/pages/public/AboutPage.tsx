import { Seo } from '@/components/ui/Seo';
import { AboutSection } from '@/components/landing/AboutSection';
import { PhilosophySection } from '@/components/landing/PhilosophySection';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';

export function AboutPage() {
  return (
    <>
      <Seo
        title="About — Nurella Beauty Lounge"
        description="Nurella Beauty Lounge is a destination dedicated to advanced aesthetics, skin rejuvenation, and beauty. Enhance, never change."
        canonicalPath="/about"
      />
      <div style={{ paddingTop: '5rem' }} />
      <AboutSection />
      <PhilosophySection />
      <BookingCtaSection />
    </>
  );
}

export default AboutPage;
