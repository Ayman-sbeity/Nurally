/**
 * Shared `toJSON` transform.
 *
 * Mongoose types the transform's `ret` argument as the raw document shape, so
 * the internal keys are non-optional and cannot be deleted directly. Narrowing
 * once here keeps every schema's transform to a single readable line and gives
 * one place to add a field that must never be serialised.
 */
export function omitInternal(ret: unknown, keys: readonly string[] = []): Record<string, unknown> {
  const output = ret as Record<string, unknown>;
  delete output.__v;
  for (const key of keys) delete output[key];
  return output;
}
