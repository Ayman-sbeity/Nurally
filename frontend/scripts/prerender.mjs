/**
 * Pre-renders the public pages after `vite build`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Nurella's site is a client-rendered React SPA. Googlebot executes JavaScript;
 * most of the crawlers that feed AI assistants (GPTBot, ClaudeBot, CCBot,
 * PerplexityBot …) do not. Without this step every one of them sees an empty
 * `<div id="root">` and the site is invisible to the exact audience the GEO
 * work is aimed at.
 *
 * So for each public route this writes a real HTML file containing:
 *   - a route-specific <title>, description and canonical URL
 *   - the route's JSON-LD graph
 *   - a plain-text version of the page's facts, inside #root
 *
 * The fallback text lives *inside* `#root`, which React clears on its first
 * render — so a visitor with JavaScript sees the real app and never a stale
 * copy, and there is no hidden text and no divergence between what a crawler
 * reads and what a person reads.
 *
 *   node scripts/prerender.mjs
 *
 * Runs automatically at the end of `npm run build`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  aboutPageSchema,
  absoluteUrl,
  breadcrumbSchema,
  businessSchema,
  faqSchema,
  serviceListSchema,
  serviceSchema,
  webSiteSchema,
} from '../src/lib/geo.js';
import {
  escapeHtml,
  fetchCatalogue,
  frontendRoot,
  loadEnv,
  loadGeoContent,
} from './lib/geo-build.mjs';

const distDir = resolve(frontendRoot, 'dist');
const shellPath = resolve(distDir, 'index.html');

if (!existsSync(shellPath)) {
  console.error('  ! dist/index.html not found — run `vite build` first.');
  process.exit(1);
}

const env = loadEnv();
const { facts, faq, faqSections, treatments } = loadGeoContent(env);
const categories = await fetchCatalogue();
const shell = readFileSync(shellPath, 'utf8');

/* -------------------------------------------------------------------------- */
/* HTML helpers                                                               */
/* -------------------------------------------------------------------------- */

const tag = (name, value) => `<${name}>${escapeHtml(value)}</${name}>`;

/** Renders one content section of the crawlable fallback. */
function renderSection(section) {
  const parts = [];
  if (section.heading) parts.push(tag(section.level ?? 'h2', section.heading));
  for (const paragraph of section.paragraphs ?? []) parts.push(tag('p', paragraph));

  if (section.definitions?.length) {
    parts.push(
      `<dl>${section.definitions
        .map((entry) => `${tag('dt', entry.term)}${tag('dd', entry.detail)}`)
        .join('')}</dl>`,
    );
  }

  if (section.bullets?.length) {
    parts.push(`<ul>${section.bullets.map((item) => tag('li', item)).join('')}</ul>`);
  }

  if (section.links?.length) {
    parts.push(
      `<ul>${section.links
        .map(
          (link) =>
            `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>${
              link.detail ? ` — ${escapeHtml(link.detail)}` : ''
            }</li>`,
        )
        .join('')}</ul>`,
    );
  }

  for (const child of section.children ?? []) parts.push(renderSection(child));
  return parts.join('\n');
}

function renderFallback(route) {
  return [
    '<div id="geo-static" class="nu-container" style="padding:7rem 0 4rem">',
    tag('h1', route.h1 ?? route.title),
    tag('p', route.description),
    ...(route.sections ?? []).map(renderSection),
    '<nav aria-label="Site"><ul>',
    ...[
      { href: '/', label: 'Home' },
      { href: '/services', label: 'Treatments' },
      { href: '/faq', label: 'Frequently asked questions' },
      { href: '/about', label: `About ${facts.name}` },
      { href: '/gallery', label: 'Gallery' },
      { href: facts.bookingUrl, label: 'Book an appointment' },
    ].map((link) => `<li><a href="${link.href}">${escapeHtml(link.label)}</a></li>`),
    '</ul></nav>',
    '</div>',
  ].join('\n');
}

