/* eslint-disable no-console */
import webpush from 'web-push';

/**
 * Prints a fresh VAPID key pair for `.env`.
 *
 * Run once per deployment and keep the pair stable: the public key is baked
 * into every browser subscription already handed out, so rotating it silently
 * invalidates every device that has already enabled notifications.
 */
const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Add these to backend/.env — keep the private key secret and never commit it.

VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:you@example.com

Restart the server afterwards, then turn notifications on from Admin → Settings.
`);
