import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BRAND, instagramUrl } from '@/content/brand';
import { useModalLayer } from '@/hooks/useModalLayer';
import { mediaSrc } from '@/utils/media';
import type { InstagramReel } from '@/types/api';

interface ReelViewerProps {
  reels: InstagramReel[];
  /** Index of the reel being watched; the parent owns it so the rail can scroll along. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * Full-screen reel player.
 *
 * Reels with an uploaded video play from our own server: a real `<video>` with
 * native controls, so the visitor gets keyboard seeking, captions, picture-in-
 * picture and full screen for free, and nothing about the page is handed to a
 * third party. Reels without one fall back to Instagram's embed, which still
 * plays in place but loads a frame from instagram.com.
 *
 * Navigation is buttons and arrow keys rather than swipe: a horizontal swipe
 * over a video with native controls is already the browser's scrub gesture, and
 * stealing it makes the scrubber feel broken.
 */
export function ReelViewer({ reels, index, onIndexChange, onClose }: ReelViewerProps) {
  const panelRef = useModalLayer<HTMLDivElement>(true, onClose);
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleId = useId();

  // Sound is a property of the session, not of one reel — turning it on once
  // should hold as the visitor moves through the rail.
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const reel = reels[index];
  const hasPrevious = index > 0;
  const hasNext = index < reels.length - 1;

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < reels.length) onIndexChange(next);
    },
    [index, reels.length, onIndexChange],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      // Those keys seek when the player itself has focus. Leave them to it.
      if (document.activeElement === videoRef.current) return;

      event.preventDefault();
      go(event.key === 'ArrowRight' ? 1 : -1);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [go]);

  /**
   * Start playing whenever the reel changes.
   *
   * Browsers only allow unmuted playback once they trust the visitor meant it,
   * and opening this viewer is a click — but the play call happens a render
   * later, which Safari in particular may still refuse. So the rejection is
   * caught and retried muted rather than left as a video that silently never
   * starts; the sound button then says what happened.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = mutedRef.current;
    void video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      void video.play().catch(() => {
        /* Autoplay refused outright — the controls are right there. */
      });
    });
  }, [reel?._id]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  if (!reel) return null;

  const posted = reel.postedAt
    ? new Date(reel.postedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;

  return createPortal(
    <div
      className="nu-reel-viewer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="nu-reel-viewer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="nu-reel-viewer__bar">
          <p className="nu-reel-viewer__handle" id={titleId}>
            @{BRAND.instagramHandle}
            <span className="nu-reel-viewer__count">
              {index + 1} / {reels.length}
            </span>
          </p>
          <button type="button" className="nu-reel-viewer__close" onClick={onClose}>
            <span aria-hidden="true">✕</span>
            <span className="nu-sr-only">Close</span>
          </button>
        </div>

        <div className="nu-reel-viewer__stage">
          <button
            type="button"
            className="nu-reel-viewer__step nu-reel-viewer__step--prev"
            onClick={() => go(-1)}
            disabled={!hasPrevious}
          >
            <span aria-hidden="true">‹</span>
            <span className="nu-sr-only">Previous reel</span>
          </button>

          <div className="nu-reel-viewer__media">
            {reel.videoUrl ? (
              <video
                // Keyed so switching reels mounts a fresh element rather than
                // swapping the source under a player mid-play.
                key={reel._id}
                ref={videoRef}
                className="nu-reel-viewer__video"
                src={mediaSrc(reel.videoUrl)}
                poster={mediaSrc(reel.coverImageUrl)}
                controls
                loop
                playsInline
                preload="auto"
                aria-label={reel.altText}
              />
            ) : (
              <iframe
                key={reel._id}
                className="nu-reel-viewer__embed"
                // The shortcode is validated server-side against Instagram's own
                // alphabet, so this URL cannot be steered off instagram.com.
                src={`https://www.instagram.com/reel/${reel.shortcode}/embed`}
                title={reel.altText}
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            )}
          </div>

          <button
            type="button"
            className="nu-reel-viewer__step nu-reel-viewer__step--next"
            onClick={() => go(1)}
            disabled={!hasNext}
          >
            <span aria-hidden="true">›</span>
            <span className="nu-sr-only">Next reel</span>
          </button>
        </div>

        <div className="nu-reel-viewer__foot">
          {reel.caption && <p className="nu-reel-viewer__caption">{reel.caption}</p>}
          {posted && <p className="nu-reel-viewer__date">{posted}</p>}

          <div className="nu-reel-viewer__actions">
            {reel.videoUrl && (
              <button
                type="button"
                className="nu-btn nu-btn--on-dark-outline nu-btn--sm"
                onClick={() => setMuted((value) => !value)}
              >
                {muted ? 'Turn sound on' : 'Mute'}
              </button>
            )}
            <a
              href={reel.permalink}
              target="_blank"
              rel="noreferrer noopener"
              className="nu-btn nu-btn--on-dark-outline nu-btn--sm"
            >
              View on Instagram
            </a>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="nu-btn nu-btn--gold nu-btn--sm"
            >
              Follow @{BRAND.instagramHandle}
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
