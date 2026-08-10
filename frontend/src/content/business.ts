/**
 * ENTITY FACTS FOR THE RUNNING APP.
 *
 * Thin typed wrapper over `content/geo/*.json` and `lib/geo.js`. The build
 * scripts (`scripts/generate-geo.mjs`, `scripts/prerender.mjs`) read the very
 * same JSON through the very same resolver, so the FAQ, the structured data,
 * `llms.txt` and the pre-rendered HTML can never disagree with the pages.
 *
 * Contact details come from `VITE_BUSINESS_*` environment variables — see
 * `.env.example` and `docs/GEO-NAP-AUDIT.md`. Anything unset is omitted
 * everywhere rather than replaced with a plausible-looking value.
 */
import { resolveBusiness, resolveFaq } from '@/lib/geo.js';
import businessJson from './geo/business.json';
import faqJson from './geo/faq.json';
import treatmentsJson from './geo/treatments.json';

export interface TreatmentFacts {
  /** Plain statement of what the category is — no marketing language. */
  whatItIs: string;
  whoItIsFor: string;
  /** Concerns the category addresses; mirrors CONCERN_CATEGORIES in `brand.ts`. */
  addresses: string[];
}

export interface FaqEntry {
  id: string;
  section: string;
  question: string;
  answer: string;
}

/** Resolved business facts — the single source used by every page and script. */
export const BUSINESS = resolveBusiness(
  businessJson,
  import.meta.env as unknown as Record<string, string | undefined>,
);

/** Only the questions this deployment can actually answer. */
export const FAQ_ENTRIES: FaqEntry[] = resolveFaq(faqJson, BUSINESS);

/** Sections that still have at least one publishable question. */
export const FAQ_SECTIONS = faqJson.sections.filter((section) =>
  FAQ_ENTRIES.some((entry) => entry.section === section.id),
);

const CATEGORY_FACTS = treatmentsJson.categories as unknown as Record<
  string,
  TreatmentFacts | undefined
>;

/** Fact-first copy for a treatment category, or `undefined` if none is written. */
export const treatmentFacts = (categorySlug: string): TreatmentFacts | undefined =>
  CATEGORY_FACTS[categorySlug];

/** Reviews Nurella has supplied. Empty until real ones are added — see business.json. */
export const REVIEWS = BUSINESS.reviews;
