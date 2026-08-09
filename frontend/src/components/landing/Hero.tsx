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
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {HERO.eyebrow}
          </motion.p>

          <motion.h1
            className="nu-hero__title"
            {...fadeUp}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {HERO.title}
          </motion.h1>

          <motion.p
            className="nu-hero__subtitle"
            {...fadeUp}
            transition={{ duration: 0.9, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {HERO.subtitle}
          </motion.p>

          <motion.p
            className="nu-hero__body"
            {...fadeUp}
            transition={{ duration: 0.9, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {HERO.body}
          </motion.p>

          <motion.p
            className="nu-hero__statement"
            {...fadeUp}
            transition={{ duration: 0.9, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            {HERO.statement}
          </motion.p>

          <motion.div
            className="nu-hero__actions"
            {...fadeUp}
            transition={{ duration: 0.9, delay: 0.52, ease: [0.22, 1, 0.36, 1] }}
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
