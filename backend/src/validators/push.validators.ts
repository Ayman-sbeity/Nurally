import { z } from 'zod';

/**
 * The browser hands us `PushSubscription.toJSON()` verbatim. We validate it
 * rather than trusting it: the endpoint is a URL we will later make requests
 * to, so it must be a real https URL and not, say, an internal address.
 */
const endpoint = z
  .string()
  .trim()
  .url('That is not a valid push endpoint.')
  .max(600)
  .refine((value) => value.startsWith('https://'), 'A push endpoint must be https.');

export const subscribePushSchema = z.object({
  endpoint,
  keys: z.object({
    p256dh: z.string().trim().min(1).max(200),
    auth: z.string().trim().min(1).max(200),
  }),
});

export const unsubscribePushSchema = z.object({
  endpoint,
});
