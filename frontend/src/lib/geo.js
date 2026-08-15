/**
 * GENERATIVE ENGINE OPTIMISATION — SHARED CORE
 * ============================================
 *
 * Deliberately plain ESM with JSDoc types rather than TypeScript, because the
 * same functions run in two places and must never drift apart:
 *
 *   1. the React app  (`src/content/business.ts`, the page components)
 *   2. the build scripts (`scripts/generate-geo.mjs`, `scripts/prerender.mjs`)
 *      which run in Node and cannot import a `.ts` module.
 *
 * The module has no imports and touches no globals, so it is safe in both.
 *
 * GUIDING RULE: a fact Nurella has not supplied is omitted, never guessed.
 * Every builder below drops empty properties instead of emitting a placeholder,
 * because a wrong address or an invented price in structured data is far worse
 * than a missing one — search engines and AI assistants repeat it verbatim.
 */

/**
 * Catalogue shapes, kept structural so both the API response and the app's
 * `types/api.ts` interfaces satisfy them without an import.
 *
 * @typedef {Object} ServiceLike
 * @property {string} name
 * @property {string} slug
 * @property {string} category
 * @property {number} durationMinutes
 * @property {string} [description]
 * @property {number} [price]
 * @property {string} [currency]
 * @property {string} [imageUrl]
 */

/**
 * @typedef {Object} CategoryLike
 * @property {string} slug
 * @property {string} label
 * @property {ServiceLike[]} [services]
 */

/**
 * @typedef {Object} TreatmentFactsLike
 * @property {string} [whatItIs]
 * @property {string} [whoItIsFor]
 * @property {string[]} [addresses]
 */

/**
 * @typedef {Object} PostalAddressFacts
 * @property {string} [street]
 * @property {string} [locality]
 * @property {string} [region]
 * @property {string} [postalCode]
 * @property {string} [country]
 */

/**
 * @typedef {Object} OpeningHoursBlock
 * @property {string[]} days  Full day names, e.g. `['Monday','Tuesday']`.
 * @property {string} opens   `HH:mm`
 * @property {string} closes  `HH:mm`
 */

/**
 * @typedef {Object} ReviewFacts
 * @property {string} author
 * @property {number} rating
 * @property {string} body
 * @property {string} [datePublished]
 * @property {string} [source]
 */

/**
 * @typedef {Object} BusinessFacts
 * @property {string} name
 * @property {string} shortName
 * @property {string} schemaType
 * @property {string} tagline
 * @property {string} summary
 * @property {string[]} description
 * @property {string} philosophy
 * @property {string} positioning
 * @property {string[]} specialties
 * @property {string[]} differentiators
 * @property {string[]} bookingSteps
 * @property {string} bookingUrl
 * @property {string} pricingPolicy
 * @property {number|null} foundingYear
 * @property {number|null} teamSize
 * @property {string[]} credentials
 * @property {ReviewFacts[]} reviews
 * @property {number} ratingScale
 * @property {string} siteUrl
 * @property {string} instagramHandle
 * @property {string} instagramUrl
 * @property {string} [facebookUrl]
 * @property {string} [googleProfileUrl]
 * @property {string} [mapUrl]
 * @property {string|null} mapLink
 * @property {PostalAddressFacts|null} address
 * @property {string|null} addressLine
 * @property {string} [telephone]
 * @property {string} [email]
 * @property {string} [priceRange]
 * @property {string} [areaServed]
 * @property {{ latitude: number, longitude: number }|null} geo
 * @property {OpeningHoursBlock[]} openingHours
 * @property {string|null} hoursLine
 * @property {string[]} sameAs
 * @property {{ address: boolean, phone: boolean, email: boolean, hours: boolean, geo: boolean, reviews: boolean }} has
 */

const DAY_NAMES = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Trims, and turns an empty or whitespace-only value into `undefined`. */
function clean(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Drops `undefined`, `null` and empty arrays/objects so JSON-LD stays tight. */
function compact(object) {
  /** @type {Record<string, unknown>} */
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    result[key] = value;
  }
  return result;
}

