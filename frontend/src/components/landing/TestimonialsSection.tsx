import { Reveal } from '@/components/ui/Reveal';
import { BUSINESS, REVIEWS } from '@/content/business';

/**
 * Step 7 of the GEO plan — reviews on the page, marked up as `Review` /
 * `AggregateRating` by the business graph in `PublicLayout`.
 *
 * Renders nothing until Nurella supplies real reviews (`reviews` in
 * `content/geo/business.json`). The structured data is emitted from the same
 * array, so the site can never claim a rating it does not display.
 */
export function TestimonialsSection() {
  if (REVIEWS.length === 0) return null;

  return (
    <section className="nu-section nu-container nu-section--tint nu-section--sand" id="reviews">
      <div className="nu-section-head">
        <Reveal>
          <p className="nu-eyebrow">Reviews</p>
          <h2 className="nu-heading">What our clients say</h2>
        </Reveal>
      </div>

      <div className="nu-reviews">
        {REVIEWS.map((review, index) => (
          <Reveal as="article" className="nu-review" key={`${review.author}-${index}`} delay={Math.min(index, 3) * 0.05}>
            <p className="nu-review__rating" aria-label={`${review.rating} out of ${BUSINESS.ratingScale}`}>
              <span aria-hidden="true">
                {'★'.repeat(Math.round(review.rating))}
                {'☆'.repeat(Math.max(0, BUSINESS.ratingScale - Math.round(review.rating)))}
              </span>
            </p>
            <p className="nu-review__body">{review.body}</p>
            <p className="nu-review__author">
              {review.author}
              {review.source ? ` · ${review.source}` : ''}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
