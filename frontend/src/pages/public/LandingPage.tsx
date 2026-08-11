import { Seo } from '@/components/ui/Seo';
import { Hero } from '@/components/landing/Hero';
import { AboutSection } from '@/components/landing/AboutSection';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { ConcernsSection } from '@/components/landing/ConcernsSection';
import { PhilosophySection } from '@/components/landing/PhilosophySection';
import { GallerySection } from '@/components/landing/GallerySection';
import { InstagramSection } from '@/components/landing/InstagramSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';

export function LandingPage() {
  return (
    <>
      <Seo
        title="Nurella Beauty Lounge — Advanced Aesthetics, Skin & Beauty"
        description="Nurella Beauty Lounge offers facial aesthetics, collagen biostimulation, skin boosters, advanced skin treatments, laser, permanent makeup, facials and nails. Every treatment begins with a personalized consultation — request an appointment online."
        canonicalPath="/"
      />
      <Hero />
      <AboutSection />
      {/* The landing page previews each category; the full menu lives at /services. */}
      <ServicesSection limitPerCategory={3} showViewAll />
      <ConcernsSection />
      <PhilosophySection />
      <GallerySection limit={6} />
      {/* Renders nothing until reels are featured in the admin. */}
      <InstagramSection />
      <TestimonialsSection />
      {/* A short, question-phrased answer block; the full set lives at /faq,
          which is where the FAQPage structured data is declared. */}
      <FaqSection
        limit={5}
        showViewAll
        intro="Straight answers about our treatments, how appointments work, and what happens at your consultation."
      />
      <BookingCtaSection />
    </>
  );
}

export default LandingPage;