/** `https://site.com` + `/services` — tolerant of a trailing slash on either. */
export function absoluteUrl(siteUrl, path = '/') {
  const base = String(siteUrl ?? '').replace(/\/+$/, '');
  if (!path || path === '/') return `${base}/`;
  return `${base}/${String(path).replace(/^\/+/, '')}`;
}

/**
 * Parses the `VITE_BUSINESS_HOURS` format: `Mon-Fri 09:00-19:00; Sat 10:00-18:00`.
 * Anything it cannot parse is skipped rather than half-emitted, so a typo in an
 * env file can never publish wrong opening hours.
 *
 * @returns {OpeningHoursBlock[]}
 */
export function parseOpeningHours(spec) {
  const raw = clean(spec);
  if (!raw) return [];

  /** @type {OpeningHoursBlock[]} */
  const blocks = [];

  for (const part of raw.split(';')) {
    const match = part
      .trim()
      .match(/^([A-Za-z,\-\s]+?)\s+([0-2]?\d:[0-5]\d)\s*-\s*([0-2]?\d:[0-5]\d)$/);
    if (!match) continue;

    const [, dayPart, opens, closes] = match;
    /** @type {string[]} */
    const days = [];

    for (const token of dayPart.split(',')) {
      const range = token.trim().split('-').map((day) => day.trim().slice(0, 3).toLowerCase());
      if (range.length === 1) {
        const day = DAY_NAMES[range[0]];
        if (day) days.push(day);
        continue;
      }
      const from = DAY_ORDER.indexOf(DAY_NAMES[range[0]]);
      const to = DAY_ORDER.indexOf(DAY_NAMES[range[1]]);
      if (from < 0 || to < 0) continue;
      // Wraps around the week for a spec such as `Sat-Mon`.
      for (let i = from; ; i = (i + 1) % DAY_ORDER.length) {
        days.push(DAY_ORDER[i]);
        if (i === to) break;
      }
    }

    if (days.length > 0) {
      blocks.push({ days, opens: padTime(opens), closes: padTime(closes) });
    }
  }

  return blocks;
}

function padTime(value) {
  const [hours, minutes] = value.split(':');
  return `${hours.padStart(2, '0')}:${minutes}`;
}

/** "Monday to Friday 09:00–19:00, Saturday 10:00–18:00" — for prose and FAQ answers. */
export function formatHoursLine(blocks) {
  if (!blocks || blocks.length === 0) return null;
  return blocks
    .map((block) => {
      const days =
        block.days.length > 2 && isConsecutive(block.days)
          ? `${block.days[0]} to ${block.days[block.days.length - 1]}`
          : block.days.join(', ');
      return `${days} ${block.opens}–${block.closes}`;
    })
    .join(', ');
}

function isConsecutive(days) {
  const indexes = days.map((day) => DAY_ORDER.indexOf(day));
  return indexes.every((value, index) => index === 0 || value === indexes[index - 1] + 1);
}

/** "12 Rue Example, Beirut, Lebanon" — only the parts that are configured. */
export function formatAddressLine(address) {
  if (!address) return null;
  const line = [address.street, address.locality, address.region, address.postalCode, address.country]
    .filter(Boolean)
    .join(', ');
  return line.length > 0 ? line : null;
}

/**
 * Merges the static entity facts with the environment-supplied contact details.
 *
 * @param {Record<string, any>} raw    Parsed `src/content/geo/business.json`.
 * @param {Record<string, string|undefined>} env  `import.meta.env` or `process.env`-shaped.
 * @returns {BusinessFacts}
 */
