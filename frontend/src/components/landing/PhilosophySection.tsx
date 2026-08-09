import { Reveal } from '@/components/ui/Reveal';
import { PHILOSOPHY } from '@/content/brand';

export function PhilosophySection() {
  return (
    <section className="nu-philosophy" id="philosophy">
      <div className="nu-philosophy__media">
        <img src="/images/philosophy.svg" alt="" role="presentation" loading="lazy" decoding="async" />
      </div>

      <div className="nu-container">
        <div className="nu-philosophy__inner">
          <Reveal>
            <p className="nu-eyebrow">{PHILOSOPHY.eyebrow}</p>
            <h2 className="nu-philosophy__title">{PHILOSOPHY.title}</h2>
          </Reveal>

          <Reveal delay={0.1}>
            <div style={{ color: 'rgba(250, 247, 242, 0.82)' }}>
              {PHILOSOPHY.paragraphs.map((paragraph) => (
                <p key={paragraph} style={{ marginBottom: 'var(--nu-space-4)' }}>
                  {paragraph}
                </p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="nu-philosophy__closing">{PHILOSOPHY.closing}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
