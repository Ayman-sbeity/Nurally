import { Link } from 'react-router-dom';
import { Reveal } from '@/components/ui/Reveal';
import { FAQ_ENTRIES, FAQ_SECTIONS } from '@/content/business';

interface FaqSectionProps {
  /** Landing page shows a short preview; `/faq` shows everything, grouped. */
  limit?: number;
  grouped?: boolean;
  heading?: string;
  eyebrow?: string;
  intro?: string;
  showViewAll?: boolean;
  /** Puts jump links to each group in the sticky column. Grouped view only. */
  showSectionNav?: boolean;
}

/**
 * Questions phrased the way a person asks them, answered directly.
 *
 * Two-column on desktop: the heading (and, on the full page, the section
 * navigation) stays in a sticky left column while the answers scroll past it.
 * A single centred column would either run to a punishing line length or leave
 * a third of the page empty — this keeps the measure at roughly 68 characters
 * and still uses the width.
 *
 * The answers are rendered as ordinary visible text rather than an accordion:
 * collapsed panels are readable by browsers but are routinely dropped by the
 * text-extraction pipelines that feed AI assistants, which is exactly the
 * audience this section exists for. Scannability is bought with the section
 * navigation and the rules between questions instead.
 */
export function FaqSection({
  limit,
  grouped = false,
  heading = 'Questions people ask us',
  eyebrow = 'FAQ',
  intro,
  showViewAll = false,
  showSectionNav = false,
}: FaqSectionProps) {
  if (FAQ_ENTRIES.length === 0) return null;

  const entries = limit ? FAQ_ENTRIES.slice(0, limit) : FAQ_ENTRIES;
  const sections = FAQ_SECTIONS.filter((section) =>
    entries.some((entry) => entry.section === section.id),
  );

  return (
    <section className="nu-section nu-container" id="faq">
      <div className="nu-faq-layout">
        <div className="nu-faq__aside">
          <Reveal>
            {eyebrow && <p className="nu-eyebrow">{eyebrow}</p>}
            {heading && <h2 className="nu-faq__heading">{heading}</h2>}
            {intro && <p className="nu-lede nu-faq__intro">{intro}</p>}

            {showSectionNav && sections.length > 1 && (
              <nav className="nu-faq__nav" aria-label="Jump to a section">
                <ul>
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a href={`#faq-${section.id}`}>{section.title}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {showViewAll && entries.length < FAQ_ENTRIES.length && (
              <Link className="nu-btn nu-btn--outline nu-faq__all" to="/faq">
                All {FAQ_ENTRIES.length} questions
              </Link>
            )}
          </Reveal>
        </div>

        <div className="nu-faq__body">
          {grouped ? (
            sections.map((section) => (
              <div className="nu-faq__group" key={section.id} id={`faq-${section.id}`}>
                <h3 className="nu-faq__group-title">{section.title}</h3>
                <FaqList entries={entries.filter((entry) => entry.section === section.id)} level="h4" />
              </div>
            ))
          ) : (
            <FaqList entries={entries} level="h3" />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * `level` keeps the heading order intact whether or not the list is grouped.
 *
 * Not a `<dl>`, tempting as the shape is: `<dt>` may not contain heading
 * content, and real headings are what let a screen-reader user jump between
 * questions instead of reading the page top to bottom.
 */
function FaqList({ entries, level }: { entries: typeof FAQ_ENTRIES; level: 'h3' | 'h4' }) {
  const Heading = level;
  return (
    <div className="nu-faq">
      {entries.map((entry) => (
        <article className="nu-faq__item" key={entry.id} id={entry.id}>
          <Heading className="nu-faq__q">{entry.question}</Heading>
          <p className="nu-faq__a">{entry.answer}</p>
        </article>
      ))}
    </div>
  );
}
