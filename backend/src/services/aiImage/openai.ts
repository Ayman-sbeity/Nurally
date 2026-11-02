import { env } from '../../config/env';
import { ApiError, ErrorCode } from '../../utils/ApiError';
import { logger } from '../../utils/logger';

const ENDPOINT = 'https://api.openai.com/v1/images/generations';

/**
 * Generating one image takes tens of seconds. Past this the request is
 * abandoned rather than holding the admin's browser open indefinitely; it
 * sits under the three minutes the admin's own request waits.
 */
const TIMEOUT_MS = 170_000;

interface OpenAiError {
  message?: string;
  code?: string | null;
}

interface GenerationResponse {
  data?: { b64_json?: string }[];
  error?: OpenAiError;
}

/**
 * Asks OpenAI's image model for one picture and returns its bytes.
 *
 * WebP is requested directly: it arrives already web-sized, so it can be
 * stored as delivered instead of being decoded and compressed a second time.
 * Failures are translated into messages an admin can act on — the key, the
 * account's credit, or the wording of the description — never OpenAI's raw
 * error alone.
 */
export async function generateImage(prompt: string): Promise<Buffer> {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError(
      503,
      ErrorCode.UPSTREAM_ERROR,
      'AI images are not set up. Add OPENAI_API_KEY to the server configuration.',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_IMAGE_MODEL,
        prompt,
        size: env.OPENAI_IMAGE_SIZE,
        quality: env.OPENAI_IMAGE_QUALITY,
        n: 1,
        output_format: 'webp',
        output_compression: 85,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as GenerationResponse;
    if (!response.ok) throw refusal(response.status, payload.error);

    const encoded = payload.data?.[0]?.b64_json;
    if (!encoded) {
      throw new ApiError(502, ErrorCode.UPSTREAM_ERROR, 'OpenAI returned no image. Please try again.');
    }
    return Buffer.from(encoded, 'base64');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw new ApiError(504, ErrorCode.UPSTREAM_ERROR, 'OpenAI took too long to create the image. Please try again.');
    }
    logger.error('OpenAI image request failed', { message: (error as Error).message });
    throw new ApiError(502, ErrorCode.UPSTREAM_ERROR, 'OpenAI could not be reached. Please try again in a moment.');
  } finally {
    clearTimeout(timer);
  }
}

function refusal(status: number, error: OpenAiError | undefined): ApiError {
  logger.warn('OpenAI refused an image request', { status, code: error?.code, message: error?.message });

  if (error?.code === 'moderation_blocked' || /safety|moderation/i.test(error?.message ?? '')) {
    return ApiError.badRequest(
      'OpenAI declined this description. Describe the scene a little differently — less clinical detail usually helps — and try again.',
    );
  }
  if (status === 401) {
    return new ApiError(503, ErrorCode.UPSTREAM_ERROR, 'OpenAI rejected the API key. Check OPENAI_API_KEY on the server.');
  }
  if (status === 429) {
    return new ApiError(
      429,
      ErrorCode.RATE_LIMITED,
      'OpenAI is busy, or the OpenAI account has run out of credit. Wait a minute, or check billing at platform.openai.com.',
    );
  }
  // A wrong model name or an unsupported size lands here; the admin is the
  // one who can fix the configuration, so OpenAI's own words are passed on.
  return new ApiError(
    502,
    ErrorCode.UPSTREAM_ERROR,
    `OpenAI could not create the image${error?.message ? `: ${error.message}` : '.'}`,
  );
}
