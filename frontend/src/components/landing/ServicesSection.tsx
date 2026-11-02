import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Reveal } from '@/components/ui/Reveal';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import { CategoryNav } from '@/components/landing/CategoryNav';
import { ServiceCard } from '@/components/landing/ServiceCard';
import { CATEGORY_INTROS, COLLAGEN_INTRO, categoryIcon } from '@/content/brand';
import { treatmentFacts } from '@/content/business';
import { useServices } from '@/hooks/queries';
import type { ServiceCategory } from '@/types/api';

/** One row of cards per category on the landing page; the rest are a link away. */
const PREVIEW_LIMIT = 4;

interface ServicesSectionProps {
  /**
   * `preview` (landing page): its own heading, the first few treatments of
   * each category and a link to the rest.
   * `menu` (Treatments page): every treatment, a category bar to move between
   * them, and what each category is — under the page's own banner, so the
   * categories are the page's h2s.
   */
  variant?: 'preview' | 'menu';
  /** Menu only: shown between the category bar and the first category. */
  intro?: ReactNode;
}

export function ServicesSection({ variant = 'preview', intro }: ServicesSectionProps) {
  const { data, isPending, isError, error, refetch } = useServices();
  const { hash } = useLocation();
  const isMenu = variant === 'menu';

  /*
   * A link to one category (`/services#category-laser`) arrives before the
   * catalogue has loaded, so the browser finds nothing to scroll to. Finish
   * the job once the categories are on the page — and once the web fonts are
   * in, because their line heights move everything above the target and a
   * scroll started earlier stops short of where the category ends up.
   */
  useEffect(() => {
    if (!data || !hash.startsWith('#category-')) return;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    });
    return () => {
      cancelled = true;
    };
  }, [data, hash]);

  return (
    <section
      className={`nu-section nu-container nu-catalogue${isMenu ? ' nu-catalogue--menu' : ''}`}
      id="treatments"
      aria-labelledby={isMenu ? undefined : 'treatments-title'}
      aria-label={isMenu ? 'Treatment menu' : undefined}
    >
      {!isMenu && (
        <div className="nu-section-head">
          <Reveal>
            <p className="nu-eyebrow nu-eyebrow--ruled">Treatments</p>
            <h2 className="nu-heading nu-catalogue__title" id="treatments-title">
              {COLLAGEN_INTRO.title.lead} <em>{COLLAGEN_INTRO.title.accent}</em>
            </h2>
            <p className="nu-lede">{COLLAGEN_INTRO.body}</p>
          </Reveal>
        </div>
      )}

      {isMenu && data && data.categories.length > 0 && (
        <CategoryNav categories={data.categories} topId="treatments" />
      )}

      {intro}

      {isPending && <SkeletonList rows={3} height={240} />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.categories.length === 0 && (
        <EmptyState title="Our treatment menu is being updated." message="Please check back shortly." />
      )}

      {data?.categories.map((category) => (
        <CategoryRow
          key={category.slug}
          category={category}
          limit={isMenu ? undefined : PREVIEW_LIMIT}
          headingLevel={isMenu ? 'h2' : 'h3'}
          showFacts={isMenu}
        />
      ))}

      {!isMenu && (
        <Reveal>
          <div className="nu-catalogue__all">
            <Link to="/services" className="nu-btn nu-btn--outline">
              View the full treatment menu
            </Link>
          </div>
        </Reveal>
      )}
    </section>
  );
}

interface CategoryRowProps {
  category: ServiceCategory;
  limit?: number;
  headingLevel: 'h2' | 'h3';
  showFacts: boolean;
}

/** A category's name and line on the left, its treatments on the right. */
function CategoryRow({ category, limit, headingLevel: Heading, showFacts }: CategoryRowProps) {
  const services = limit ? category.services.slice(0, limit) : category.services;
  const total = category.services.length;
  const hasMore = total > services.length;
  const titleId = `category-${category.slug}-title`;

  return (
    <section className="nu-category" id={`category-${category.slug}`} aria-labelledby={titleId}>
      <Reveal className="nu-category__inner">
        <div className="nu-category__aside">
          <span className="nu-category__badge">
            <Icon name={categoryIcon(category.slug)} />
          </span>
          <div>
            <Heading className="nu-category__title" id={titleId}>
              {category.label}
            </Heading>
            {CATEGORY_INTROS[category.slug] && (
              <p className="nu-category__intro">{CATEGORY_INTROS[category.slug]}</p>
            )}
            {hasMore ? (
              <Link className="nu-category__more" to={`/services#category-${category.slug}`}>
                View all ({total})<span className="nu-sr-only"> {category.label} treatments</span>
                <Icon name="arrow" />
              </Link>
            ) : (
              <p className="nu-category__count">
                {total} treatment{total === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>

        <div className="nu-category__main">
          <ul className="nu-service-grid">
            {services.map((service) => (
              <li key={service._id}>
                <ServiceCard service={service} headingLevel={Heading === 'h2' ? 'h3' : 'h4'} />
              </li>
            ))}
          </ul>

          {showFacts && <CategoryFacts slug={category.slug} label={category.label} />}
        </div>
      </Reveal>
    </section>
  );
}

/**
 * What the category is, who it is for and which concerns it addresses — in
 * plain sentences. Folded under the cards so the menu reads like the design,
 * but still on the page: this is the block an AI assistant or a search engine
 * can quote when someone asks "what treats acne scars?".
 */
function CategoryFacts({ slug, label }: { slug: string; label: string }) {
  const facts = treatmentFacts(slug);
  if (!facts) return null;

  return (
    <details className="nu-category__facts">
      <summary>About {label}</summary>
      <div className="nu-facts">
        <div className="nu-facts__row">
          <p className="nu-facts__key">What it is</p>
          <div className="nu-facts__value">{facts.whatItIs}</div>
        </div>
        <div className="nu-facts__row">
          <p className="nu-facts__key">Who it's for</p>
          <div className="nu-facts__value">{facts.whoItIsFor}</div>
        </div>
        {facts.addresses.length > 0 && (
          <div className="nu-facts__row">
            <p className="nu-facts__key">What it addresses</p>
            <ul className="nu-facts__tags">
              {facts.addresses.map((concern) => (
                <li className="nu-facts__tag" key={concern}>
                  {concern}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
