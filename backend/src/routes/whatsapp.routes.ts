import express, { Router, type Request } from 'express';
import { env } from '../config/env';
import { receiveWebhook, verifyWebhook } from '../controllers/whatsapp.controller';

/**
 * THE WHATSAPP WEBHOOK.
 *
 * Mounted outside the `/api` router in `app.ts`, ahead of both the global JSON
 * parser and the API rate limiter, for two reasons that are easy to lose:
 *
 *   1. Meta signs the *bytes* it sent. Re-serialising a parsed body changes key
 *      order and whitespace, and the signature never matches again — so this
 *      router parses its own body and keeps the original buffer.
 *   2. Meta retries whatever it cannot deliver. A 429 from the shared API
 *      limiter would turn a busy afternoon into duplicated replies.
 */

const router = Router();

/** Keeps the exact bytes Meta signed, for `verifySignature`. */
function captureRawBody(req: Request, _res: unknown, buffer: Buffer): void {
  (req as Request & { rawBody?: Buffer }).rawBody = buffer;
}

// Meta's payloads are small; a lower ceiling than the app's makes this endpoint
// a poor target for anyone who finds the URL.
router.use(express.json({ limit: '256kb', verify: captureRawBody }));

/**
 * Both routes 404 while the assistant is unconfigured. Answering Meta's
 * verification with a server that has no token to reply with would leave a
 * webhook subscribed to a number nothing is listening on.
 */
router.use((_req, res, next) => {
  if (!env.whatsappEnabled) {
    res.sendStatus(404);
    return;
  }
  next();
});

router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

export default router;
