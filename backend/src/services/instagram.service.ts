import { verifyUpload } from '../middleware/upload';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { parseInstagramPermalink } from '../validators/instagram.validators';
import { savePublicImage } from './media.service';

/**
 * Reads what Instagram publishes about a reel, so the admin pastes a link
 * instead of filling the form by hand.
 *
 * WHY IT LOOKS LIKE THIS
 * ----------------------
 * Meta made the oEmbed endpoint tokenless for public content in June 2026 — no
 * app, no token, no App Review — but had already removed `thumbnail_url` from
 * the response in November 2025. Their own guidance is now to read the
 * thumbnail out of the post's HTML metadata, which is what the second half of
 * this does.
 *
 * So the two calls have different jobs: oEmbed is the *authority* on whether a
 * reel exists and is public (and gives a precise reason when it is not), and
 * the embed page is where the poster and caption actually live.
 *
 * The poster is downloaded and re-hosted rather than linked. Instagram's CDN
 * URLs carry an expiring signature — a hotlinked cover would quietly turn into
 * a broken image weeks after the reel was featured.
 */

const OEMBED = 'https://graph.facebook.com/v23.0/instagram_oembed';
const USER_AGENT = 'Mozilla/5.0 (compatible; NurellaBot/1.0; +https://nurella.example)';

/** Instagram's own image CDNs. The poster URL comes out of their HTML, so it
 *  is not fully ours to trust — it is only ever fetched if it points here. */
const CDN_HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

const FETCH_TIMEOUT_MS = 12_000;
/** A poster frame is a still. Anything larger than this is not one. */
const MAX_COVER_BYTES = 8 * 1024 * 1024;

export interface ReelLookup {
  permalink: string;
  shortcode: string;
  /** Stored on our own server, so it cannot expire. Absent if none was found. */
  coverImageUrl?: string;
  caption?: string;
}

export async function lookupReel(input: string): Promise<ReelLookup> {
  const parsed = parseInstagramPermalink(input);
  if (!parsed) throw ApiError.badRequest('That does not look like an Instagram reel address.');

  await assertEmbeddable(parsed.permalink);

  const page = await fetchEmbedPage(parsed.shortcode);
  const caption = page ? extractCaption(page) : undefined;
  const posterUrl = page ? extractPoster(page) : undefined;

  const result: ReelLookup = { permalink: parsed.permalink, shortcode: parsed.shortcode };
  if (caption) result.caption = caption;

  if (posterUrl) {
    const stored = await storePoster(posterUrl);
    if (stored) result.coverImageUrl = stored;
  }

  return result;
}

/**
 * Asks Meta whether this reel can be embedded at all.
 *
 * Worth the extra round trip: it separates "you typed the link wrong", "that
 * post is private" and "Instagram is down" into messages the admin can act on,
 * instead of one generic failure from a page that returns 200 either way.
 */
async function assertEmbeddable(permalink: string): Promise<void> {
  const url = `${OEMBED}?url=${encodeURIComponent(permalink)}&omitscript=true`;

  let response: Response;
  try {
    response = await request(url);
  } catch {
    throw ApiError.badRequest('Instagram could not be reached. Try again, or fill the form in by hand.');
  }

  if (response.ok) return;

  const body = (await response.json().catch(() => null)) as
    | { error?: { error_subcode?: number } }
    | null;

  // 2207045 — the post does not exist, or is not public.
  if (body?.error?.error_subcode === 2207045) {
    throw ApiError.badRequest(
      'Instagram will not show that reel. Check the link, and that the post is public rather than from a private account.',
    );
  }
  throw ApiError.badRequest('Instagram refused that request. Try again in a moment.');
}

/** The embed page. Returns null rather than throwing — a missing cover is a
 *  form the admin finishes by hand, not a failed request. */
async function fetchEmbedPage(shortcode: string): Promise<string | null> {
  try {
    const response = await request(
      `https://www.instagram.com/reel/${shortcode}/embed/captioned/`,
    );
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    logger.warn('Could not read the Instagram embed page', { shortcode, error: String(error) });
    return null;
  }
}

/**
 * Finds the poster frame.
 *
 * Three strategies, because this is scraped markup and Instagram rearranges it
 * without warning: the Open Graph tag Meta's own docs point at, then the JSON
 * blob the embed hydrates from, then the first CDN image on the page. If all
 * three miss, the admin uploads a cover — which is exactly what they did
 * before this existed.
 */
function extractPoster(html: string): string | undefined {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /"display_url"\s*:\s*"([^"]+)"/,
    /"thumbnail_src"\s*:\s*"([^"]+)"/,
    /<img[^>]+class=["'][^"']*EmbeddedMediaImage[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=["'](https:\/\/[^"']*(?:cdninstagram\.com|fbcdn\.net)[^"']*)["']/i,
  ];

  for (const pattern of patterns) {
    const found = pattern.exec(html)?.[1];
    if (!found) continue;

    // The JSON blobs escape their slashes and unicode.
    const decoded = found
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/')
      .replace(/&amp;/g, '&');

    if (isCdnUrl(decoded)) return decoded;
  }
  return undefined;
}

/** The caption sits in the `/captioned/` variant of the embed. */
function extractCaption(html: string): string | undefined {
  const block = /class=["'][^"']*Caption[^"']*["'][^>]*>([\s\S]{0,4000}?)<\/div>/i.exec(html)?.[1];
  const source = block ?? /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
  if (!source) return undefined;

  const text = source
    // The caption markup carries the author's name in its own anchor; the
    // caption proper is what follows it.
    .replace(/<a[^>]*class=["'][^"']*CaptionUsername[^"']*["'][\s\S]*?<\/a>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();

  if (!text) return undefined;
  // The model caps captions at 600; trim here so a long one prefills rather
  // than failing validation the moment the admin hits save.
  return text.length > 600 ? `${text.slice(0, 597).trimEnd()}…` : text;
}

const isCdnUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && CDN_HOSTS.test(url.hostname);
  } catch {
    return false;
  }
};

/**
 * Downloads the poster and files it as ordinary website artwork.
 *
 * The bytes go through the same signature check as an admin's own upload, so
 * whatever Instagram actually served, only a real JPEG, PNG or WebP is ever
 * written — and the size cap is enforced while reading rather than trusting
 * `Content-Length`.
 */
async function storePoster(posterUrl: string): Promise<string | undefined> {
  try {
    const response = await request(posterUrl);
    // A redirect that left the CDN is not a poster frame.
    if (!response.ok || !isCdnUrl(response.url || posterUrl) || !response.body) return undefined;

    const chunks: Buffer[] = [];
    let total = 0;
    const reader = response.body.getReader();

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_COVER_BYTES) {
        await reader.cancel();
        logger.warn('Instagram poster exceeded the size cap', { posterUrl });
        return undefined;
      }
      chunks.push(Buffer.from(value));
    }

    const buffer = Buffer.concat(chunks);
    const upload = verifyUpload(
      {
        buffer,
        size: buffer.byteLength,
        originalname: 'instagram-cover',
      } as Express.Multer.File,
      { imagesOnly: true },
    );

    const { url } = await savePublicImage(upload);
    return url;
  } catch (error) {
    logger.warn('Could not store the Instagram poster', { posterUrl, error: String(error) });
    return undefined;
  }
}

/** One fetch with a timeout and a consistent user agent. */
async function request(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}
