import { useMemo, useState } from 'react';
import { Seo } from '@/components/ui/Seo';
import { JsonLd } from '@/components/ui/JsonLd';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { GalleryGrid } from '@/components/landing/GallerySection';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import { BUSINESS } from '@/content/business';
import { useGallery, useServices } from '@/hooks/queries';
import { breadcrumbSchema } from '@/lib/geo.js';

export function GalleryPage() {
  const [category, setCategory] = useState<string | null>(null);
  const breadcrumb = useMemo(
    () =>
      breadcrumbSchema(BUSINESS, [
        { name: 'Home', path: '/' },
        { name: 'Gallery', path: '/gallery' },
      ]),
    [],
  );
  const { data, isPending, isError, error, refetch } = useGallery();
  const { data: catalogue } = useServices();

  const images = data?.images ?? [];
  // Only offer filters for categories that actually have images.
  const availableCategories = (catalogue?.categories ?? []).filter((entry) =>
    images.some((image) => image.category === entry.slug),
  );
  const visible = category ? images.filter((image) => image.category === category) : images;

  return (
    <>
      <Seo
        title="Gallery — Nurella Beauty Lounge"
        description="A look inside Nurella Beauty Lounge and the treatments we offer — facial aesthetics, skin treatments, laser, permanent makeup and nails."
        canonicalPath="/gallery"
      />
      <JsonLd id="breadcrumb" data={breadcrumb} />

      <section className="nu-section nu-container" style={{ paddingTop: '9rem' }}>
        <div className="nu-section-head">
          <p className="nu-eyebrow">Our work</p>
          <h1 className="nu-heading" style={{ marginBlock: 'var(--nu-space-3)' }}>
            The Nurella Gallery
          </h1>
        </div>

        {availableCategories.length > 0 && (
          <SegmentedTabs
            tabs={[
              { key: 'all', label: 'All' },
              ...availableCategories.map((entry) => ({ key: entry.slug, label: entry.label })),
            ]}
            value={category ?? 'all'}
            onChange={(key) => setCategory(key === 'all' ? null : key)}
            label="Filter gallery by category"
            controls="gallery-panel"
            className="nu-segmented--spaced"
          />
        )}

        <div id="gallery-panel" role="tabpanel" tabIndex={-1}>
        {isPending && <SkeletonList rows={2} height={240} />}
        {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

        {!isPending && visible.length === 0 && (
          <EmptyState
            title="No images to show yet."
            message="Our gallery is being prepared. Please check back shortly."
          />
        )}

        {visible.length > 0 && <GalleryGrid images={visible} />}
        </div>
      </section>

      <BookingCtaSection />
    </>
  );
}

export default GalleryPage;
