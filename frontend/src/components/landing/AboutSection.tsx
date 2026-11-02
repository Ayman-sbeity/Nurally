import { Reveal } from '@/components/ui/Reveal';
import { Icon } from '@/components/ui/Icon';
import { ABOUT, PILLARS } from '@/content/brand';

interface AboutSectionProps {
  /** `h1` on /about, where this section opens the page; `h2` on the landing page. */
  headingLevel?: 'h1' | 'h2';
}

export function AboutSection({ headingLevel: Heading = 'h2' }: AboutSectionProps) {
  return (
    <section
      className="nu-section nu-container nu-section--tint nu-about"
      id="about"
      aria-labelledby="about-title"
    >
      <div className="nu-about__grid">
        <Reveal direction="left" className="nu-about__frame">
          <div className="nu-about__media">
            <img
              src={ABOUT.image.src}
              alt={ABOUT.image.alt}
              width={ABOUT.image.width}
              height={ABOUT.image.height}
              loading="lazy"
              decoding="async"
            />
          </div>
        </Reveal>

        <div>
          <Reveal delay={0.08}>
            <p className="nu-eyebrow nu-eyebrow--ruled">{ABOUT.eyebrow}</p>
            <Heading className="nu-heading nu-about__title" id="about-title">
              {ABOUT.title.lead} <em>{ABOUT.title.accent}</em>
            </Heading>
            <Flourish />
            <p className="nu-prose nu-about__intro">{ABOUT.intro}</p>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="nu-about__philosophy">
              <span className="nu-about__badge">
                <Icon name="lotus" />
              </span>
              <div>
                <p className="nu-about__philosophy-lead">{ABOUT.philosophyLead}</p>
                <p className="nu-about__quote">{ABOUT.pullQuote}</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="nu-prose">
              {ABOUT.paragraphsAfter.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <ul className="nu-about__pillars">
              {PILLARS.map((pillar) => (
                <li key={pillar.label} className="nu-about__pillar">
                  <Icon name={pillar.icon} />
                  {pillar.label}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** A gold brush-stroke ending in a sprig, under the heading. Pure ornament. */
function Flourish() {
  return (
    <svg
      className="nu-about__flourish"
      viewBox="0 0 360 40"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 34C110 21 228 20 330 9 228 26 112 29 4 34z" />
      <path d="M330 9c-1-9 5-15 14-17 0 9-5 15-14 17zM330 9c7-4 15-3 22 3-8 4-16 2-22-3z" />
    </svg>
  );
}