/** Swaps the route-specific head tags into the built shell. */
function renderHtml(route) {
  const canonical = absoluteUrl(facts.siteUrl, route.path);
  const jsonLd = (route.schemas ?? [])
    .filter(Boolean)
    .map(
      (schema) =>
        `<script type="application/ld+json" data-geo-static>${JSON.stringify(schema)}</script>`,
    )
    .join('\n    ');

  return shell
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(route.title)}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/?>/i,
      `<meta name="description" content="${escapeHtml(route.description)}" />`,
    )
    .replace(/<link\s+rel="canonical"[\s\S]*?\/?>/i, `<link rel="canonical" href="${canonical}" />`)
    .replace(
      /<meta\s+property="og:title"[\s\S]*?\/?>/i,
      `<meta property="og:title" content="${escapeHtml(route.title)}" />`,
    )
    .replace(
      /<meta\s+property="og:description"[\s\S]*?\/?>/i,
      `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
    )
    .replace(
      /<meta\s+property="og:url"[\s\S]*?\/?>/i,
      `<meta property="og:url" content="${canonical}" />`,
    )
    // The shell's placeholder graph is replaced wholesale by this route's.
    .replace(/\s*<script type="application\/ld\+json"[\s\S]*?<\/script>/gi, '')
    .replace('</head>', `  ${jsonLd}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${renderFallback(route)}</div>`);
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

const business = businessSchema(facts, { categories: categories ?? [] });
const website = webSiteSchema(facts);
const crumb = (...trail) => breadcrumbSchema(facts, [{ name: 'Home', path: '/' }, ...trail]);

const categoryLinks = (category) =>
  (category.services ?? []).map((service) => ({
    label: service.name,
    href: `/services/${service.slug}`,
    detail: service.description,
  }));

const categorySection = (category) => {
  const categoryFacts = treatments[category.slug] ?? {};
  return {
    heading: category.label,
    level: 'h3',
    paragraphs: [categoryFacts.whatItIs, categoryFacts.whoItIsFor].filter(Boolean),
    bullets: categoryFacts.addresses?.length
      ? [`Addresses: ${categoryFacts.addresses.join(', ')}`]
      : undefined,
    links: categoryLinks(category),
  };
};

const contactSection = {
  heading: 'Contact and booking',
  definitions: [
    { term: 'Business', detail: facts.name },
    facts.addressLine ? { term: 'Address', detail: facts.addressLine } : null,
    facts.telephone ? { term: 'Phone', detail: facts.telephone } : null,
    facts.email ? { term: 'Email', detail: facts.email } : null,
    facts.hoursLine ? { term: 'Opening hours', detail: facts.hoursLine } : null,
    { term: 'Instagram', detail: `@${facts.instagramHandle}` },
    { term: 'Booking', detail: 'Requested online and confirmed by the lounge.' },
    { term: 'Pricing', detail: facts.pricingPolicy },
  ].filter(Boolean),
};

/** @type {Array<Record<string, any>>} */
const routes = [
  {
    path: '/',
    title: 'Nurella Beauty Lounge — Advanced Aesthetics, Skin & Beauty',
    h1: facts.name,
    description:
      'Nurella Beauty Lounge offers facial aesthetics, collagen biostimulation, skin boosters, advanced skin treatments, laser, permanent makeup, facials and nails. Every treatment begins with a personalized consultation — request an appointment online.',
    schemas: [business, website],
    sections: [
      { heading: 'What Nurella Beauty Lounge is', paragraphs: facts.description },
      {
        heading: 'What we offer',
        paragraphs: [facts.summary],
        bullets: facts.specialties,
      },
      ...(categories ? [{ heading: 'Treatment menu', children: categories.map(categorySection) }] : []),
      { heading: 'How booking works', bullets: facts.bookingSteps },
      contactSection,
      {
        heading: 'Common questions',
        children: faq.slice(0, 6).map((entry) => ({
          heading: entry.question,
          level: 'h3',
          paragraphs: [entry.answer],
        })),
      },
    ],
  },
  {
    path: '/services',
    title: 'Treatments — Nurella Beauty Lounge',
    h1: 'Treatments at Nurella Beauty Lounge',
    description:
      'The full treatment menu at Nurella Beauty Lounge: facial aesthetics, collagen biostimulation, skin boosters and rejuvenation, advanced skin treatments, lifting and contouring, laser, skin care facials, permanent makeup and nails.',
    schemas: [
      categories ? serviceListSchema(facts, categories) : null,
      crumb({ name: 'Treatments', path: '/services' }),
    ],
    sections: [
      {
        heading: 'How treatments are chosen',
        paragraphs: [
          'Every treatment begins with a personalized consultation and a plan based on your features, skin needs and desired results.',
          facts.pricingPolicy,
        ],
      },
      ...(categories
        ? categories.map(categorySection)
        : [{ heading: 'Categories', bullets: Object.values(treatments).map((entry) => entry.whatItIs) }]),
    ],
  },
  {
    path: '/faq',
    title: 'Frequently Asked Questions — Nurella Beauty Lounge',
    h1: 'Frequently asked questions',
    description:
      'Direct answers about treatments, booking, consultations and pricing at Nurella Beauty Lounge — what we offer, which treatment suits which concern, and how appointments are confirmed.',
    schemas: [faqSchema(facts, faq), crumb({ name: 'FAQ', path: '/faq' })],
    sections: faqSections
      .filter((section) => faq.some((entry) => entry.section === section.id))
      .map((section) => ({
        heading: section.title,
        children: faq
          .filter((entry) => entry.section === section.id)
          .map((entry) => ({ heading: entry.question, level: 'h3', paragraphs: [entry.answer] })),
      })),
  },
  {
    path: '/about',
    title: 'About Nurella Beauty Lounge — Advanced Aesthetics, Skin & Beauty',
    h1: `About ${facts.name}`,
    description: facts.summary,
    schemas: [aboutPageSchema(facts), crumb({ name: 'About', path: '/about' })],
    sections: [
      { heading: 'Who we are', paragraphs: facts.description },
      { heading: 'What we specialise in', bullets: facts.specialties },
      { heading: 'What makes Nurella different', bullets: facts.differentiators },
      { heading: 'How booking works', bullets: facts.bookingSteps },
      contactSection,
    ],
  },
  {
    path: '/gallery',
    title: 'Gallery — Nurella Beauty Lounge',
    h1: 'The Nurella gallery',
    description:
      'A look inside Nurella Beauty Lounge and the treatments we offer — facial aesthetics, skin treatments, laser, permanent makeup and nails.',
    schemas: [crumb({ name: 'Gallery', path: '/gallery' })],
    sections: [
      {
        heading: 'About the gallery',
        paragraphs: [
          `Photographs of ${facts.name} and of the treatment categories offered there. Treatment details, appointment lengths and booking are on the treatments page.`,
        ],
      },
      contactSection,
    ],
  },
];

for (const category of categories ?? []) {
  for (const service of category.services ?? []) {
    const categoryFacts = treatments[category.slug] ?? {};
    const description =
      service.description ??
      (categoryFacts.whatItIs
        ? `${service.name} at ${facts.name}. ${categoryFacts.whatItIs}`
        : `${service.name} at ${facts.name}. Every treatment begins with a personalized consultation.`);

    routes.push({
      path: `/services/${service.slug}`,
      title: `${service.name} — ${facts.name}`,
      h1: service.name,
      description,
      schemas: [
        serviceSchema(facts, service, category, categoryFacts),
        crumb(
          { name: 'Treatments', path: '/services' },
          { name: service.name, path: `/services/${service.slug}` },
        ),
      ],
      sections: [
        {
          heading: 'The facts',
          definitions: [
            { term: 'Treatment', detail: service.name },
            { term: 'Category', detail: category.label },
            { term: 'What it is', detail: service.description ?? categoryFacts.whatItIs ?? service.name },
            categoryFacts.whoItIsFor ? { term: "Who it's for", detail: categoryFacts.whoItIsFor } : null,
            categoryFacts.addresses?.length
              ? { term: 'What it addresses', detail: categoryFacts.addresses.join(', ') }
              : null,
            { term: 'Appointment length', detail: `${service.durationMinutes} minutes` },
            {
              term: 'Price',
              detail:
                typeof service.price === 'number'
                  ? `${service.currency ? `${service.currency} ` : ''}${service.price.toFixed(2)}`
                  : facts.pricingPolicy,
            },
          ].filter(Boolean),
        },
        {
          heading: 'Before you book',
          paragraphs: [
            `Every treatment at ${facts.name} begins with a personalized consultation. The plan, the number of sessions and the price are confirmed with you before anything is carried out.`,
          ],
        },
        {
          heading: `Other ${category.label} treatments`,
          links: (category.services ?? [])
            .filter((item) => item.slug !== service.slug)
            .map((item) => ({ label: item.name, href: `/services/${item.slug}` })),
        },
        contactSection,
      ],
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Write                                                                      */
/* -------------------------------------------------------------------------- */

for (const route of routes) {
  const outPath =
    route.path === '/' ? shellPath : resolve(distDir, `.${route.path}`, 'index.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderHtml(route), 'utf8');
}

console.log(`  ✓ pre-rendered ${routes.length} public pages into dist/`);
if (!categories) {
  console.log('  → treatment pages were skipped: start the API or set GEO_API_URL, then rebuild.');
}
