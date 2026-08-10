import { Link } from 'react-router-dom';
import { Reveal } from '@/components/ui/Reveal';
import { EmptyState, SkeletonList } from '@/components/ui/States';
import { useGallery } from '@/hooks/queries';
import type { GalleryImage } from '@/types/api';

export function GalleryGrid({ images }: { images: GalleryImage[] }) {
  return (
    <div className="nu-gallery-grid">
      {images.map((image, index) => (
        <Reveal key={image._id} delay={Math.min(index, 5) * 0.06} as="article">
          <figure className="nu-gallery-item">
            <img src={image.imageUrl} alt={image.altText} loading="lazy" decoding="async" />
            <figcaption className="nu-gallery-item__caption">
              <p className="nu-gallery-item__title">{image.title}</p>
              {image.caption && <p className="nu-gallery-item__sub">{image.caption}</p>}
            </figcaption>
          </figure>
        </Reveal>
      ))}
    </div>
  );
}

export function GallerySection({ limit }: { limit?: number }) {
  const { data, isPending } = useGallery();
  const images = limit ? (data?.images ?? []).slice(0, limit) : (data?.images ?? []);

  return (
    <section className="nu-section nu-container nu-section--tint nu-section--blush" id="gallery">
      <div className="nu-section-head nu-section-head--center">
        <Reveal>
          <p className="nu-eyebrow">Our work</p>
          <h2 className="nu-heading">The Nurella Gallery</h2>
        </Reveal>
      </div>

      {isPending && <SkeletonList rows={2} height={220} />}

      {!isPending && images.length === 0 && (
        <EmptyState title="Our gallery is being prepared." message="Please check back shortly." />
      )}

      {images.length > 0 && <GalleryGrid images={images} />}

      {limit && (data?.images.length ?? 0) > limit && (
        <div style={{ textAlign: 'center', marginTop: 'var(--nu-space-6)' }}>
          <Link to="/gallery" className="nu-btn nu-btn--outline">
            View the full gallery
          </Link>
        </div>
      )}
    </section>
  );
}
