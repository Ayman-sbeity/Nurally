import { env } from '../../config/env';
import { BusinessProfile, type BusinessProfileDocument } from '../../models/BusinessProfile';
import { WhatsAppMessageLog } from '../../models/WhatsAppMessageLog';
import { logger } from '../../utils/logger';
import { markRead, sendText, type WhatsAppTarget } from './cloudApi';
import {
  appendTurn,
  getConversation,
  isAiPaused,
  pauseAi,
  recordUsage,
  resumeAi,
} from './conversation';
import {
  functionResult,
  generate,
  userText,
  type GeminiContent,
} from './gemini';
import { buildSystemPrompt } from './prompt';
import { TOOL_DECLARATIONS, runTool } from './tools';

/**
 * THE ASSISTANT ITSELF — everything that happens after Meta's `200`.
 *
 * The order of operations here is the design. Deduplicate before anything, so a
 * retried webhook cannot answer twice. Read the receipt before thinking, so the
 * customer sees movement. Check the handoff before generating, so a staff
 * member typing on their phone is never talked over. And wrap the whole thing,
 * so a Gemini outage produces an apology rather than silence.
 */

/** Sent when generation fails. Honest, brief, and promises a human. */
const FALLBACK_REPLY =
  'Sorry — I am having a technical hiccup right now. A member of the team will follow up with you shortly.';

/** Sent for a photo, voice note or document: we cannot read those. */
const UNSUPPORTED_REPLY =
  'I can only read text messages here. Could you type your question, and I will help right away?';

/** Commands staff can type into a customer thread from the WhatsApp app. */
const RESUME_COMMANDS = ['/resume', '/ai on'];
const PAUSE_COMMANDS = ['/ai off', '/pause'];

/** Model turns allowed per message: call a tool, read the result, answer. */
const MAX_TOOL_ROUNDS = 3;

// ---------------------------------------------------------------------------
// Per-customer rate limiting
// ---------------------------------------------------------------------------

/**
 * A sliding window per phone number, held in memory.
 *
 * In memory on purpose: this guards our Gemini bill against one person holding
 * the send key, and the cost of getting it slightly wrong across two processes
 * is a couple of extra replies — not worth a round trip to Mongo on the hot
 * path. Per-instance is also per-process, so it resets on deploy, which is
 * fine for the same reason.
 */
const recentCalls = new Map<string, number[]>();

