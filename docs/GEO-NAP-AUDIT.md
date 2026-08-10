# NAP consistency audit

**NAP** = Name, Address, Phone. Search engines and AI assistants treat a business as one entity only
when these match across every place they appear. A single mismatched suite number or a phone number
written two different ways is enough to split one business into two weaker entities.

This is an **audit, not a code task** — the site side is already automated (fill one env file and
every surface updates together); the off-site side has to be done by hand in each account.

Status date: 2026-08-10.

---

## 1. Blocking issue: no address or phone exists yet

Nurella has not supplied a street address, phone number, contact email or public opening hours.
They are therefore absent from the site, and the code refuses to invent them (see
`MISSING_INFORMATION` in [`frontend/src/content/brand.ts`](../frontend/src/content/brand.ts)).

**This is the single largest limit on the GEO work.** An AI assistant asked "best aesthetics clinic
in \<city\>" filters by location first. Without a city, Nurella cannot be a candidate for any
location-qualified question — no amount of schema or FAQ tuning substitutes for it.

Google also requires `address` for the `LocalBusiness` rich result; until it is set, the Rich Results
Test will report the business markup as ineligible even though it is valid.

### How to fix it (5 minutes, no code change)

Fill these in `frontend/.env` (values documented in
[`frontend/.env.example`](../frontend/.env.example)) and rebuild:

```dotenv
VITE_BUSINESS_STREET=
VITE_BUSINESS_LOCALITY=          # city — the most important single field
VITE_BUSINESS_REGION=
VITE_BUSINESS_POSTAL_CODE=
VITE_BUSINESS_COUNTRY=
VITE_BUSINESS_PHONE=
VITE_BUSINESS_EMAIL=
VITE_BUSINESS_HOURS=             # e.g. Mon-Fri 09:00-19:00; Sat 10:00-18:00
VITE_BUSINESS_LATITUDE=
VITE_BUSINESS_LONGITUDE=
VITE_GOOGLE_BUSINESS_URL=
VITE_BUSINESS_MAP_URL=
VITE_FACEBOOK_URL=
```

Setting them updates, in one pass: the footer NAP block, the `BeautySalon` structured data
(`address`, `geo`, `telephone`, `openingHoursSpecification`, `sameAs`), the location and phone and
opening-hours FAQ entries — which stay unpublished until then rather than being answered vaguely —
`llms.txt`, and every pre-rendered page.

---

## 2. On-site NAP — where it appears

| Surface | Source | State |
| ------- | ------ | ----- |
| Footer of every public page | `VITE_BUSINESS_*` | Renders name + tagline; address/phone/email/hours appear once configured |
| `BeautySalon` structured data | `src/lib/geo.js` → `businessSchema()` | Name, URL, image, logo, socials, treatment catalogue present; address/phone omitted until configured |
| `/about` entity block | `EntitySection` | Name, type, categories, principle, booking process; contact rows appear once configured |
| `/faq` | `content/geo/faq.json` | Location/phone/hours questions are withheld while unanswerable |
| `public/llms.txt` | generated | Contact section lists only what exists |

**Write the values once, exactly as they should appear everywhere**, then copy that exact string into
each off-site profile below. Decide the canonical form up front:

- Business name: `Nurella Beauty Lounge` (not "Nurella Beauty Lounge & Spa", not "NURELLA")
- Phone: one format, including country code, used identically everywhere
- Address: one line order, one spelling, one abbreviation style (`St` vs `Street` — pick one)

---

## 3. Off-site checklist — do these by hand

| Where | What to check | Done |
| ----- | ------------- | ---- |
| Google Business Profile | Exists and is **verified**. Name, address, phone, hours match the site character for character. Category set to *Beauty salon* (plus *Skin care clinic* / *Medical spa* as secondary if accurate). Website field points to the production domain. Services list mirrors the treatment menu. | ☐ |
| Google Business Profile — photos | Real interior/exterior/treatment photos uploaded. Exterior photos in particular help AI assistants confirm the location is real. | ☐ |
| Instagram bio (`@nurella_beauty_lounge`) | Same business name; address and phone if shown, matching exactly; link points to the production domain. | ☐ |
| Facebook page | Same name, address, phone, hours. Set `VITE_FACEBOOK_URL` so it becomes a `sameAs` entry. | ☐ |
| Apple Business Connect | Listing claimed — this is what feeds Apple Maps and Apple Intelligence. | ☐ |
| Bing Places | Listing claimed — feeds Bing, and Bing's index feeds several AI assistants. | ☐ |
| Local / national directories | Any existing listings found by searching the business name and phone number: correct or remove them. Stale listings with an old address actively harm entity confidence. | ☐ |
| Old or duplicate listings | Search for duplicates of the Google profile and merge/close them. | ☐ |

### How to find mismatches quickly

1. Search the exact business name in quotes; note every result that shows an address or phone.
2. Search the phone number in quotes; anything with a *different* business name is a data error
   worth correcting at the source.
3. Compare each hit against the canonical strings from section 2.

---

## 4. Also worth doing off-site (not NAP, but the same goal)

- **Reviews.** Ask satisfied clients for Google reviews. AI assistants weight review volume and
  recency heavily when ranking local recommendations. Once there are reviews worth quoting, add
  them to `reviews` in [`frontend/src/content/geo/business.json`](../frontend/src/content/geo/business.json) —
  the on-page testimonials section and the `Review`/`AggregateRating` markup both switch on from
  that one array. **Only add reviews that are genuine and displayed on the site**; marking up
  ratings that are not shown is a structured-data violation and a manual-action risk.
- **Credentials.** If practitioners hold certifications, list them in `credentials` in the same file
  and they become part of the entity description.
- **A founding year and team size.** `VITE_FOUNDING_YEAR` and `VITE_TEAM_SIZE` — small facts, but
  they make the entity concrete and are shown on `/about` and in `foundingDate`.
