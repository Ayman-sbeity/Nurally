import { useState } from 'react';
import { mediaSrc } from '@/utils/media';
import type { ClientAsset } from '@/types/api';

interface AuthImageProps {
  asset: ClientAsset;
  /** `thumb` for grids and lists, `display` for the full-size preview. */
  variant: 'thumb' | 'display';
  alt: string;
  className?: string;
}

/**
 * Renders a client photograph that only an authenticated admin may read.
 *
 * The admin API lists every image with signed, expiring URLs (see
 * `assetUrl.service.ts` on the server), so this is a plain `<img>`. The
 * browser schedules, lazy-loads, decodes off the main thread and caches it —
 * none of which happened when the bytes were fetched as a blob. Both variants
 * are WebP re-encodes: a thumbnail is tens of kilobytes rather than the
 * camera's several megabytes.
 *
 * The preview paints over its own thumbnail, which the grid has already put
 * in the browser's cache. So a preview shows a picture the moment it opens,
 * and sharpens when the full-size image lands.
 *
 * Load and failure are tracked per URL rather than reset in an effect: when a
 * refreshed listing brings a newly signed URL, the image simply tries again.
 */
export function AuthImage({ asset, variant, alt, className }: AuthImageProps) {
  const url = asset.urls?.[variant];
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  if (!url || failed === url) {
    return (
      <div className={`nu-authimg nu-authimg--failed ${className ?? ''}`.trim()} role="img" aria-label={alt}>
        <span>Unavailable</span>
      </div>
    );
  }

  // Dropped once loaded, so it cannot show through a transparent PNG scan.
  const placeholder = variant === 'display' && loaded !== url ? asset.urls?.thumb : undefined;
  const classes = [
    'nu-authimg',
    variant === 'display' ? 'nu-authimg--progressive' : loaded !== url ? 'nu-authimg--loading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <img
      src={mediaSrc(url)}
      alt={alt}
      className={classes}
      // The preview's box is sized before a byte arrives, so the dialog opens at
      // its final size instead of jumping when the image lands.
      width={variant === 'display' ? asset.width : undefined}
      height={variant === 'display' ? asset.height : undefined}
      loading={variant === 'thumb' ? 'lazy' : 'eager'}
      decoding="async"
      style={placeholder ? { backgroundImage: `url("${mediaSrc(placeholder)}")` } : undefined}
      onLoad={() => setLoaded(url)}
      onError={() => setFailed(url)}
    />
  );
}
