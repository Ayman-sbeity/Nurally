import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Seo } from '@/components/ui/Seo';
import { JsonLd } from '@/components/ui/JsonLd';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useBookService } from '@/components/landing/ServiceCard';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';
import { ServiceFacts } from '@/components/landing/ServiceFacts';
import { ServiceCard } from '@/components/landing/ServiceCard';
import { categoryImage } from '@/content/brand';
import { BUSINESS, treatmentFacts } from '@/content/business';
import { useService, useServices } from '@/hooks/queries';
import { breadcrumbSchema, serviceSchema } from '@/lib/geo.js';
import type { Service, ServiceCategory } from '@/types/api';
import { mediaSrc } from '@/utils/media';

export function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isPending, isError, error, refetch } = useService(slug);
  const { data: catalogue } = useServices();

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

  const category = catalogue?.categories.find((entry) => entry.slug === data.service.category);

  // Split out so the structured data can be memoised without the hook sitting
  // behind the loading and error branches above.
  return <ServiceDetail service={data.service} category={category} />;
}

function ServiceDetail({ service, category }: { service: Service; category?: ServiceCategory }) {
  const bookService = useBookService();
  const facts = treatmentFacts(service.category);
  const related = (category?.services ?? []).filter((item) => item._id !== service._id).slice(0, 3);

  const schema = useMemo(
    () => serviceSchema(BUSINESS, service, category, facts),
    [service, category, facts],
  );
  const breadcrumb = useMemo(
    () =>
      breadcrumbSchema(BUSINESS, [
        { name: 'Home', path: '/' },
        { name: 'Treatments', path: '/services' },
        { name: service.name, path: `/services/${service.slug}` },
      ]),
    [service],
  );

  // Fact-dense first sentence, so the search snippet and any AI summary lead
  // with what the treatment is rather than with the lounge's positioning.
  const description =
    service.description ??
    (facts ? `${service.name} at ${BUSINESS.name}. ${facts.whatItIs}` : undefined) ??
    `${service.name} at ${BUSINESS.name}. Every treatment begins with a personalized consultation.`;

  return (
    <>
      <Seo
        title={`${service.name} — Nurella Beauty Lounge`}
        description={description}
        canonicalPath={`/services/${service.slug}`}
      />
      <JsonLd id="service" data={schema} />
      <JsonLd id="breadcrumb" data={breadcrumb} />

      <article className="nu-section nu-container" style={{ paddingTop: '9rem' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: 'var(--nu-space-5)' }}>
          <Link to="/services" className="nu-eyebrow">
            ← All treatments
          </Link>
        </nav>

        <div className="nu-editorial">
          <div className="nu-editorial__media">
            <img
              // Falls back to the category's artwork, matching the treatment cards.
              src={mediaSrc(service.imageUrl ?? categoryImage(service.category))}
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

            {/* The plain answer comes first — what it is, who it is for, what
                it addresses, how long it takes, what it costs — and the
                lounge's own copy follows it. */}
            <ServiceFacts service={service} category={category} />

            {service.description && (
              <p className="nu-lede" style={{ marginTop: 'var(--nu-space-6)' }}>
                {service.description}
              </p>
            )}

            <p className="nu-prose" style={{ marginTop: 'var(--nu-space-5)' }}>
              Every treatment at {BUSINESS.name} begins with a personalized consultation. The plan,
              the number of sessions and the price are confirmed with you before anything is carried
              out.
            </p>

            <button
              type="button"
              className="nu-btn nu-btn--primary"
              style={{ marginTop: 'var(--nu-space-6)' }}
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
