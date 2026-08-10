import { Link } from 'react-router-dom';
import { Reveal } from '@/components/ui/Reveal';
import { FAQ_ENTRIES, FAQ_SECTIONS } from '@/content/business';

interface FaqSectionProps {
  /** Landing page shows a short preview; `/faq` shows everything, grouped. */
  limit?: number;
  grouped?: boolean;
  heading?: string;
  eyebrow?: string;
  showViewAll?: boolean;
}

/**
 * Questions phrased the way a person asks them, answered directly.
 *
 * The answers are rendered as ordinary visible text rather than an accordion:
 * collapsed panels are readable by browsers but are routinely dropped by the
 * text-extraction pipelines that feed AI assistants, which is exactly the
 * audience this section exists for.
 */
export function FaqSection({
  limit,
  grouped = false,
  heading = 'Questions people ask us',
  eyebrow = 'FAQ',
  showViewAll = false,
}: FaqSectionProps) {
  if (FAQ_ENTRIES.length === 0) return null;

  const entries = limit ? FAQ_ENTRIES.slice(0, limit) : FAQ_ENTRIES;

  return (
    <section className="nu-section nu-container" id="faq">
      <div className="nu-section-head">
        <Reveal>
          <p className="nu-eyebrow">{eyebrow}</p>
          <h2 className="nu-heading">{heading}</h2>
        </Reveal>
      </div>

      {grouped ? (
        FAQ_SECTIONS.map((section) => {
          const sectionEntries = entries.filter((entry) => entry.section === section.id);
          if (sectionEntries.length === 0) return null;

          return (
            <div className="nu-faq__section" key={section.id} id={`faq-${section.id}`}>
              <h3 className="nu-faq__section-title">{section.title}</h3>
              <FaqList entries={sectionEntries} level="h4" />
            </div>
          );
        })
      ) : (
        <FaqList entries={entries} level="h3" />
      )}

      {showViewAll && entries.length < FAQ_ENTRIES.length && (
        <p style={{ marginTop: 'var(--nu-space-6)' }}>
          <Link className="nu-link" to="/faq">
            Read all {FAQ_ENTRIES.length} questions and answers
          </Link>
        </p>
      )}
    </section>
  );
}

/** `level` keeps the heading order intact whether or not the list is grouped. */
function FaqList({ entries, level }: { entries: typeof FAQ_ENTRIES; level: 'h3' | 'h4' }) {
  const Heading = level;
  return (
    <div className="nu-faq">
      <div>
        {entries.map((entry) => (
          <article className="nu-faq__item" key={entry.id} id={entry.id}>
            <Heading className="nu-faq__q">{entry.question}</Heading>
            <p className="nu-faq__a">{entry.answer}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
