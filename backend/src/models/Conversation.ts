import { Schema, model, type HydratedDocument } from 'mongoose';
import { env } from '../config/env';
import { omitInternal } from './serialization';

/**
 * ONE WHATSAPP THREAD.
 *
 * Holds the rolling history the model is given as context, and the switch that
 * takes the AI out of the conversation when a human steps in.
 *
 * Scoped by `{ phoneNumberId, customerPhone }` rather than by phone number
 * alone: the same customer messaging two businesses on the platform must not
 * find one lounge's conversation continuing in the other's.
 */

export interface ConversationTurn {
  /** Gemini's own vocabulary — `model` is the assistant, not `assistant`. */
  role: 'user' | 'model';
  text: string;
  at: Date;
}

export interface ConversationAttrs {
  phoneNumberId: string;
  /** E.164 digits as Meta reports them, e.g. `96170303380`. No `+`. */
  customerPhone: string;
  /** The customer's WhatsApp display name, when Meta supplies one. */
  profileName?: string;

  history: ConversationTurn[];

  /**
   * True while a human is handling this thread. The AI reads it before every
   * reply and stays out; see `pausedUntil` for how it ends.
   */
  aiPaused: boolean;
  /**
   * When the pause lapses on its own. Absent means "until someone says
   * otherwise" — what `/ai off` sets, so a thread that needs a person is never
   * quietly handed back to the bot by a timer.
   */
  pausedUntil?: Date;

  /** Drives retention. Bumped on every message in either direction. */
  lastMessageAt: Date;
  /** Rolling totals, so per-client AI cost is a query rather than a guess. */
  aiReplyCount: number;
  totalTokens: number;
}

export type ConversationDocument = HydratedDocument<ConversationAttrs>;

const turnSchema = new Schema<ConversationTurn>(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    // Long enough for anything WhatsApp will deliver (4096 chars), so a wall of
    // text is truncated on the way in rather than rejected by the database.
    text: { type: String, required: true, maxlength: 4200 },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const conversationSchema = new Schema<ConversationAttrs>(
  {
    phoneNumberId: { type: String, required: true, index: true },
    customerPhone: { type: String, required: true, index: true },
    profileName: { type: String, trim: true, maxlength: 120 },

    history: { type: [turnSchema], default: [] },

    aiPaused: { type: Boolean, default: false },
    pausedUntil: { type: Date },

    lastMessageAt: { type: Date, required: true, default: () => new Date() },
    aiReplyCount: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => omitInternal(ret),
    },
  },
);

// One thread per customer per business number — and the lookup every inbound
// message performs.
conversationSchema.index({ phoneNumberId: 1, customerPhone: 1 }, { unique: true });

/**
 * Chat logs are personal data, so they expire rather than accumulate. Mongo's
 * TTL monitor deletes a conversation once it has been silent for the retention
 * window; a thread that stays in use keeps resetting the clock.
 */
conversationSchema.index(
  { lastMessageAt: 1 },
  { expireAfterSeconds: env.WA_HISTORY_RETENTION_DAYS * 24 * 60 * 60 },
);

export const Conversation = model<ConversationAttrs>('Conversation', conversationSchema);
