/**
 * Build-time half of the GEO work.
 *
 * Loads the same JSON content and the same resolver the React app uses
 * (`src/lib/geo.js`), so `robots.txt`, `sitemap.xml`, `llms.txt` and the
 * pre-rendered HTML state exactly what the pages state. Nothing here invents a
 * fact: the catalogue comes from the live API when it is reachable, and every
 * unconfigured business detail is simply left out.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBusiness, resolveFaq, absoluteUrl } from '../../src/lib/geo.js';

export const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* -------------------------------------------------------------------------- */
/* Environment                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Reads the `.env` files Vite would read, in Vite's own precedence order, then
 * lets real environment variables win — so a CI/CD pipeline can supply the
 * production site URL and contact details without editing a file.
 */
export function loadEnv(mode = process.env.NODE_ENV || 'production') {
  /** @type {Record<string, string>} */
  const env = {};

  for (const file of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    const path = resolve(frontendRoot, file);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
      env[match[1]] = value;
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('VITE_') && value) env[key] = value;
  }

  return env;
}

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(frontendRoot, relativePath), 'utf8'));

export function loadGeoContent(env = loadEnv()) {
  const businessJson = readJson('src/content/geo/business.json');
  const faqJson = readJson('src/content/geo/faq.json');
  const treatmentsJson = readJson('src/content/geo/treatments.json');

  const facts = resolveBusiness(businessJson, env);
  return {
    facts,
    faq: resolveFaq(faqJson, facts),
    faqSections: faqJson.sections,
    treatments: treatmentsJson.categories,
  };
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The live treatment menu, or `null` when the API is not reachable.
 *
 * Never fatal: a developer building the frontend without the API running still
 * gets a correct (category-level) `llms.txt` and pre-render, just without the
 * per-treatment pages. Point `GEO_API_URL` at the API to include them.
 */
export async function fetchCatalogue({ timeoutMs = 5000 } = {}) {
  const base = (process.env.GEO_API_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${base}/services`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const categories = payload?.data?.categories;
    if (!Array.isArray(categories)) throw new Error('unexpected response shape');
    return categories;
  } catch (error) {
    console.warn(
      `  ! Treatment catalogue unavailable at ${base}/services (${error.message}). ` +
        'Falling back to category-level content only.',
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

/** Public, indexable routes. Everything under /app, /admin and /login is not. */
export function publicRoutes(facts, categories) {
  const routes = [
    { path: '/', changefreq: 'monthly', priority: '1.0' },
    { path: '/services', changefreq: 'monthly', priority: '0.9' },
    { path: '/faq', changefreq: 'monthly', priority: '0.8' },
    { path: '/about', changefreq: 'yearly', priority: '0.7' },
    { path: '/gallery', changefreq: 'monthly', priority: '0.6' },
  ];

  for (const category of categories ?? []) {
    for (const service of category.services ?? []) {
      routes.push({ path: `/services/${service.slug}`, changefreq: 'monthly', priority: '0.7' });
    }
  }

  return routes.map((route) => ({ ...route, url: absoluteUrl(facts.siteUrl, route.path) }));
}

/** Escapes text for insertion into HTML. */
export const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
