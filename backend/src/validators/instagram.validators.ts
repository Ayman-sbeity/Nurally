import { z } from 'zod';

/**
 * Accepts the address of a single Instagram post, whatever shape the admin
 * pasted, and yields the canonical permalink plus its shortcode.
 *
 * Instagram uses four prefixes for the same kind of object — `/reel/`,
 * `/reels/`, `/p/` and the legacy `/tv/` — and the app appends tracking
 * parameters (`?igsh=…`) when you use the share sheet. All of those describe
 * one reel, so they are normalised to a single form: two pastes of the same
 * reel must collide on the unique index rather than both being stored.
 *
 * The shortcode is deliberately restricted to the characters Instagram's own
 * base64 alphabet uses. It is later interpolated into an embed URL, and a
 * pattern this tight means that URL cannot be steered anywhere else.
 */
const PERMALINK = /^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{5,32})\/?/i;

export interface ParsedPermalink {
  permalink: string;
  shortcode: string;
}

export function parseInstagramPermalink(input: string): ParsedPermalink | null {
  const match = PERMALINK.exec(input.trim());
  const shortcode = match?.[1];
  if (!shortcode) return null;

  return { shortcode, permalink: `https://www.instagram.com/reel/${shortcode}/` };
}

const permalinkSchema = z.string().trim().min(1).max(500).refine(
  (value) => parseInstagramPermalink(value) !== null,
  { message: 'Paste the address of an Instagram reel, e.g. https://www.instagram.com/reel/ABC123/' },
);

/**
 * Same rule as the catalogue's image fields: one of our own paths or an
 * absolute http(s) address, so `javascript:` and `data:` can never reach the
 * `src` attributes these end up in.
 */
const mediaUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => /^(https?:\/\/|\/(?!\/))/.test(value), {
    message: 'Enter an https:// address or a path beginning with /.',
  });

export const lookupReelSchema = z.object({ permalink: permalinkSchema });

export const createReelSchema = z.object({
  permalink: permalinkSchema,
  caption: z.string().trim().max(600).optional(),
  coverImageUrl: mediaUrlSchema,
  altText: z.string().trim().min(2, 'Describe the reel for screen readers.').max(240),
  // Empty string is meaningful: it clears an uploaded video and sends the reel
  // back to Instagram's embed.
  videoUrl: z.union([mediaUrlSchema, z.literal('')]).optional(),
  postedAt: z.coerce.date().optional(),
  isActive: z.boolean().optional().default(true),
  displayOrder: z.coerce.number().int().optional().default(0),
});

export const updateReelSchema = createReelSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update.' });
