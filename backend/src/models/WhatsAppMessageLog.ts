import { Schema, model, type HydratedDocument } from 'mongoose';
import { omitInternal } from './serialization';

/**
 * THE LEDGER OF MESSAGE IDS. Two jobs, one collection.
 *
 * 1. **Deduplication.** Meta retries any webhook it thinks failed, and a retry
 *    that reaches a healthy server produces a second reply to a message the
 *    customer sent once. The unique index on `messageId` is what makes
 *    processing idempotent: the insert either wins or throws, and only the
 *    winner answers.
 *
 * 2. **Telling our own outgoing messages apart from staff's.** Meta reports a
 *    delivery status for every message the business sends — including the ones
 *    a staff member types by hand in the WhatsApp Business app. A status for an
 *    id that is not in here was therefore not sent by us, which is exactly the
 *    signal that a human has joined the conversation.
 *
 * Rows are short-lived: retries arrive within minutes and statuses within
 * hours, so a fortnight is generous and keeps the collection small. The durable
 * record of what was said is `Conversation.history`, not this.
 */

const RETENTION_SECONDS = 14 * 24 * 60 * 60;

export interface WhatsAppMessageLogAttrs {
  /** Meta's `wamid.…`. Unique across both directions. */
  messageId: string;
  direction: 'IN' | 'OUT';
  phoneNumberId: string;
  customerPhone: string;
  createdAt: Date;
}

export type WhatsAppMessageLogDocument = HydratedDocument<WhatsAppMessageLogAttrs>;

const messageLogSchema = new Schema<WhatsAppMessageLogAttrs>(
  {
    messageId: { type: String, required: true, unique: true },
    direction: { type: String, enum: ['IN', 'OUT'], required: true },
    phoneNumberId: { type: String, required: true },
    customerPhone: { type: String, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    // `createdAt` is declared above so the TTL index below has a field it owns
    // outright; the automatic timestamp pair would add an unused `updatedAt`.
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => omitInternal(ret),
    },
  },
);

messageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

export const WhatsAppMessageLog = model<WhatsAppMessageLogAttrs>(
  'WhatsAppMessageLog',
  messageLogSchema,
);
