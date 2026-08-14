import { env } from '../../config/env';
import { Conversation, type ConversationDocument } from '../../models/Conversation';
import { logger } from '../../utils/logger';

/**
 * THE THREAD STORE, AND THE HANDOFF RULES.
 *
 * Two responsibilities that belong together because they are decided from the
 * same document: what the model is allowed to remember, and whether it is
 * allowed to speak at all.
 */

/** Kept per conversation. Older turns are dropped, oldest first. */
const HISTORY_LIMIT = env.WA_HISTORY_TURNS;

export async function getConversation(
  phoneNumberId: string,
  customerPhone: string,
  profileName?: string,
): Promise<ConversationDocument> {
  /**
   * Upsert rather than find-then-create: two messages arriving together would
   * otherwise both find nothing and both insert, and the unique index would
   * turn the loser into a failed reply.
   */
  const conversation = await Conversation.findOneAndUpdate(
    { phoneNumberId, customerPhone },
    {
      $setOnInsert: { phoneNumberId, customerPhone, history: [], aiPaused: false },
      ...(profileName ? { $set: { profileName } } : {}),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return conversation;
}

/**
 * Appends a turn and trims the history to the window.
 *
 * `$slice` on the push does the trimming inside the write, so the document can
 * never grow past the cap even if two turns land at once — and the model's
 * context stays a predictable size, which is what keeps replies fast and the
 * bill flat.
 */
export async function appendTurn(
  conversation: ConversationDocument,
  role: 'user' | 'model',
  text: string,
): Promise<ConversationDocument> {
  const updated = await Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $push: {
        history: {
          $each: [{ role, text: text.slice(0, 4200), at: new Date() }],
          $slice: -HISTORY_LIMIT,
        },
      },
      $set: { lastMessageAt: new Date() },
    },
    { new: true },
  );
  // The written document is returned so the caller can read the trimmed history
  // back without a second query — and sees exactly what was stored.
  return updated ?? conversation;
}

/** Records what a turn cost, so per-number AI spend is a query. */
export async function recordUsage(
  conversation: ConversationDocument,
  tokens: number,
): Promise<void> {
  await Conversation.updateOne(
    { _id: conversation._id },
    { $inc: { aiReplyCount: 1, totalTokens: tokens } },
  );
}

// ---------------------------------------------------------------------------
// Human handoff
// ---------------------------------------------------------------------------

/**
 * Whether the AI should stay out of this thread.
 *
 * A lapsed pause is cleared here rather than swept on a timer: the only moment
 * it matters is the moment a message arrives, and clearing it then means there
 * is no background job to forget to run.
 */
export async function isAiPaused(conversation: ConversationDocument): Promise<boolean> {
  if (!conversation.aiPaused) return false;

  // No expiry means an indefinite hold — `/ai off`. Only a person ends it.
  if (!conversation.pausedUntil) return true;

  if (conversation.pausedUntil.getTime() > Date.now()) return true;

  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { aiPaused: false }, $unset: { pausedUntil: 1 } },
  );
  conversation.aiPaused = false;
  conversation.pausedUntil = undefined;
  logger.info('WhatsApp: handoff window lapsed, AI resumed', {
    customerPhone: conversation.customerPhone,
  });
  return false;
}

/**
 * Steps the AI aside because a human has replied.
 *
 * `indefinite` is the `/ai off` case. The timed version is the ordinary one: a
 * staff member answers from their phone, the bot goes quiet behind them, and it
 * comes back on its own half an hour later — nobody has to remember to switch
 * it back on.
 */
export async function pauseAi(
  phoneNumberId: string,
  customerPhone: string,
  options: { indefinite?: boolean } = {},
): Promise<void> {
  const until = options.indefinite
    ? undefined
    : new Date(Date.now() + env.WA_HANDOFF_MINUTES * 60_000);

  await Conversation.findOneAndUpdate(
    { phoneNumberId, customerPhone },
    {
      $setOnInsert: { phoneNumberId, customerPhone, history: [] },
      $set: { aiPaused: true, lastMessageAt: new Date(), ...(until ? { pausedUntil: until } : {}) },
      ...(until ? {} : { $unset: { pausedUntil: 1 } }),
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  logger.info('WhatsApp: staff took over, AI paused', {
    customerPhone,
    until: until?.toISOString() ?? 'indefinitely',
  });
}

export async function resumeAi(phoneNumberId: string, customerPhone: string): Promise<void> {
  await Conversation.updateOne(
    { phoneNumberId, customerPhone },
    { $set: { aiPaused: false }, $unset: { pausedUntil: 1 } },
  );
  logger.info('WhatsApp: staff handed the thread back to the AI', { customerPhone });
}
