import { useEffect, useState } from 'react';
import { adminApi } from '@/api/admin.api';

interface AuthImageProps {
  assetId: string;
  alt: string;
  className?: string;
}

/**
 * Renders a client photograph that only an authenticated admin may read.
 *
 * Uploaded files are never served statically, and the access token is held in
 * memory rather than a cookie, so `<img src="/api/admin/assets/…">` would be
 * sent without credentials and 401. Instead the bytes are fetched through the
 * API client and handed to the `<img>` as an object URL.
 *
 * Every created object URL is revoked when the component unmounts or the asset
 * changes — without that, browsing a client with many photos leaks the whole
 * set into memory until a full page reload.
 */
export function AuthImage({ assetId, alt, className }: AuthImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setSrc(null);
    setFailed(false);

    adminApi
      .fetchAssetBlob(assetId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  if (failed) {
    return (
      <div className={`nu-authimg nu-authimg--failed ${className ?? ''}`.trim()} role="img" aria-label={alt}>
        <span>Unavailable</span>
      </div>
    );
  }

  if (!src) {
    return <div className={`nu-authimg nu-authimg--loading ${className ?? ''}`.trim()} aria-hidden="true" />;
  }

  return <img src={src} alt={alt} className={`nu-authimg ${className ?? ''}`.trim()} loading="lazy" />;
}
