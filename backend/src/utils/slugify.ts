/**
 * URL-safe slug. Diacritics are folded so names like "COâ‚‚" or accented words
 * still produce a clean, stable slug.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Appends `-2`, `-3`, … until the slug is unique among `taken`. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = slugify(base) || 'item';
  if (!taken.has(root)) return root;
  let suffix = 2;
  while (taken.has(`${root}-${suffix}`)) suffix += 1;
  return `${root}-${suffix}`;
}