export function resolveBusiness(raw, env = {}) {
  const siteUrl = (clean(env.VITE_SITE_URL) ?? 'http://localhost:5173').replace(/\/+$/, '');

  const address = compact({
    street: clean(env.VITE_BUSINESS_STREET),
    locality: clean(env.VITE_BUSINESS_LOCALITY),
    region: clean(env.VITE_BUSINESS_REGION),
    postalCode: clean(env.VITE_BUSINESS_POSTAL_CODE),
    country: clean(env.VITE_BUSINESS_COUNTRY),
  });
  // A country on its own is not an address worth publishing — a street or a
  // city has to be present before schema.org gets a PostalAddress at all.
  const hasAddress = Boolean(address.street || address.locality);

  const latitude = Number(clean(env.VITE_BUSINESS_LATITUDE));
  const longitude = Number(clean(env.VITE_BUSINESS_LONGITUDE));
  const hasGeo = Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0);

  const instagramHandle = clean(env.VITE_INSTAGRAM_HANDLE) ?? 'nurella_beauty_lounge';
  const facebookUrl = clean(env.VITE_FACEBOOK_URL);
  const googleProfileUrl = clean(env.VITE_GOOGLE_BUSINESS_URL);
  const mapUrl = clean(env.VITE_BUSINESS_MAP_URL);

  // `hasMap` wants a link to this place; `sameAs` wants profiles the lounge
  // controls. They are usually different URLs and are resolved separately — a
  // bare coordinate pin makes a perfectly good map and a terrible identity
  // claim, so it belongs in one and not the other.
  //
  // The generated form is Google's documented Maps URLs API, which is stable.
  // A URL copied out of the browser's address bar is not: it carries a `data=`
  // blob encoding the camera and a short-lived `g_ep` build token, and it
  // rots. Store coordinates and build the link.
  const mapLink =
    mapUrl ??
    googleProfileUrl ??
    (hasGeo ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` : null);

  const openingHours = parseOpeningHours(env.VITE_BUSINESS_HOURS);
  const foundingYear = Number(clean(env.VITE_FOUNDING_YEAR)) || raw.foundingYear || null;
  const teamSize = Number(clean(env.VITE_TEAM_SIZE)) || raw.teamSize || null;
  const reviews = Array.isArray(raw.reviews) ? raw.reviews : [];

  return {
    name: raw.name,
    shortName: raw.shortName,
    schemaType: raw.schemaType ?? 'BeautySalon',
    tagline: raw.tagline,
    summary: raw.summary,
    description: raw.description ?? [],
    philosophy: raw.philosophy,
    positioning: raw.positioning,
    specialties: raw.specialties ?? [],
    differentiators: raw.differentiators ?? [],
    bookingSteps: raw.bookingSteps ?? [],
    bookingUrl: raw.bookingUrl ?? '/booking',
    pricingPolicy: raw.pricingPolicy,
    foundingYear,
    teamSize,
    credentials: raw.credentials ?? [],
    reviews,
    ratingScale: raw.ratingScale ?? 5,

    siteUrl,
    instagramHandle,
    instagramUrl: `https://instagram.com/${instagramHandle}`,
    facebookUrl,
    googleProfileUrl,
    mapUrl,
    mapLink,

    address: hasAddress ? address : null,
    addressLine: hasAddress ? formatAddressLine(address) : null,
    telephone: clean(env.VITE_BUSINESS_PHONE),
    email: clean(env.VITE_BUSINESS_EMAIL),
    priceRange: clean(env.VITE_BUSINESS_PRICE_RANGE),
    areaServed: clean(env.VITE_BUSINESS_AREA_SERVED) ?? (hasAddress ? address.locality : undefined),
    geo: hasGeo ? { latitude, longitude } : null,
    openingHours,
    hoursLine: formatHoursLine(openingHours),

    sameAs: [`https://instagram.com/${instagramHandle}`, facebookUrl, googleProfileUrl, mapUrl].filter(
      /** @returns {value is string} */ (value) => Boolean(value),
    ),

    has: {
      address: hasAddress,
      phone: Boolean(clean(env.VITE_BUSINESS_PHONE)),
      email: Boolean(clean(env.VITE_BUSINESS_EMAIL)),
      hours: openingHours.length > 0,
      geo: hasGeo,
      reviews: reviews.length > 0,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

/** Fills `{{placeholder}}` tokens from the resolved facts. */
export function fillTemplate(text, facts) {
  return String(text).replace(/\{\{(\w+)\}\}/g, (match, key) => {
    switch (key) {
      case 'name':
        return facts.name;
      case 'addressLine':
        return facts.addressLine ?? '';
      case 'city':
        return facts.address?.locality ?? '';
      case 'phone':
        return facts.telephone ?? '';
      case 'email':
        return facts.email ?? '';
      case 'hoursLine':
        return facts.hoursLine ?? '';
      case 'instagram':
        return `@${facts.instagramHandle}`;
      case 'siteUrl':
        return facts.siteUrl;
      default:
        return match;
    }
  });
}

/**
 * The publishable FAQ: entries whose `requires` facts are all configured and
 * whose `unless` facts are all absent, with placeholders resolved.
 *
 * @returns {{ id: string, section: string, question: string, answer: string }[]}
 */
export function resolveFaq(faq, facts) {
  const available = (key) => Boolean(facts.has[key]);
  return (faq.entries ?? [])
    .filter((entry) => (entry.requires ?? []).every(available))
    .filter((entry) => !(entry.unless ?? []).some(available))
    .map((entry) => ({
      id: entry.id,
      section: entry.section,
      question: fillTemplate(entry.question, facts),
      answer: fillTemplate(entry.answer, facts),
    }));
}

/* -------------------------------------------------------------------------- */
/* schema.org builders                                                        */
/* -------------------------------------------------------------------------- */

/** Stable node identifiers so every graph on the site points at one entity. */
export const businessId = (facts) => `${facts.siteUrl}/#business`;
export const websiteId = (facts) => `${facts.siteUrl}/#website`;

/**
 * Step 1 — the `BeautySalon` (LocalBusiness) node for the whole site.
 *
 * @param {BusinessFacts} facts
 * @param {{ categories?: CategoryLike[] }} [options]
 */
export function businessSchema(facts, { categories = [] } = {}) {
  const catalogue =
    categories.length > 0
      ? {
          '@type': 'OfferCatalog',
          name: `${facts.name} treatment menu`,
          itemListElement: categories.map((category) => ({
            '@type': 'OfferCatalog',
            name: category.label,
            itemListElement: (category.services ?? []).map((service) => ({
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: service.name,
                url: absoluteUrl(facts.siteUrl, `/services/${service.slug}`),
              },
            })),
          })),
        }
      : undefined;

  return compact({
    '@context': 'https://schema.org',
    '@type': facts.schemaType,
    '@id': businessId(facts),
    name: facts.name,
    alternateName: facts.shortName,
    description: facts.summary,
    slogan: facts.philosophy,
    url: absoluteUrl(facts.siteUrl),
    image: absoluteUrl(facts.siteUrl, '/images/og-cover.svg'),
    logo: absoluteUrl(facts.siteUrl, '/icons/icon-512.png'),
    telephone: facts.telephone,
    email: facts.email,
    priceRange: facts.priceRange,
    foundingDate: facts.foundingYear ? String(facts.foundingYear) : undefined,
    address: facts.address
      ? compact({
          '@type': 'PostalAddress',
          streetAddress: facts.address.street,
          addressLocality: facts.address.locality,
          addressRegion: facts.address.region,
          postalCode: facts.address.postalCode,
          addressCountry: facts.address.country,
        })
      : undefined,
    geo: facts.geo
      ? { '@type': 'GeoCoordinates', latitude: facts.geo.latitude, longitude: facts.geo.longitude }
      : undefined,
    hasMap: facts.mapLink,
    areaServed: facts.areaServed,
    openingHoursSpecification: facts.openingHours.map((block) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: block.days,
      opens: block.opens,
      closes: block.closes,
    })),
    sameAs: facts.sameAs,
    knowsAbout: facts.specialties,
    hasOfferCatalog: catalogue,
    potentialAction: {
      '@type': 'ReserveAction',
      name: 'Book an appointment',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: absoluteUrl(facts.siteUrl, facts.bookingUrl),
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      result: { '@type': 'Reservation', name: 'Appointment at ' + facts.name },
    },
    ...ratingNodes(facts),
  });
}

