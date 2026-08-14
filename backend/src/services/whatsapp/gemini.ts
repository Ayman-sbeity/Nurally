import { env } from '../../config/env';

/**
 * GOOGLE GEMINI — REST, function calling, one round trip per turn.
 *
 * The generative-language endpoint is a single POST with a JSON body, so it is
 * called directly rather than through the SDK. That keeps the dependency list
 * where it is and, more usefully, keeps the exact request shape visible: when
 * the model answers oddly, the thing to read is right here.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * A customer watching two ticks will not wait longer than this, and Meta's own
 * webhook budget is 20 seconds. Flash normally answers in one or two.
 */
const TIMEOUT_MS = 12_000;

/** Schema subset Gemini accepts for a tool parameter. */
interface ParameterSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  description?: string;
  properties?: Record<string, ParameterSchema>;
  required?: string[];
  items?: ParameterSchema;
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: ParameterSchema;
}

export interface GeminiCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * One entry in the model's view of the conversation. Wider than what is
 * persisted: a turn may carry a tool call or its result, which live only for
 * the duration of a single reply and are never written to history.
 */
export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | { functionCall: GeminiCall }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface GeminiTurn {
  /** The reply text, if the model produced any this turn. */
  text: string;
  /** Tools the model wants run before it can answer. */
  calls: GeminiCall[];
  /** Raw model content, to be echoed back when returning tool results. */
  content: GeminiContent | undefined;
  tokens: number;
}

export function userText(text: string): GeminiContent {
  return { role: 'user', parts: [{ text }] };
}

export function modelText(text: string): GeminiContent {
  return { role: 'model', parts: [{ text }] };
}

/**
 * A tool's result on its way back to the model.
 *
 * Sent with role `user` — counter-intuitive, but it is what the API expects:
 * the tool result is an input to the model, not something the model said.
 */
export function functionResult(name: string, response: Record<string, unknown>): GeminiContent {
  return { role: 'user', parts: [{ functionResponse: { name, response } }] };
}

interface GenerateOptions {
  systemInstruction: string;
  contents: GeminiContent[];
  tools: FunctionDeclaration[];
}

/**
 * One call to the model.
 *
 * Returns whatever came back — text, tool calls, or both — without deciding
 * what to do about it. The tool loop lives in the assistant, where the tools do.
 */
export async function generate(options: GenerateOptions): Promise<GeminiTurn> {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${ENDPOINT}/${env.GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: options.systemInstruction }] },
          contents: options.contents,
          ...(options.tools.length
            ? { tools: [{ functionDeclarations: options.tools }] }
            : {}),
          generationConfig: {
            // Low, not zero: this is a service desk, and the same question asked
            // twice should not read like a form letter — but nothing here calls
            // for invention.
            temperature: 0.3,
            topP: 0.9,
            // A WhatsApp reply is a few sentences. The cap is a backstop against
            // an essay, not the thing that makes replies short — the prompt is.
            maxOutputTokens: 500,
          },
        }),
        signal: controller.signal,
      },
    );

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const error = payload.error as { message?: string; status?: string } | undefined;
      throw new Error(
        `Gemini ${response.status}: ${error?.message ?? 'unknown error'}${
          error?.status ? ` (${error.status})` : ''
        }`,
      );
    }

    const candidate = (payload.candidates as { content?: GeminiContent }[] | undefined)?.[0];
    const parts = candidate?.content?.parts ?? [];
    const usage = payload.usageMetadata as { totalTokenCount?: number } | undefined;

    return {
      text: parts
        .map((part) => ('text' in part ? part.text : ''))
        .join('')
        .trim(),
      calls: parts.flatMap((part) => ('functionCall' in part ? [part.functionCall] : [])),
      content: candidate?.content,
      tokens: usage?.totalTokenCount ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
