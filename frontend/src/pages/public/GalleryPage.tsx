import { useState } from 'react';
import { Seo } from '@/components/ui/Seo';
import { GalleryGrid } from '@/components/landing/GallerySection';
import { BookingCtaSection } from '@/components/landing/BookingCtaSection';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import { useGallery, useServices } from '@/hooks/queries';

export function GalleryPage() {
  const [category, setCategory] = useState<string | null>(null);
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
        description="A look inside Nurella Beauty Lounge and the treatments we offer."
        canonicalPath="/gallery"
      />

      <section className="nu-section nu-container" style={{ paddingTop: '9rem' }}>
        <div className="nu-section-head">
          <p className="nu-eyebrow">Our work</p>
          <h1 className="nu-heading" style={{ marginBlock: 'var(--nu-space-3)' }}>
            The Nurella Gallery
          </h1>
        </div>

        {availableCategories.length > 0 && (
          <div
            className="nu-segmented"
            role="tablist"
            aria-label="Filter gallery by category"
            style={{ marginBottom: 'var(--nu-space-6)' }}
          >
            <button type="button" role="tab" aria-selected={category === null} onClick={() => setCategory(null)}>
              All
            </button>
            {availableCategories.map((entry) => (
              <button
                key={entry.slug}
                type="button"
                role="tab"
                aria-selected={category === entry.slug}
                onClick={() => setCategory(entry.slug)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}

        {isPending && <SkeletonList rows={2} height={240} />}
        {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

        {!isPending && visible.length === 0 && (
          <EmptyState
            title="No images to show yet."
            message="Our gallery is being prepared. Please check back shortly."
          />
        )}

        {visible.length > 0 && <GalleryGrid images={visible} />}
      </section>

      <BookingCtaSection />
    </>
  );
}

export default GalleryPage;
