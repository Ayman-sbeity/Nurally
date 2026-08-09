import { useScroll, useTransform, motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HERO } from '@/content/brand';

export function Hero() {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  // Subtle parallax: the backdrop drifts at a fraction of the scroll rate.
  const y = useTransform(scrollY, [0, 900], [0, reduceMotion ? 0 : 140]);

  const fadeUp = {
    initial: { opacity: 0, y: reduceMotion ? 0 : 26 },
    animate: { opacity: 1, y: 0 },
  };

  /**
   * Entrance timing. The stagger is deliberately short — the primary CTA is the
   * most important element on the page and must not be invisible for a second
   * and a half. Under `prefers-reduced-motion` the whole sequence collapses to
   * near-instant, matching the CSS duration tokens.
   */
  const enter = (order: number) => ({
    duration: reduceMotion ? 0.01 : 0.7,
    delay: reduceMotion ? 0 : order * 0.08,
    ease: [0.22, 1, 0.36, 1] as const,
  });

  return (
    <section className="nu-hero">
      <motion.div className="nu-hero__media" style={{ y }}>
        <img
          src="/images/hero.svg"
          alt=""
          role="presentation"
          fetchPriority="high"
          decoding="async"
        />
      </motion.div>

      <div className="nu-container">
        <div className="nu-hero__inner">
          <motion.p
            className="nu-hero__eyebrow"
            {...fadeUp}
            transition={enter(0)}
          >
            {HERO.eyebrow}
          </motion.p>

          <motion.h1
            className="nu-hero__title"
            {...fadeUp}
            transition={enter(1)}
          >
            {HERO.title}
          </motion.h1>

          <motion.p
            className="nu-hero__subtitle"
            {...fadeUp}
            transition={enter(2)}
          >
            {HERO.subtitle}
          </motion.p>

          <motion.p
            className="nu-hero__body"
            {...fadeUp}
            transition={enter(3)}
          >
            {HERO.body}
          </motion.p>

          <motion.p
            className="nu-hero__statement"
            {...fadeUp}
            transition={enter(4)}
          >
            {HERO.statement}
          </motion.p>

          <motion.div
            className="nu-hero__actions"
            {...fadeUp}
            transition={enter(5)}
          >
            <Link to="/booking" className="nu-btn nu-btn--on-dark">
              {HERO.primaryCta}
            </Link>
            <a href="#treatments" className="nu-btn nu-btn--on-dark-outline">
              {HERO.secondaryCta}
            </a>
          </motion.div>
        </div>
      </div>

      <span className="nu-hero__scroll" aria-hidden="true">
        Scroll
      </span>
    </section>
  );
}
