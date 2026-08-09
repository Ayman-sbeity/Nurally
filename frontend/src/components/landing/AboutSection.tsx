import { Reveal } from '@/components/ui/Reveal';
import { ABOUT } from '@/content/brand';

export function AboutSection() {
  return (
    <section className="nu-section nu-container" id="about">
      <div className="nu-editorial">
        <Reveal direction="left">
          <div className="nu-editorial__media">
            <img
              src="/images/about.svg"
              alt=""
              role="presentation"
              loading="lazy"
              decoding="async"
            />
          </div>
        </Reveal>

        <div>
          <Reveal delay={0.08}>
            <p className="nu-eyebrow">{ABOUT.eyebrow}</p>
            <h2 className="nu-heading" style={{ marginBlock: 'var(--nu-space-3) var(--nu-space-5)' }}>
              {ABOUT.title}
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="nu-prose">
              {ABOUT.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <p className="nu-pullquote">{ABOUT.pullQuote}</p>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="nu-prose">
              {ABOUT.paragraphsAfter.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
