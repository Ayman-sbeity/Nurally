import type { Types } from 'mongoose';
import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { env } from '../config/env';
import { PushSubscription } from '../models/PushSubscription';
import { logger } from '../utils/logger';

/**
 * WEB PUSH DELIVERY
 * -----------------
 * Sends a real device notification — the phone rings even when the lounge has
 * the app closed, which an in-app inbox alone can never do.
 *
 * Delivery is best-effort by design: `sendToUser` never throws. A booking must
 * not fail because a push service was briefly unreachable, so callers fire it
 * alongside the in-app row rather than depending on it.
 */

if (env.pushEnabled) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY as string,
    env.VAPID_PRIVATE_KEY as string,
  );
} else {
  logger.warn('Web Push disabled: VAPID keys are not configured (run `npm run push:keys`)');
}

/** Ceiling on one push request, so a slow provider cannot hold up a booking. */
const PUSH_TIMEOUT_MS = 5_000;

export function isPushEnabled(): boolean {
  return env.pushEnabled;
}

export function getPublicKey(): string | null {
  return env.pushEnabled ? (env.VAPID_PUBLIC_KEY as string) : null;
}

/** The shape the browser's `PushSubscription.toJSON()` produces. */
export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Registers a device. Upserts on the endpoint so a browser that re-subscribes
 * (after a permission reset, or a rotated key) replaces its old row instead of
 * leaving a dead one behind that we would keep pushing to.
 *
 * Re-subscribing also re-homes the endpoint to the current user, which matters
 * on a shared device: whoever is signed in is who the notification is for.
 */
export async function saveSubscription(
  userId: Types.ObjectId,
  subscription: BrowserSubscription,
  userAgent?: string,
): Promise<void> {
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      $set: {
        user: userId,
        keys: subscription.keys,
        ...(userAgent ? { userAgent: userAgent.slice(0, 300) } : {}),
      },
    },
    { upsert: true, new: true },
  );
}

/** Unregisters one device. Scoped to the owner so nobody can unsubscribe another. */
export async function removeSubscription(
  userId: Types.ObjectId,
  endpoint: string,
): Promise<boolean> {
  const result = await PushSubscription.deleteOne({ user: userId, endpoint });
  return result.deletedCount > 0;
}

export async function countSubscriptions(userId: Types.ObjectId): Promise<number> {
  return PushSubscription.countDocuments({ user: userId });
}

export interface PushPayload {
  title: string;
  body: string;
  /** Path the service worker opens when the notification is tapped. */
  url?: string;
  /** Collapses replacing notifications about the same appointment. */
  tag?: string;
}

/**
 * Pushes to every device a user has registered.
 *
 * Returns how many endpoints accepted the message. A 404/410 means the
 * subscription is permanently gone (permission revoked, app uninstalled), so
 * the row is deleted — otherwise dead endpoints would pile up and every
 * notification would grow slower.
 */
export async function sendToUser(
  userId: Types.ObjectId,
  payload: PushPayload,
): Promise<number> {
  if (!env.pushEnabled) return 0;

  const subscriptions = await PushSubscription.find({ user: userId }).lean();
  if (subscriptions.length === 0) return 0;

  const body = JSON.stringify(payload);

  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      const target: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      };

      try {
        await webpush.sendNotification(target, body, {
          // Hold the message for a day: a phone that is off overnight still
          // gets the booking when it comes back.
          TTL: 60 * 60 * 24,
          // The booking request waits on this call, so an unreachable push
          // service must fail fast rather than stall the client's checkout.
          timeout: PUSH_TIMEOUT_MS,
        });
        await PushSubscription.updateOne(
          { _id: subscription._id },
          { $set: { lastSuccessAt: new Date() } },
        );
        return true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;

        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.deleteOne({ _id: subscription._id });
          logger.debug('Pruned expired push subscription', { endpoint: subscription.endpoint });
        } else {
          logger.warn('Push delivery failed', {
            statusCode,
            message: (error as Error).message,
          });
        }
        return false;
      }
    }),
  );

  return results.filter(Boolean).length;
}
