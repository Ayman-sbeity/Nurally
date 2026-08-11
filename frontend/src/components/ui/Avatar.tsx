import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { initials } from '@/utils/format';

interface AvatarProps {
  userId: string;
  fullName: string;
  /** ISO date from `avatarUpdatedAt`. Absent means "no photo" — show initials. */
  updatedAt?: string;
  /** Rendered size in px. Drives the element box; the image is object-fit cover. */
  size?: number;
  className?: string;
}

/**
 * Profile photo, falling back to the user's initials.
 *
 * Avatars are personal data and are served from an authenticated route, and
 * the access token lives in memory rather than a cookie — so a plain
 * `<img src="/api/users/…/avatar">` would be sent without credentials and 401.
 * The bytes come through the API client and are handed to the `<img>` as an
 * object URL, the same approach as the admin's client photographs.
 */

/**
 * Object URLs are cached per user+version so the admin client table does not
 * refetch every avatar on each render or re-mount, and so scrolling a list
 * does not issue the same request repeatedly.
 *
 * Deliberately never evicted during a session: the entries are small, the key
 * changes whenever a photo is replaced, and a full reload clears it. Revoking
 * on unmount — as the single-image AuthImage does — would be wrong here,
 * because the same URL may still be mounted elsewhere in the table.
 */
const cache = new Map<string, Promise<string>>();

function loadAvatar(userId: string, version: string): Promise<string> {
  const key = `${userId}:${version}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const pending = api
    .get<Blob>(`/users/${userId}/avatar`, {
      responseType: 'blob',
      params: { v: version },
    })
    .then((response) => URL.createObjectURL(response.data))
    .catch((error) => {
      // A failure must not be cached, or a transient network blip would leave
      // the avatar broken for the rest of the session.
      cache.delete(key);
      throw error;
    });

  cache.set(key, pending);
  return pending;
}

export function Avatar({ userId, fullName, updatedAt, size = 40, className }: AvatarProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!updatedAt) {
      setSrc(null);
      return undefined;
    }

    let cancelled = false;
    loadAvatar(userId, updatedAt)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        // Falls back to initials, which is a perfectly good avatar.
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, updatedAt]);

  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };
  const classes = `nu-avatar${className ? ` ${className}` : ''}`;

  if (!src) {
    return (
      <span className={classes} style={style} aria-hidden="true">
        {initials(fullName)}
      </span>
    );
  }

  return (
    <img
      className={`${classes} nu-avatar--image`}
      style={style}
      src={src}
      // Decorative: every place this is used already shows the name as text.
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}

/** Drops a user's cached photo so the next render refetches it. */
export function forgetAvatar(userId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`)) cache.delete(key);
  }
}