/** Step 7 — only ever emitted for reviews that are displayed on the site. */
export function ratingNodes(facts) {
  if (!facts.reviews || facts.reviews.length === 0) return {};

  const total = facts.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  const average = Math.round((total / facts.reviews.length) * 10) / 10;

  return {
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: average,
      reviewCount: facts.reviews.length,
      bestRating: facts.ratingScale,
      worstRating: 1,
    },
    review: facts.reviews.map((review) =>
      compact({
        '@type': 'Review',
        author: { '@type': 'Person', name: review.author },
        datePublished: review.datePublished,
        reviewBody: review.body,
        reviewRating: {
          '@type': 'Rating',
          ratingValue: review.rating,
          bestRating: facts.ratingScale,
          worstRating: 1,
        },
      }),
    ),
  };
}

/** The site itself, so the business and its pages hang off one graph. */
export function webSiteSchema(facts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId(facts),
    name: facts.name,
    url: absoluteUrl(facts.siteUrl),
    inLanguage: 'en',
    publisher: { '@id': businessId(facts) },
  };
}

/**
 * Step 1 — one `Service` node per treatment page.
 *
 * @param {BusinessFacts} facts
 * @param {ServiceLike} service
 * @param {CategoryLike} [category]
 * @param {TreatmentFactsLike} [categoryFacts]
 */
