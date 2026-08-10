# Generative Engine Optimisation (GEO)

How this site is built to be found, read and quoted correctly by AI assistants (ChatGPT, Claude,
Gemini, Perplexity) as well as by conventional search engines.

The rule the whole implementation follows: **a fact Nurella has not supplied is omitted, never
guessed.** Wrong structured data is worse than missing structured data, because assistants repeat it
verbatim and rarely re-check.

---

## Where everything lives

| File | Role |
| ---- | ---- |
| [`frontend/src/content/geo/business.json`](../frontend/src/content/geo/business.json) | Entity facts: summary, description, specialties, differentiators, booking steps, pricing policy, reviews |
| [`frontend/src/content/geo/treatments.json`](../frontend/src/content/geo/treatments.json) | Per-category plain-language facts: what it is, who it's for, what it addresses |
| [`frontend/src/content/geo/faq.json`](../frontend/src/content/geo/faq.json) | The FAQ, question-phrased, with `requires`/`unless` gates on business facts |
| [`frontend/src/lib/geo.js`](../frontend/src/lib/geo.js) | Shared core: resolves facts from env, filters the FAQ, builds every schema.org graph |
| [`frontend/src/content/business.ts`](../frontend/src/content/business.ts) | Typed wrapper the React app imports |
| [`frontend/scripts/generate-geo.mjs`](../frontend/scripts/generate-geo.mjs) | Writes `robots.txt`, `sitemap.xml`, `llms.txt` |
| [`frontend/scripts/prerender.mjs`](../frontend/scripts/prerender.mjs) | Writes a crawlable HTML file per public route after the build |
| [`frontend/.env.example`](../frontend/.env.example) | Every configurable business fact |

`lib/geo.js` is deliberately plain ESM with JSDoc types: the React app and the two Node build scripts
import the *same* module, so the pages, the structured data, `llms.txt` and the pre-rendered HTML
cannot drift apart.

---

## What was implemented

### 1. Structured data

A single `BeautySalon` entity (`@id: <site>/#business`) is emitted on every public page, carrying
name, description, slogan, logo, image, `sameAs` profiles, `knowsAbout` specialties, a
`ReserveAction` pointing at the booking flow, and a `hasOfferCatalog` built from the live treatment
menu. `address`, `geo`, `telephone`, `email`, `priceRange` and `openingHoursSpecification` appear as
soon as they are configured — see [GEO-NAP-AUDIT.md](GEO-NAP-AUDIT.md).

Per page, on top of that: `Service` on each treatment page (with an `Offer` only when a real price is
set), `ItemList` of all treatments on `/services`, `FAQPage` on `/faq`, `AboutPage` on `/about`,
`WebSite` site-wide, and `BreadcrumbList` on every sub-page.

At runtime the React app injects these through `components/ui/JsonLd`; in the pre-rendered HTML they
are inlined with a `data-geo-static` attribute, which `main.tsx` strips on boot so a client-side
navigation can never leave the previous route's graph behind.

### 2. FAQ

