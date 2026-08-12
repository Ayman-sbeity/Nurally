import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * A browser's Web Push endpoint, as handed to us by `PushManager.subscribe()`.
 *
 * One row per device, not per user: the lounge owner may have the admin open on
 * a phone and a laptop, and both should ring. The endpoint URL is the identity
 * — it is unique per browser installation and is what the push service routes
 * on — so it carries the unique index and an upsert on it keeps a
 * re-subscribing browser from accumulating duplicates.
 *
 * `keys` are the browser's own public key material, used to encrypt each
 * payload so the push service (Google/Apple/Mozilla) relays ciphertext it
 * cannot read.
 */
export interface PushSubscriptionAttrs {
  user: Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  /** Kept for the "your devices" list, so a user can tell them apart. */
  userAgent?: string;
  lastSuccessAt?: Date;
}

export type PushSubscriptionDocument = HydratedDocument<PushSubscriptionAttrs>;

const pushSubscriptionSchema = new Schema<PushSubscriptionAttrs>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, maxlength: 300 },
    lastSuccessAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

export const PushSubscription = model<PushSubscriptionAttrs>(
  'PushSubscription',
  pushSubscriptionSchema,
);
