import { Link } from 'react-router-dom';
import { Reveal } from '@/components/ui/Reveal';
import { BOOKING_CTA, BRAND, instagramUrl } from '@/content/brand';

export function BookingCtaSection() {
  return (
    <section className="nu-cta" id="book">
      <div className="nu-container">
        <div className="nu-cta__inner">
          <Reveal>
            <p className="nu-eyebrow">{BOOKING_CTA.eyebrow}</p>
            <h2 className="nu-cta__title">{BOOKING_CTA.title}</h2>
            <p className="nu-cta__body">{BOOKING_CTA.body}</p>
            <Link to="/booking" className="nu-btn nu-btn--on-dark">
              {BOOKING_CTA.cta}
            </Link>
            <p className="nu-cta__social">
              <a href={instagramUrl} target="_blank" rel="noreferrer noopener" className="nu-link">
                @{BRAND.instagramHandle}
              </a>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
