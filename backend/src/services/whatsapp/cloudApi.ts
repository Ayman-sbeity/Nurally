import crypto from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * META WHATSAPP CLOUD API — the only place that talks to Meta.
 *
 * Plain `fetch` rather than an SDK: three endpoints, a bearer token and a JSON
 * body. A dependency here would be more code to audit than the code it saves.
 */

const GRAPH = `https://graph.facebook.com/${env.WA_GRAPH_VERSION}`;

/** WhatsApp refuses anything longer, and truncating beats a failed send. */
const MAX_BODY = 4096;

/** Meta is quick or it is broken; a slow send would outlive its own webhook. */
const TIMEOUT_MS = 10_000;

export interface WhatsAppTarget {
  phoneNumberId: string;
  /** This number's own token, when it has one. Falls back to `WA_TOKEN`. */
  accessToken?: string;
}

interface SendResult {
  /** Meta's `wamid.…` for the message we just sent. */
  messageId?: string;
}

async function callGraph(
  target: WhatsAppTarget,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const token = target.accessToken ?? env.WA_TOKEN;
  if (!token) throw new Error('WhatsApp is not configured: no access token.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${GRAPH}/${target.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      // Meta's error object is the useful half of a failed send — it carries the
      // numeric code the troubleshooting table in the setup guide is keyed on.
      const error = payload.error as { message?: string; code?: number } | undefined;
      throw new Error(
        `WhatsApp API ${response.status}: ${error?.message ?? 'unknown error'}${
          error?.code ? ` (code ${error.code})` : ''
        }`,
      );
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends a plain text reply.
 *
 * Only valid inside the 24-hour window opened by the customer's last message —
 * which every call here satisfies, because the assistant only ever replies.
 * Anything the lounge initiates (an appointment reminder, say) must go through
 * an approved template instead; do not reach for this function for that.
 */
export async function sendText(
  target: WhatsAppTarget,
  to: string,
  text: string,
): Promise<SendResult> {
  const body = text.slice(0, MAX_BODY);
  const payload = await callGraph(target, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    // Link previews are noise in a service conversation and slow the render.
    text: { preview_url: false, body },
  });

  const messages = payload.messages as { id?: string }[] | undefined;
  return { messageId: messages?.[0]?.id };
}

/**
 * Marks the customer's message read and shows the typing bubble.
 *
 * Cosmetic, and deliberately best-effort: the reply matters, two blue ticks do
 * not. A failure here is logged at debug level and swallowed so it can never
 * cost the customer their answer. The typing indicator is a newer field, so on
 * an older Graph version this call simply marks the message read.
 */
export async function markRead(
  target: WhatsAppTarget,
  messageId: string,
): Promise<void> {
  try {
    await callGraph(target, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    });
  } catch (error) {
    logger.debug('WhatsApp read receipt failed', { message: (error as Error).message });
  }
}

/**
 * Confirms a webhook really came from Meta.
 *
 * The signature is an HMAC of the *raw* body — re-serialising the parsed JSON
 * would change key order and whitespace and never match, which is why the route
 * keeps the original buffer.
 *
 * Compared in constant time: a fast-exit comparison leaks, byte by byte, how
 * much of a guessed signature was right.
 */
export function verifySignature(rawBody: Buffer | undefined, header: string | undefined): boolean {
  if (!env.WA_APP_SECRET) return true; // unverified mode — the server warns at boot
  if (!rawBody || !header?.startsWith('sha256=')) return false;

  const expected = crypto
    .createHmac('sha256', env.WA_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  // Decoded rather than compared as text, so a header carrying anything that is
  // not hex is rejected on length instead of reaching `timingSafeEqual`, which
  // throws on a size mismatch.
  const received = Buffer.from(header.slice('sha256='.length), 'hex');
  const digest = Buffer.from(expected, 'hex');

  if (received.length !== digest.length) return false;
  return crypto.timingSafeEqual(received, digest);
}
