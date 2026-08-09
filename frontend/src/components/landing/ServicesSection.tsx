import { Link } from 'react-router-dom';
import { Reveal } from '@/components/ui/Reveal';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import { ServiceCard } from '@/components/landing/ServiceCard';
import { CATEGORY_INTROS, COLLAGEN_INTRO } from '@/content/brand';
import { useServices } from '@/hooks/queries';

interface ServicesSectionProps {
  /** Landing page shows a curated subset; the Treatments page shows everything. */
  limitPerCategory?: number;
  showViewAll?: boolean;
}

export function ServicesSection({ limitPerCategory, showViewAll }: ServicesSectionProps) {
  const { data, isPending, isError, error, refetch } = useServices();

  return (
    <section className="nu-section nu-container" id="treatments">
      <div className="nu-section-head">
        <Reveal>
          <p className="nu-eyebrow">Treatments</p>
          <h2 className="nu-heading">{COLLAGEN_INTRO.title}</h2>
          <p className="nu-lede">{COLLAGEN_INTRO.body}</p>
        </Reveal>
      </div>

      {isPending && <SkeletonList rows={3} height={160} />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.categories.length === 0 && (
        <EmptyState title="Our treatment menu is being updated." message="Please check back shortly." />
      )}

      {data?.categories.map((category, index) => {
        const services = limitPerCategory
          ? category.services.slice(0, limitPerCategory)
          : category.services;
        const hidden = category.services.length - services.length;

        return (
          <Reveal key={category.slug} delay={Math.min(index, 3) * 0.05}>
            <div className="nu-category">
              <div className="nu-category__head">
                <h3 className="nu-category__title" id={`category-${category.slug}`}>
                  {category.label}
                </h3>
                <span className="nu-category__count">
                  {category.services.length} treatment{category.services.length === 1 ? '' : 's'}
                </span>
              </div>

              {CATEGORY_INTROS[category.slug] && (
                <p className="nu-category__intro">{CATEGORY_INTROS[category.slug]}</p>
              )}

              <div className="nu-service-grid">
                {services.map((service) => (
                  <ServiceCard key={service._id} service={service} />
                ))}
              </div>

              {hidden > 0 && (
                <p style={{ marginTop: 'var(--nu-space-4)' }}>
                  <Link className="nu-link" to={`/services#category-${category.slug}`}>
                    View all {category.services.length} {category.label} treatments
                  </Link>
                </p>
              )}
            </div>
          </Reveal>
        );
      })}

      {showViewAll && (
        <Reveal>
          <div style={{ textAlign: 'center', marginTop: 'var(--nu-space-6)' }}>
            <Link to="/services" className="nu-btn nu-btn--outline">
              View the full treatment menu
            </Link>
          </div>
        </Reveal>
      )}
    </section>
  );
}
