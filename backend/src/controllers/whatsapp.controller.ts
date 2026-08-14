import type { Request, Response } from 'express';
import { env } from '../config/env';
import { processWebhook } from '../services/whatsapp/assistant';
import { verifySignature } from '../services/whatsapp/cloudApi';
import { logger } from '../utils/logger';

/**
 * META'S TWO CALLS.
 *
 * These are the only routes in the API that are not ours to shape: the response
 * codes, the query-string names and the header are Meta's, and deviating from
 * them means the webhook silently stops being delivered.
 */

/** The raw request body, kept by the parser so the signature can be checked. */
interface SignedRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Webhook verification. Meta calls this once when the URL is saved, and again
 * whenever it is changed.
 *
 * The challenge must come back as bare text — a JSON envelope, which every
 * other endpoint here uses, fails verification with no useful message.
 */
export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WA_VERIFY_TOKEN) {
    logger.info('WhatsApp: webhook verified by Meta');
    res.status(200).type('text/plain').send(String(challenge ?? ''));
    return;
  }

  logger.warn('WhatsApp: webhook verification rejected', { mode, token });
  res.sendStatus(403);
}

/**
 * Incoming events.
 *
 * Answered before any work begins. Meta gives a webhook 20 seconds and retries
 * anything slower — and a retry that arrives while the first call is still
 * thinking is how a bot ends up replying twice. So: acknowledge, then think.
 *
 * The processing promise is deliberately not awaited. Its failures are handled
 * inside `processWebhook`, and `.catch` here is the backstop that keeps an
 * unhandled rejection from reaching the process.
 */
export function receiveWebhook(req: SignedRequest, res: Response): void {
  if (!verifySignature(req.rawBody, req.get('x-hub-signature-256'))) {
    logger.warn('WhatsApp: rejected a webhook with a bad signature');
    res.sendStatus(403);
    return;
  }

  res.sendStatus(200);

  void processWebhook(req.body).catch((error) =>
    logger.error('WhatsApp: webhook processing failed', error),
  );
}
