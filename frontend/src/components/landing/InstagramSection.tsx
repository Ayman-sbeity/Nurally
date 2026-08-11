import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Reveal } from '@/components/ui/Reveal';
import { SkeletonList } from '@/components/ui/States';
import { BRAND, instagramUrl } from '@/content/brand';
import { useInstagramReels } from '@/hooks/queries';
import { mediaSrc } from '@/utils/media';
import type { InstagramReel } from '@/types/api';

// The player is only ever needed after a click, and it carries the modal
// machinery with it — so it is not part of the landing page's first paint.
const ReelViewer = lazy(() =>
  import('./ReelViewer').then((module) => ({ default: module.ReelViewer })),
);

/** Instagram's glyph, drawn rather than loaded, so the section costs no request. */
function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" />
    </svg>
  );
}

/**
 * True when the device has a real pointer and the visitor has not asked for
 * less motion or less data.
 *
 * Cards only preview themselves under those conditions. On a phone the whole
 * rail would otherwise start pulling video down on a mobile connection to
 * animate thumbnails nobody asked to play — the tap opens the player, which is
 * where the reel is meant to be watched anyway.
 */
function useCanPreview(): boolean {
  const [canPreview, setCanPreview] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;

    const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection;

    const evaluate = () => setCanPreview(hover.matches && !motion.matches && !connection?.saveData);
    evaluate();

    hover.addEventListener('change', evaluate);
    motion.addEventListener('change', evaluate);
    return () => {
      hover.removeEventListener('change', evaluate);
      motion.removeEventListener('change', evaluate);
    };
  }, []);

  return canPreview;
}

interface ReelCardProps {
  reel: InstagramReel;
  onOpen: () => void;
  eager: boolean;
  canPreview: boolean;
}

function ReelCard({ reel, onOpen, eager, canPreview }: ReelCardProps) {
  const [previewing, setPreviewing] = useState(false);

  // The preview element is mounted on hover and unmounted on leave, so a reel
  // nobody points at costs exactly one poster image.
  const showPreview = previewing && canPreview && Boolean(reel.videoUrl);

  return (
    <li className="nu-reel">
      <button
        type="button"
        className="nu-reel__card"
        onClick={onOpen}
        onMouseEnter={() => setPreviewing(true)}
        onMouseLeave={() => setPreviewing(false)}
        onFocus={() => setPreviewing(true)}
        onBlur={() => setPreviewing(false)}
      >
        <img
          className="nu-reel__cover"
          src={mediaSrc(reel.coverImageUrl)}
          alt={reel.altText}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />

        {showPreview && (
          <video
            className="nu-reel__preview"
            src={mediaSrc(reel.videoUrl as string)}
            poster={mediaSrc(reel.coverImageUrl)}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            // Decorative: the poster underneath already carries the alt text,
            // and the card's own label describes the action.
            aria-hidden="true"
            tabIndex={-1}
          />
        )}

        <span className="nu-reel__play" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>

        {reel.caption && <span className="nu-reel__caption">{reel.caption}</span>}
        <span className="nu-sr-only">Play this reel</span>
      </button>
    </li>
  );
}

/**
 * The lounge's Instagram, on the lounge's own page.
 *
 * Reels are curated in the admin rather than pulled from the Graph API: that
 * API needs a Business account, a linked Page and a token refreshed every sixty
 * days, and the day any of it lapses this section would empty itself on the
 * home page. Curated reels keep working.
 *
 * Renders nothing at all until reels are added — an empty "follow us" band is
 * worse than no band.
 */
export function InstagramSection({ limit = 8 }: { limit?: number }) {
  const { data, isPending } = useInstagramReels();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const railRef = useRef<HTMLUListElement>(null);
  // Evaluated once for the whole rail rather than once per card: the answer is
  // a property of the device, not of any one reel.
  const canPreview = useCanPreview();

  const reels = (data?.reels ?? []).slice(0, limit);

  // Stepping through reels in the player scrolls the rail to match, so closing
  // it leaves the visitor looking at the one they were just watching.
  useEffect(() => {
    if (openIndex === null) return;
    railRef.current?.children[openIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [openIndex]);

  if (!isPending && reels.length === 0) return null;

  return (
    <section className="nu-section nu-container nu-instagram" id="instagram">
      <div className="nu-instagram__head">
        <Reveal>
          <p className="nu-eyebrow">@{BRAND.instagramHandle}</p>
          <h2 className="nu-heading">Watch the lounge on Instagram</h2>
          <p className="nu-lede">
            Treatments, results and everyday moments from Nurella — play them here, or follow along
            for each new one.
          </p>
        </Reveal>

        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="nu-btn nu-btn--primary nu-instagram__follow"
        >
          <InstagramGlyph />
          <span>Follow @{BRAND.instagramHandle}</span>
        </a>
      </div>

      {isPending ? (
        <SkeletonList rows={1} height={320} />
      ) : (
        <ul className="nu-reels" ref={railRef}>
          {reels.map((reel, index) => (
            <ReelCard
              key={reel._id}
              reel={reel}
              eager={index < 2}
              canPreview={canPreview}
              onOpen={() => setOpenIndex(index)}
            />
          ))}
        </ul>
      )}

      {openIndex !== null && (
        <Suspense fallback={null}>
          <ReelViewer
            reels={reels}
            index={openIndex}
            onIndexChange={setOpenIndex}
            onClose={() => setOpenIndex(null)}
          />
        </Suspense>
      )}
    </section>
  );
}