export function serviceSchema(facts, service, category, categoryFacts) {
  const url = absoluteUrl(facts.siteUrl, `/services/${service.slug}`);
  const description =
    service.description ||
    categoryFacts?.whatItIs ||
    `${service.name} at ${facts.name}. Every treatment begins with a personalized consultation.`;

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${url}#service`,
    name: service.name,
    url,
    description,
    serviceType: category?.label ?? 'Beauty treatment',
    category: category?.label,
    provider: { '@id': businessId(facts), '@type': facts.schemaType, name: facts.name },
    areaServed: facts.areaServed,
    audience: categoryFacts?.whoItIsFor
      ? { '@type': 'Audience', audienceType: categoryFacts.whoItIsFor }
      : undefined,
    image: service.imageUrl ? undefined : absoluteUrl(facts.siteUrl, `/images/categories/${service.category}.svg`),
    // An Offer is emitted only when the lounge has actually set a price.
    offers:
      typeof service.price === 'number'
        ? compact({
            '@type': 'Offer',
            price: service.price,
            priceCurrency: service.currency,
            availability: 'https://schema.org/InStock',
            url,
          })
        : undefined,
  });
}

/**
 * Step 3 — the treatments index as a crawlable list of every treatment.
 *
 * @param {BusinessFacts} facts
 * @param {CategoryLike[]} categories
 */
export function serviceListSchema(facts, categories) {
  const services = categories.flatMap((category) => category.services ?? []);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${facts.name} treatment menu`,
    numberOfItems: services.length,
    itemListElement: services.map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: service.name,
      url: absoluteUrl(facts.siteUrl, `/services/${service.slug}`),
    })),
  };
}

/**
 * Step 2 — `FAQPage`, built from the entries that are actually rendered.
 *
 * @param {BusinessFacts} facts
 * @param {{ question: string, answer: string }[]} entries
 */
export function faqSchema(facts, entries) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${absoluteUrl(facts.siteUrl, '/faq')}#faq`,
    name: `${facts.name} — frequently asked questions`,
    isPartOf: { '@id': websiteId(facts) },
    about: { '@id': businessId(facts) },
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

/** Step 4 — the entity page, tied back to the business node. */
export function aboutPageSchema(facts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${absoluteUrl(facts.siteUrl, '/about')}#about`,
    name: `About ${facts.name}`,
    description: facts.description[0] ?? facts.summary,
    isPartOf: { '@id': websiteId(facts) },
    mainEntity: { '@id': businessId(facts) },
  };
}

/**
 * @param {BusinessFacts} facts
 * @param {{ name: string, path: string }[]} trail
 */
export function breadcrumbSchema(facts, trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(facts.siteUrl, crumb.path),
    })),
  };
}
