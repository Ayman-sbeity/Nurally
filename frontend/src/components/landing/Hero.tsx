import { useScroll, useTransform, motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { HERO, categoryIcon, categoryImage } from '@/content/brand';
import { BUSINESS } from '@/content/business';
import { useServices } from '@/hooks/queries';
import { formatDayRange } from '@/lib/geo.js';
import { formatDuration, formatPrice } from '@/utils/format';

/**
 * Entrance timing. The stagger is deliberately short — the primary CTA is the
 * most important element on the page and must not be invisible for a second
 * and a half. Under `prefers-reduced-motion` the whole sequence collapses to
 * near-instant, matching the CSS duration tokens.
 */
function useEntrance() {
  const reduceMotion = useReducedMotion();

  return (order: number) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 26 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduceMotion ? 0.01 : 0.7,
      delay: reduceMotion ? 0 : order * 0.08,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  });
}

export function Hero() {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  // Subtle parallax: the backdrop drifts at a fraction of the scroll rate.
  const y = useTransform(scrollY, [0, 900], [0, reduceMotion ? 0 : 140]);
  const enter = useEntrance();

  return (
    <section className="nu-hero" aria-labelledby="hero-title">
      <motion.div className="nu-hero__media" style={{ y }}>
        <img
          src={HERO.image.src}
          alt=""
          width={HERO.image.width}
          height={HERO.image.height}
          style={{ objectPosition: HERO.image.position }}
          fetchPriority="high"
          decoding="async"
        />
      </motion.div>

      <div className="nu-container nu-hero__layout">
        <div className="nu-hero__content">
          <motion.p className="nu-eyebrow nu-eyebrow--ruled nu-hero__eyebrow" {...enter(0)}>
            {HERO.eyebrow}
          </motion.p>

          <motion.h1 className="nu-hero__title" id="hero-title" {...enter(1)}>
            {HERO.title.lead} <em>{HERO.title.accent}</em>
          </motion.h1>

          <motion.p className="nu-hero__subtitle" {...enter(2)}>
            {HERO.subtitle}
          </motion.p>

          <motion.ul className="nu-hero__pillars" {...enter(3)}>
            {HERO.pillars.map((pillar) => (
              <li key={pillar.label} className="nu-hero__pillar">
                <Icon name={pillar.icon} />
                {pillar.label}
              </li>
            ))}
          </motion.ul>

          <motion.div className="nu-hero__actions" {...enter(4)}>
            <Link to="/booking" className="nu-btn nu-btn--gilded nu-btn--lg">
              <Icon name="calendar" />
              {HERO.primaryCta}
              <Icon name="arrow" />
            </Link>
            <a href="#treatments" className="nu-btn nu-btn--on-dark-outline nu-btn--lg">
              {HERO.secondaryCta}
            </a>
          </motion.div>
        </div>

        <motion.nav
          className="nu-hero__categories"
          aria-label="Treatment categories"
          {...enter(5)}
        >
          <ul>
            {HERO.categories.map((category) => (
              <li key={category.slug}>
                <Link to={`/services#category-${category.slug}`} className="nu-hero-tile">
                  <img
                    src={categoryImage(category.slug)}
                    alt=""
                    width={960}
                    height={480}
                    decoding="async"
                  />
                  <span className="nu-hero-tile__label">
                    <Icon name={categoryIcon(category.slug)} />
                    {category.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </motion.nav>

        <HeroCard order={6} />
      </div>

      <a href="#about" className="nu-hero__scroll" aria-label="Scroll to the next section">
        <Icon name="chevron-down" />
      </a>
    </section>
  );
}

/**
 * Featured treatments and opening hours, both read from real data: the
 * catalogue (already cached by the layout) and the `VITE_BUSINESS_HOURS`
 * schedule. Either half is omitted when there is nothing true to show, and the
 * card disappears entirely when both are.
 */
function HeroCard({ order }: { order: number }) {
  const enter = useEntrance();
  const { data, isPending } = useServices();

  const services =
    data?.categories
      .find((category) => category.slug === HERO.featured.category)
      ?.services.slice(0, HERO.featured.limit) ?? [];
  const hours = BUSINESS.openingHours;
  const showFeatured = isPending || services.length > 0;

  if (!showFeatured && hours.length === 0) return null;

  return (
    <motion.aside className="nu-hero-card" aria-label="At a glance" {...enter(order)}>
      {showFeatured && (
        <>
          <h2 className="nu-hero-card__title">{HERO.featured.title}</h2>
          <ul className="nu-hero-card__list" aria-busy={isPending}>
            {isPending
              ? Array.from({ length: HERO.featured.limit }, (_, index) => (
                  <li key={index} className="nu-hero-card__placeholder" aria-hidden="true" />
                ))
              : services.map((service) => {
                  const price = formatPrice(service.price, service.currency);
                  return (
                    <li key={service._id}>
                      <Link to={`/services/${service.slug}`} className="nu-hero-card__item">
                        <span className="nu-hero-card__icon">
                          <Icon name={categoryIcon(service.category)} />
                        </span>
                        <span>
                          <span className="nu-hero-card__name">{service.name}</span>
                          <span className="nu-hero-card__meta">
                            <Icon name="clock" />
                            {formatDuration(service.durationMinutes)}
                          </span>
                        </span>
                        {/* A price is shown only when the lounge has configured one. */}
                        {price && <span className="nu-hero-card__price">{price}</span>}
                      </Link>
                    </li>
                  );
                })}
          </ul>
        </>
      )}

      {hours.length > 0 && (
        <div className="nu-hero-card__hours">
          <Icon name="clock" />
          <div>
            <h2 className="nu-hero-card__hours-title">{HERO.hoursTitle}</h2>
            <ul>
              {hours.map((block) => (
                <li key={block.days.join()}>
                  <span className="nu-hero-card__time">
                    {block.opens} – {block.closes}
                  </span>
                  <span className="nu-hero-card__days">{formatDayRange(block.days)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