`/faq` carries 21 questions phrased the way people ask assistants ("What's the best treatment for
oily, acne-prone skin?"), grouped into treatments, concerns, booking and practicalities. Answers are
2–4 sentences and every claim in them is verifiable from the site or the booking flow.

Questions that depend on unpublished facts are gated: the "Where are you located?" entry only appears
once an address is configured, and a contact-oriented alternative appears in its place until then.
The `FAQPage` markup is generated from the entries actually rendered, so the two can never disagree.

The homepage shows the first five as a preview; only `/faq` declares `FAQPage`.

### 3. Fact-first treatment pages

Every treatment page opens with a plain block — what it is, who it's for, what it addresses,
appointment length, price — before any marketing copy. `/services` does the same for each category.
The concern list mirrors `CONCERN_CATEGORIES` in `brand.ts`, so "what helps acne scars?" resolves to
the same categories the site's own concern picker resolves to.

Where the lounge has set no price, the block states the actual pricing policy (confirmed at
consultation) rather than showing nothing — an assistant that reads "no price" tends to guess one.

### 4. Entity page

`/about` gained an entity block: business name, type, category count, guiding principle, booking and
consultation policy, specialties, how booking works, and what makes the lounge different. Address,
hours, phone, email, founding year and team size join the list as they are configured.

### 5. NAP consistency

Automated on-site (footer, schema, FAQ, `llms.txt` all read one config). Off-site is a manual audit:
see [GEO-NAP-AUDIT.md](GEO-NAP-AUDIT.md).

### 6. Crawlability

- **`robots.txt`** explicitly allows the AI crawlers (GPTBot, OAI-SearchBot, ChatGPT-User,
  ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot,
  meta-externalagent and others) and keeps them out of `/app`, `/admin` and the auth routes.
  To opt out of one, delete it from `AI_CRAWLERS` in `generate-geo.mjs` and regenerate.
- **`llms.txt`** — a plain-markdown briefing at the site root: what the business is, contact and
  booking, key pages, specialties, the full treatment menu with per-category explanations and links,
  how booking works, the whole FAQ, and a short "notes for AI assistants" section that tells a model
  not to invent prices or an address.
- **`sitemap.xml`** — all public URLs including one per treatment, at the configured origin.
- **Pre-rendering** — the important one. This is a client-rendered React SPA; Googlebot runs
  JavaScript but most AI crawlers do not, so without this they would see an empty `<div id="root">`.
  After `vite build`, `prerender.mjs` writes one HTML file per public route with a route-specific
  title, description, canonical URL, JSON-LD graph, and a plain-text rendering of the page's facts.

  That fallback text sits **inside `#root`**, which React clears on its first render — so a visitor
  with JavaScript gets the real app, a crawler without JavaScript gets the content, and there is no
  hidden text and nothing shown to crawlers that is not shown to people.

### 7. Reviews

`Review` and `AggregateRating` are wired to the `reviews` array in `business.json`. It ships empty:
the on-page testimonials section renders nothing and no rating is claimed. Add real reviews there and
both the section and the markup appear together — the markup is generated from the same array that is
displayed, so the site can never claim a rating it does not show.

---

## Building and configuring

```bash
# once per environment: set at least VITE_SITE_URL, ideally the NAP block
cp frontend/.env.example frontend/.env

npm run build --workspace frontend
```

`npm run build` now runs `generate-geo.mjs` → `tsc` → `vite build` → `prerender.mjs`.

Two things worth knowing:

- **`VITE_SITE_URL` must be the production origin before a production build.** Canonicals, the
  sitemap, `llms.txt` and every absolute URL in the structured data come from it.
- **The treatment catalogue is read from the live API** (`GEO_API_URL`, default
  `http://localhost:5000/api`). If the API is unreachable the build still succeeds — it just falls
  back to category-level content and skips the per-treatment pages, with a warning. For a production
  build, point `GEO_API_URL` at the production API so all 46 treatment pages are generated.

Re-run `npm run geo --workspace frontend` on its own after adding or renaming treatments, so the
sitemap and `llms.txt` pick them up.

**Hosting requirement:** the pre-rendered files are written as `dist/<route>/index.html`. The host
must resolve a directory to its `index.html` (Netlify, Vercel, Cloudflare Pages, S3+CloudFront and
nginx with `try_files $uri $uri/index.html /index.html` all do) *before* falling back to the SPA
shell. If the host rewrites everything to `/index.html` unconditionally, every crawler sees the
homepage fallback on every URL and the per-route work is wasted.

---

## Verifying

1. **Structured data** — [Rich Results Test](https://search.google.com/test/rich-results) and the
   [Schema Markup Validator](https://validator.schema.org/) against the deployed `/`, `/services/<slug>`
   and `/faq`. Expect a warning that `LocalBusiness` needs an address until the NAP block is filled.
2. **Crawlability without JavaScript** — `curl https://<domain>/faq | less`, or `view-source:`. The
   questions and answers must be in the HTML. Same for `/services/<slug>`.
3. **`curl https://<domain>/llms.txt`** and `robots.txt` — check the origin is the production one,
   not `localhost`.
4. **Ask the assistants**, after they have had time to crawl: "best laser hair removal in \<city\>",
   "where can I get collagen biostimulation in \<city\>", "beauty lounge for acne scars near me".
   If Nurella does not surface, the usual causes in order are: no Google Business Profile, no
   address on the site, no reviews, and too few external mentions — none of which are fixed in code.

---

## Off-site work, which no code can do

Google Business Profile (create, verify, categorise, photograph), Apple Business Connect and Bing
Places listings, review generation, directory listings, and press or blog mentions. AI assistants
weight third-party corroboration heavily; the site is the anchor, not the whole signal.
