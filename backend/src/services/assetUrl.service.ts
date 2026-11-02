import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import type { AssetVariant } from '../types/domain';

/**
 * Signed, expiring addresses for client images.
 *
 * The access token lives in memory, so an `<img>` cannot authenticate itself.
 * The admin UI used to work around that by downloading each photo through the
 * API client and showing it as a blob — which bypassed everything the browser
 * does well with images: parallel loading, lazy loading, progressive decoding
 * and its HTTP cache.
 *
 * Instead, the authenticated listing that already decided this admin may see
 * these photos hands back URLs that carry their own proof: an HMAC over the
 * asset, the variant and an expiry. The image route checks that signature and
 * nothing else, so a plain `<img src>` works, and one URL can never be edited
 * into another photo, another variant or a later expiry.
 *
 * Expiry is rounded up to the hour. Every listing inside the same hour returns
 * byte-identical URLs, which is what lets the browser serve a photo it already
 * has instead of downloading it again — a URL re-signed on every request would
 * never be a cache hit. A URL therefore lives between one and two hours.
 */
const WINDOW_SECONDS = 60 * 60;

/**
 * Derived from the access-token secret rather than configured separately: one
 * secret fewer to provision, and the label means nothing signed here can be
 * confused with anything else signed with that key.
 */
const signingKey = createHmac('sha256', env.JWT_ACCESS_SECRET).update('nurella:asset-url:v1').digest();

const signature = (assetId: string, variant: AssetVariant, expiresAt: number) =>
  createHmac('sha256', signingKey).update(`${assetId}:${variant}:${expiresAt}`).digest('base64url');

/** `/api/assets/<id>/<variant>?exp=…&sig=…`, valid for one to two hours. */
export function signAssetUrl(assetId: string, variant: AssetVariant, now = Date.now()): string {
  const expiresAt = (Math.floor(now / 1000 / WINDOW_SECONDS) + 2) * WINDOW_SECONDS;
  return `/api/assets/${assetId}/${variant}?exp=${expiresAt}&sig=${signature(assetId, variant, expiresAt)}`;
}

/**
 * Seconds the URL has left to live, or null when it is expired or was not
 * signed by us. The comparison is constant-time so the signature cannot be
 * recovered byte by byte from response timings.
 */
export function verifyAssetUrl(
  assetId: string,
  variant: AssetVariant,
  expiresAt: number,
  sig: string,
  now = Date.now(),
): number | null {
  const remaining = expiresAt - Math.floor(now / 1000);
  if (remaining <= 0) return null;

  const expected = Buffer.from(signature(assetId, variant, expiresAt));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return remaining;
}