function withinRateLimit(customerPhone: string): boolean {
  const now = Date.now();
  const window = (recentCalls.get(customerPhone) ?? []).filter((at) => now - at < 60_000);

  if (window.length >= env.WA_RATE_LIMIT_PER_MINUTE) {
    recentCalls.set(customerPhone, window);
    return false;
  }

  window.push(now);
  recentCalls.set(customerPhone, window);

  // The map would otherwise keep an entry per number that has ever written.
  if (recentCalls.size > 5000) {
    for (const [phone, calls] of recentCalls) {
      if (calls.every((at) => now - at >= 60_000)) recentCalls.delete(phone);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Webhook payload shapes (only the fields used)
// ---------------------------------------------------------------------------

interface InboundMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
}

interface EchoMessage extends InboundMessage {
  to?: string;
}

interface StatusUpdate {
  id?: string;
  recipient_id?: string;
}

interface ChangeValue {
  metadata?: { phone_number_id?: string };
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: InboundMessage[];
  message_echoes?: EchoMessage[];
  statuses?: StatusUpdate[];
}

interface WebhookPayload {
  entry?: { changes?: { field?: string; value?: ChangeValue }[] }[];
}

/** The words in a message, whatever kind of message it is. Empty if unreadable. */
function readText(message: InboundMessage): string {
  return (
    message.text?.body ??
    message.button?.text ??
    message.interactive?.button_reply?.title ??
    message.interactive?.list_reply?.title ??
    ''
  ).trim();
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Claims a message id. `false` means someone already has it.
 *
 * The unique index is the lock: whichever insert reaches Mongo first wins, and
 * the duplicate-key error the loser gets is the answer, not a failure. This is
 * what makes the webhook safe to retry, and safe to run on two instances.
 */
async function claimMessage(
  messageId: string,
  direction: 'IN' | 'OUT',
  phoneNumberId: string,
  customerPhone: string,
): Promise<boolean> {
  try {
    await WhatsAppMessageLog.create({ messageId, direction, phoneNumberId, customerPhone });
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }
}

/**
 * Was this outgoing message sent by us, or typed by a person?
 *
 * Checked twice. Meta can deliver the echo of a message we just sent before the
 * `POST /messages` response has been written to the ledger, and treating our own
 * reply as a staff takeover would mute the bot for half an hour every time it
 * spoke. The second look costs three quarters of a second on the genuine
 * staff-reply path, where nothing is waiting on it.
 */
async function wasSentByUs(messageId: string): Promise<boolean> {
  if (await WhatsAppMessageLog.exists({ messageId, direction: 'OUT' })) return true;
  await new Promise((resolve) => setTimeout(resolve, 750));
  return (await WhatsAppMessageLog.exists({ messageId, direction: 'OUT' })) !== null;
}

// ---------------------------------------------------------------------------
// Profile lookup
// ---------------------------------------------------------------------------

async function loadProfile(phoneNumberId: string): Promise<BusinessProfileDocument | null> {
  // `+accessToken` because it is `select: false` — a per-client token is a
  // credential, and this is the one place that legitimately needs it.
  const profile = await BusinessProfile.findOne({ phoneNumberId, isActive: true }).select(
    '+accessToken',
  );
  if (!profile) {
    logger.warn('WhatsApp: no business profile for this number', { phoneNumberId });
  }
  return profile;
}

function targetFor(profile: BusinessProfileDocument): WhatsAppTarget {
  return {
    phoneNumberId: profile.phoneNumberId,
    ...(profile.accessToken ? { accessToken: profile.accessToken } : {}),
  };
}

// ---------------------------------------------------------------------------
// Generating a reply
// ---------------------------------------------------------------------------

/**
 * Runs the model to a final answer, executing whatever tools it asks for along
 * the way.
 *
 * The loop is bounded. A model that keeps calling tools instead of answering is
 * misbehaving, and three rounds is more than a booking needs — check the day,
 * book the slot, speak.
 */
async function generateReply(
  profile: BusinessProfileDocument,
  history: GeminiContent[],
  customerPhone: string,
): Promise<{ text: string; tokens: number; toolsUsed: string[] }> {
  const systemInstruction = buildSystemPrompt(profile);
  const contents = [...history];
  const toolsUsed: string[] = [];
  let tokens = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const turn = await generate({ systemInstruction, contents, tools: TOOL_DECLARATIONS });
    tokens += turn.tokens;

    if (turn.calls.length === 0 || !turn.content) {
      return { text: turn.text, tokens, toolsUsed };
    }

    // The model's own turn has to go back verbatim, or the tool results below
    // have nothing to attach to.
    contents.push(turn.content);

    for (const call of turn.calls) {
      toolsUsed.push(call.name);
      const result = await runTool(call.name, call.args ?? {}, { customerPhone });
      logger.info('WhatsApp: tool call', { tool: call.name, args: call.args, ok: result.ok });
      contents.push(functionResult(call.name, result));
    }
  }

  // Out of rounds with nothing said. Better a human than a stuck bot.
  logger.warn('WhatsApp: tool loop exhausted without a reply', { customerPhone });
  return { text: FALLBACK_REPLY, tokens, toolsUsed };
}

/** Sends a reply and records its id, so the status webhook knows it was ours. */
async function reply(
  profile: BusinessProfileDocument,
  customerPhone: string,
  text: string,
): Promise<void> {
  const { messageId } = await sendText(targetFor(profile), customerPhone, text);
  if (messageId) {
    await claimMessage(messageId, 'OUT', profile.phoneNumberId, customerPhone).catch(() => {
      // A ledger write that fails costs us the ability to tell this message
      // from a staff one later — a spurious pause at worst. Never the reply.
    });
  }
}

// ---------------------------------------------------------------------------
// Inbound customer message
// ---------------------------------------------------------------------------

async function handleCustomerMessage(
  phoneNumberId: string,
  message: InboundMessage,
  profileName: string | undefined,
): Promise<void> {
  const customerPhone = message.from;
  const messageId = message.id;
  if (!customerPhone || !messageId) return;

  if (!(await claimMessage(messageId, 'IN', phoneNumberId, customerPhone))) {
    logger.debug('WhatsApp: duplicate webhook ignored', { messageId });
    return;
  }

  const profile = await loadProfile(phoneNumberId);
  if (!profile) return;

  // Two ticks turn blue now rather than after the model has finished thinking.
  await markRead(targetFor(profile), messageId);

  const conversation = await getConversation(phoneNumberId, customerPhone, profileName);
  const text = readText(message);

  if (!text) {
    // A photo or voice note. Recorded as a turn so the thread still reads in
    // order, but there is nothing for the model to work with.
    await appendTurn(conversation, 'user', `[${message.type ?? 'unsupported'} message]`);
    if (!(await isAiPaused(conversation))) {
      await reply(profile, customerPhone, UNSUPPORTED_REPLY);
    }
    return;
  }

  const thread = await appendTurn(conversation, 'user', text);

  if (await isAiPaused(thread)) {
    logger.info('WhatsApp: message stored, AI is paused for this thread', { customerPhone });
    return;
  }

  if (!withinRateLimit(customerPhone)) {
    logger.warn('WhatsApp: customer rate limited', { customerPhone });
    return;
  }

  const started = Date.now();
  try {
    /**
     * The stored history, not a locally assembled one: the model sees exactly
     * what the database holds — trimmed to the window, in order, ending with
     * the message being answered.
     */
    const stored = thread.history.map<GeminiContent>((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }));

    /**
     * Trimming the window can leave the history starting on a model turn — the
     * customer's opening message falls off while the reply to it survives — and
     * Gemini rejects a conversation that does not begin with the user. Dropping
     * the orphaned replies costs a little context and never costs the request.
     */
    const firstUser = stored.findIndex((entry) => entry.role === 'user');
    const contents = firstUser === -1 ? [] : stored.slice(firstUser);
    // Defensive: an empty history would leave the model nothing to answer.
    if (contents.length === 0) contents.push(userText(text));

    const { text: answer, tokens, toolsUsed } = await generateReply(
      profile,
      contents,
      customerPhone,
    );

    const outgoing = answer || FALLBACK_REPLY;
    await reply(profile, customerPhone, outgoing);
    await appendTurn(thread, 'model', outgoing);
    await recordUsage(thread, tokens);

    logger.info('WhatsApp AI turn', {
      phoneNumberId,
      customerPhone,
      tokens,
      tools: toolsUsed,
      ms: Date.now() - started,
    });
  } catch (error) {
    // The customer is mid-conversation and owed an answer either way.
    logger.error('WhatsApp AI turn failed', {
      phoneNumberId,
      customerPhone,
      message: (error as Error).message,
    });
    await reply(profile, customerPhone, FALLBACK_REPLY)
      // Recorded like any other reply: a transcript that omits the apology
      // reads as though the bot ignored the customer, which is the opposite of
      // what happened and the wrong thing to show a client asking about it.
      .then(() => appendTurn(thread, 'model', FALLBACK_REPLY))
      .catch((sendError) => logger.error('WhatsApp: fallback reply also failed', sendError));
  }
}

// ---------------------------------------------------------------------------
// Staff replying by hand
// ---------------------------------------------------------------------------

/**
 * An echo of a message sent from the business number.
 *
 * This is the richer of the two handoff signals — it carries the text, so the
 * `/resume` and `/ai off` commands are readable. It only arrives if the Meta
 * app is subscribed to `message_echoes`; without it the status path below still
 * catches the takeover, just without the commands.
 */
async function handleEcho(phoneNumberId: string, echo: EchoMessage): Promise<void> {
  const customerPhone = echo.to;
  if (!customerPhone) return;

  // Our own sends echo back too, and the bot pausing itself would be a bot
  // that answers once and never again.
  if (echo.id && (await wasSentByUs(echo.id))) return;

  const text = readText(echo).toLowerCase();

  if (RESUME_COMMANDS.includes(text)) {
    await resumeAi(phoneNumberId, customerPhone);
    return;
  }
  if (PAUSE_COMMANDS.includes(text)) {
    await pauseAi(phoneNumberId, customerPhone, { indefinite: true });
    return;
  }

  await pauseAi(phoneNumberId, customerPhone);
}

/**
 * A delivery status for a message the business sent.
 *
 * Statuses carry no text, only an id — so the whole question is whether we
 * recognise it. An id absent from our outbound ledger was typed by a person in
 * the WhatsApp Business app, which is the takeover signal.
 */
async function handleStatus(phoneNumberId: string, status: StatusUpdate): Promise<void> {
  const customerPhone = status.recipient_id;
  if (!customerPhone || !status.id) return;
  if (await wasSentByUs(status.id)) return;

  // Statuses repeat (sent → delivered → read) for the same message, so claim
  // the id: only the first one pauses, and the rest fall out here.
  if (!(await claimMessage(status.id, 'OUT', phoneNumberId, customerPhone))) return;

  await pauseAi(phoneNumberId, customerPhone);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Processes one webhook delivery, after the route has already answered Meta.
 *
 * Nothing in here may throw: the HTTP response is long gone, so an escaping
 * error would be an unhandled rejection rather than a 500. Each unit is
 * isolated so one bad message cannot take its neighbours down with it.
 */
export async function processWebhook(payload: unknown): Promise<void> {
  const body = payload as WebhookPayload;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!value || !phoneNumberId) continue;

      // Meta sends one contact per message, in the same order.
      const profileName = value.contacts?.[0]?.profile?.name;

      for (const message of value.messages ?? []) {
        await handleCustomerMessage(phoneNumberId, message, profileName).catch((error) =>
          logger.error('WhatsApp: failed to handle an incoming message', error),
        );
      }

      for (const echo of value.message_echoes ?? []) {
        await handleEcho(phoneNumberId, echo).catch((error) =>
          logger.error('WhatsApp: failed to handle an outgoing echo', error),
        );
      }

      for (const status of value.statuses ?? []) {
        await handleStatus(phoneNumberId, status).catch((error) =>
          logger.error('WhatsApp: failed to handle a delivery status', error),
        );
      }
    }
  }
}
