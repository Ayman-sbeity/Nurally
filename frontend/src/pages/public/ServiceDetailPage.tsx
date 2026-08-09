import { Link, useParams } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBookService } from '@/components/landing/ServiceCard';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';
import { useService, useServices } from '@/hooks/queries';
import { ServiceCard } from '@/components/landing/ServiceCard';
import { formatDuration, formatPrice } from '@/utils/format';

export function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isPending, isError, error, refetch } = useService(slug);
  const { data: catalogue } = useServices();
  const bookService = useBookService();

  if (isPending) {
    return (
      <div style={{ paddingTop: '9rem', minHeight: '60dvh' }}>
        <LoadingState />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="nu-container" style={{ paddingTop: '9rem', minHeight: '60dvh' }}>
        <ErrorState error={error} onRetry={() => void refetch()} />
        <div style={{ textAlign: 'center' }}>
          <Link to="/services" className="nu-link">
            Back to all treatments
          </Link>
        </div>
      </div>
    );
  }

  const { service } = data;
  const price = formatPrice(service.price, service.currency);
  const category = catalogue?.categories.find((entry) => entry.slug === service.category);
  const related = (category?.services ?? []).filter((item) => item._id !== service._id).slice(0, 3);

  return (
    <>
      <Seo
        title={`${service.name} — Nurella Beauty Lounge`}
        description={
          service.description ??
          `${service.name} at Nurella Beauty Lounge. Book your personalized consultation.`
        }
        canonicalPath={`/services/${service.slug}`}
      />

      <article className="nu-section nu-container" style={{ paddingTop: '9rem' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--nu-space-5)' }}>
          <Link to="/services" className="nu-eyebrow">
            ← All treatments
          </Link>
        </nav>

        <div className="nu-editorial">
          <div className="nu-editorial__media">
            <img
              src={service.imageUrl ?? '/images/about.svg'}
              alt={service.imageUrl ? service.name : ''}
              role={service.imageUrl ? undefined : 'presentation'}
              loading="lazy"
            />
          </div>

          <div>
            {category && <p className="nu-eyebrow">{category.label}</p>}
            <h1 className="nu-heading" style={{ marginBlock: 'var(--nu-space-3) var(--nu-space-4)' }}>
              {service.name}
            </h1>

            {service.description && <p className="nu-lede">{service.description}</p>}

            <dl className="nu-deflist" style={{ marginBlock: 'var(--nu-space-6)' }}>
              <div className="nu-deflist__row">
                <dt className="nu-deflist__key">Duration</dt>
                <dd>{formatDuration(service.durationMinutes)}</dd>
              </div>
              {/* Price is rendered only when the lounge has configured one. */}
              {price && (
                <div className="nu-deflist__row">
                  <dt className="nu-deflist__key">Price</dt>
                  <dd>{price}</dd>
                </div>
              )}
            </dl>

            <button
              type="button"
              className="nu-btn nu-btn--primary"
              onClick={() => bookService(service._id)}
            >
              Book this service
            </button>
          </div>
        </div>

        {related.length > 0 && (
          <section style={{ marginTop: 'var(--nu-space-9)' }}>
            <div className="nu-category__head">
              <h2 className="nu-category__title">More in {category?.label}</h2>
            </div>
            <div className="nu-service-grid">
              {related.map((item) => (
                <ServiceCard key={item._id} service={item} />
              ))}
            </div>
          </section>
        )}
      </article>

      <BookingCtaSection />
    </>
  );
}

export default ServiceDetailPage;
