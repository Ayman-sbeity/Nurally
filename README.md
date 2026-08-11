# Nurella Beauty Lounge

A production-shaped booking platform for **Nurella Beauty Lounge**, built as a MERN stack
monorepo:

- a premium public landing page,
- an installable **client PWA** for booking and tracking appointments,
- an **admin dashboard** for approving requests, offering alternative times and managing the
  calendar, services, clients and availability.

The whole thing is a real application: the frontend talks to the API, the API talks to MongoDB,
authentication works, and the booking engine is the server-side authority on what can be booked.

---

## Contents

- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database and seed data](#database-and-seed-data)
- [The booking workflow](#the-booking-workflow)
- [How double-booking is prevented](#how-double-booking-is-prevented)
- [Availability engine](#availability-engine)
- [API reference](#api-reference)
- [Client records, photos and files](#client-records-photos-and-files)
- [Frontend routes](#frontend-routes)
- [PWA installation](#pwa-installation)
- [Design system](#design-system)
- [Search and AI discoverability (GEO)](#search-and-ai-discoverability-geo)
- [Security](#security)
- [Production build and deployment](#production-build-and-deployment)
- [Content rules and placeholders](#content-rules-and-placeholders)

---

## Tech stack

| Layer    | Choices                                                                       |
| -------- | ----------------------------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite 6, React Router 6, TanStack Query 5, Axios, React Hook Form + Zod, Framer Motion, `vite-plugin-pwa` |
| Backend  | Node.js 20+, Express 4, TypeScript, Mongoose 8, Zod, JWT, bcrypt, Helmet, CORS, `express-rate-limit` |
| Database | MongoDB (works on a standalone `mongod` — no replica set required)             |

---

## Architecture

```
nurella-beauty-lounge/
├── backend/
│   └── src/
│       ├── config/        env validation, database connection
│       ├── models/        Mongoose schemas
│       ├── services/      business logic (booking, availability, slot locks, auth, notifications)
│       ├── controllers/   HTTP layer — thin, delegates to services
│       ├── routes/        REST routing + middleware wiring
│       ├── middleware/    auth, RBAC, validation, rate limiting, error handling
│       ├── validators/    Zod request schemas
│       ├── utils/         time/timezone, JWT, errors, logging
│       └── seed/          development seed + the Nurella service catalogue
├── frontend/
│   ├── public/            icons, placeholder imagery, robots.txt, sitemap.xml
│   ├── scripts/           placeholder image + PWA icon generators
│   └── src/
│       ├── api/           typed API client (Axios + silent token refresh)
│       ├── components/    ui/ (design system), landing/, booking/, client/, admin/
│       ├── content/       brand copy — the single source of truth for wording
│       ├── context/       auth + toast providers
│       ├── hooks/         TanStack Query hooks and query keys
│       ├── layouts/       public / auth / client / admin shells
│       ├── pages/         public/, client/, admin/
│       ├── styles/        design tokens + per-surface stylesheets
│       └── types/         API contract types
└── docs/
    └── SPECIFICATION.md   the original brief
```

**Rule of thumb:** controllers do HTTP, services do business logic, models do persistence.
No business rule lives in a React component — the UI asks the API what is allowed.

---

## Getting started

### Prerequisites

- Node.js 20 or newer
- MongoDB running locally (or a connection string to Atlas)

### Install

```bash
git clone <your-repo-url> nurella-beauty-lounge
cd nurella-beauty-lounge
npm install          # installs both workspaces
```

### Configure

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Generate real JWT secrets and paste them into `backend/.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Seed and run

```bash
npm run seed:demo    # catalogue + admin + example availability + demo bookings
npm run dev          # API on :5000, web on :5173
```

Open <http://localhost:5173>.

The Vite dev server proxies `/api` to `http://localhost:5000`, so the browser stays same-origin
and the refresh cookie works without CORS configuration in development.

### Default development accounts

| Role   | Email                       | Password         |
| ------ | --------------------------- | ---------------- |
| Admin  | `admin@nurella.local`       | `ChangeMe123!`   |
| Client | `demo.client@nurella.local` | `DemoClient123!` |

Both come from the seed script. **Change the admin password before any real deployment** — the
seed warns you when the default is still in use.

### Scripts

| Command              | Effect                                                       |
| -------------------- | ------------------------------------------------------------ |
| `npm run dev`        | Run API and web together                                     |
| `npm run build`      | Type-check and build both workspaces                         |
| `npm run typecheck`  | Type-check both workspaces                                   |
| `npm run seed`       | Catalogue, admin, working hours, gallery (safe to re-run)     |
| `npm run seed:demo`  | The above plus clearly-labelled demo bookings                 |
| `npm run seed:reset` | **Wipes** appointments/catalogue/gallery/clients, then reseeds |

---

## Environment variables

### `backend/.env`

| Variable                    | Purpose                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| `NODE_ENV`, `PORT`          | Runtime mode and port                                                |
| `MONGODB_URI`               | MongoDB connection string                                            |
| `JWT_ACCESS_SECRET`         | Signs 15-minute access tokens                                        |
| `JWT_REFRESH_SECRET`        | Signs refresh tokens (must differ from the access secret)            |
| `JWT_ACCESS_EXPIRES_IN`     | Access token lifetime (default `15m`)                                |
| `JWT_REFRESH_EXPIRES_IN`    | Refresh token lifetime (default `30d`)                               |
| `CLIENT_URL`, `SERVER_URL`  | Public URLs; `CLIENT_URL` is an allowed CORS origin                  |
| `CORS_ORIGINS`              | Extra allowed origins, comma-separated                               |
| `LOUNGE_TIMEZONE`           | **IANA timezone the lounge operates in.** Defaults to `UTC` — set it |
| `SLOT_GRANULARITY_MINUTES`  | Booking grid resolution (default 15)                                 |
| `MAX_ADVANCE_BOOKING_DAYS`  | How far ahead clients may book                                       |
| `MIN_BOOKING_NOTICE_MINUTES`| Minimum notice for a client booking                                  |
| `TIME_OFFER_EXPIRY_HOURS`   | How long an offered time stays valid                                 |
| `SEED_ADMIN_*`              | Bootstrap admin credentials used by the seed                         |
| `STORAGE_DRIVER`            | Where client media is stored (`local`)                               |
| `UPLOAD_DIR`                | Directory the `local` driver writes to (default `uploads`)            |
| `MAX_UPLOAD_MB`             | Per-file upload ceiling (default 15)                                  |
| `MAX_VIDEO_UPLOAD_MB`       | Ceiling for Instagram reel videos only (default 80)                   |

The server validates all of these on boot with Zod and **refuses to start** if anything is
missing or malformed, rather than failing later in a confusing way.

### `frontend/.env`

Only `VITE_*` variables reach the browser bundle — never put a secret here.

| Variable                 | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `VITE_API_URL`           | API base URL (default `/api` via the proxy) |
| `VITE_SITE_URL`          | Canonical + Open Graph URLs, sitemap, `llms.txt`, structured data. **Must be the production origin before a production build.** |
| `VITE_INSTAGRAM_HANDLE`  | Handle shown in the footer, booking CTA and the reels section's Follow button |
| `VITE_BUSINESS_*`        | Address, phone, email, hours, coordinates, social profiles. Empty by default — each one is omitted from the page and the structured data until set. See [`docs/GEO-NAP-AUDIT.md`](docs/GEO-NAP-AUDIT.md). |
| `VITE_FOUNDING_YEAR`, `VITE_TEAM_SIZE` | Shown on `/about` and in structured data only when set |

---

## Database and seed data

Collections: `users`, `services`, `appointments`, `workinghours`, `blockedperiods`, `slotlocks`,
`notifications`, `galleryimages`, `clientphotosets`, `clientassets`.

Notable modelling decisions:

- **Client profile is embedded in `User`**, not a separate collection. It is a strict 1:1
  relationship always loaded together, so embedding removes a join from the hottest read path.
- **Appointments snapshot the service name and duration.** Editing a service later never rewrites
  history or moves an existing booking.
- **`requestedStartAt` is immutable.** `startAt` moves when the lounge offers a different time, so
  both sides can always see what was originally asked for.
- **Every state change is appended to `history`**, with who did it and when.
- Indexes cover the real queries: calendar ranges, a client's own list, the pending queue, and the
  admin client search.

`_id` is the identifier on every response. Lean queries skip Mongoose's `id` virtual, so `_id` is
the one field guaranteed to be present everywhere — the frontend types use it consistently.

---

## The booking workflow

Selecting a slot does **not** produce a confirmed appointment. The lounge decides.

```
CLIENT                          ADMIN
  │
  ├─ picks service, date, time
  ├─ submits request ──────────► PENDING
  │                                │
  │                                ├─ Approve ──────────► CONFIRMED
  │                                ├─ Reject ───────────► REJECTED
  │                                ├─ Offer another time ► TIME_OFFERED
  │                                └─ Contact client (phone / email)
  │                                     │
  ├─ accepts offer ───────────────────► CONFIRMED
  ├─ declines offer ──────────────────► CANCELLED
  └─ asks for another time ───────────► RESCHEDULE_REQUESTED
                                          │
                                          ├─ approve proposed time ► CONFIRMED
                                          └─ offer a different one ► TIME_OFFERED

CONFIRMED ─► COMPLETED | CANCELLED | NO_SHOW
```

The transition table lives in [`backend/src/types/domain.ts`](backend/src/types/domain.ts) and maps
`from → to → allowed roles`. Anything absent is refused with `409 INVALID_TRANSITION`, so a client
cannot approve their own booking and no one can jump `PENDING → COMPLETED`. The admin UI only
renders the actions the current status permits, but the server never trusts that.

Unanswered time offers expire (`TIME_OFFER_EXPIRY_HOURS`). A sweep runs every 15 minutes and on
every dashboard load, cancelling them and releasing the held slot.

---

## How double-booking is prevented

Two clients must never both get the same slot. Because MongoDB multi-document transactions require
a replica set — and this project targets a plain local `mongod` too — the guarantee comes from a
**unique index** instead.

The bookable day is a grid of fixed-width cells (`SLOT_GRANULARITY_MINUTES`). An appointment claims
every cell its duration covers by inserting one document per cell into `slotlocks`, where
`cellStart` is **unique**:

1. Availability is re-validated server-side against the requested instant.
2. The appointment's cells are inserted with `ordered: false`.
3. If any cell is already claimed, MongoDB raises a duplicate-key error, the partial inserts are
   rolled back (they are the only documents carrying this appointment's id, so nothing else can be
   touched), and the request fails with `409 BOOKING_CONFLICT`.
4. Only then is the appointment persisted.

Verified under real concurrency: eight simultaneous requests for one slot produce exactly one
`201` and seven `409`s.

Moving an appointment claims the new cells **before** releasing the old ones, so a failed move
never costs a client the slot they already held.

Which statuses hold their slot:

| Holds the slot                                              | Releases it          |
| ----------------------------------------------------------- | -------------------- |
| `PENDING`, `CONFIRMED`, `TIME_OFFERED`, `RESCHEDULE_REQUESTED`, `COMPLETED`, `NO_SHOW` | `CANCELLED`, `REJECTED` |

---

## Availability engine

`computeDayAvailability` is the single source of truth for "can this be booked?". Both the slot
list shown to clients and the re-check performed during booking run through it, so the two can
never disagree. It accounts for:

- the weekday's working hours and breaks,
- blocked periods (holidays, closures, part-day blocks),
- slots already claimed in `slotlocks`,
- the service's own duration — a 60-minute treatment is never offered a slot that only has 30
  minutes free,
- minimum notice and the maximum advance booking window.

All instants are stored in UTC and rendered in `LOUNGE_TIMEZONE`. Wall-clock conversion resolves the
offset per concrete time rather than adding minutes to midnight, so DST transitions stay correct.

When a day has nothing free, the API says *why* (`DAY_OFF`, `BLOCKED`, `FULLY_BOOKED`, `PAST`,
`TOO_FAR_AHEAD`) and the UI explains it instead of showing an empty list.

---

## API reference

All responses share one envelope: `{ "success": true, "data": … }` on success, and
`{ "success": false, "error": { "code", "message", "issues?" } }` on failure. Error codes
(`BOOKING_CONFLICT`, `SLOT_UNAVAILABLE`, `INVALID_TRANSITION`, `OFFER_EXPIRED`, …) are part of the
contract and drive the UI's error states.

### Public

| Method | Path                        | Purpose                                |
| ------ | --------------------------- | -------------------------------------- |
| GET    | `/api/health`               | Liveness + database status             |
| GET    | `/api/services`             | Active catalogue, grouped by category  |
| GET    | `/api/services/:idOrSlug`   | One service                            |
| GET    | `/api/availability`         | Slots for `?serviceId=&date=`          |
| GET    | `/api/availability/overview`| Which of the next N days have openings |
| GET    | `/api/availability/settings`| Timezone, granularity, booking window  |
| GET    | `/api/gallery`              | Active gallery images                  |

### Auth

`POST /api/auth/register` · `login` · `refresh` · `logout` · `forgot-password` · `reset-password` ·
`change-password` — plus `GET /api/auth/me` and `PATCH /api/auth/me`.

### Client (authenticated)

| Method | Path                                  | Purpose                     |
| ------ | ------------------------------------- | --------------------------- |
| POST   | `/api/appointments`                   | Submit a booking request    |
| GET    | `/api/appointments`                   | Own appointments (filtered) |
| GET    | `/api/appointments/:id`               | Detail + permitted actions  |
| POST   | `/api/appointments/:id/accept-time`   | Accept an offered time      |
| POST   | `/api/appointments/:id/decline-time`  | Decline an offered time     |
| POST   | `/api/appointments/:id/reschedule`    | Propose a different time    |
| POST   | `/api/appointments/:id/cancel`        | Cancel                      |
| GET    | `/api/notifications`                  | In-app updates              |

### Admin (`ADMIN` role required)

`GET /api/admin/dashboard` · `/calendar` · `/appointments` · `/appointments/:id` ·
`/clients` · `/clients/:id` — and the actions
`approve`, `reject`, `offer-time`, `reschedule`, `approve-reschedule`, `complete`, `no-show`,
`cancel`; plus service, availability (`working-hours`, `blocked`) and gallery management.

Client records and media:

| Method   | Route                                            | Purpose                                  |
| -------- | ------------------------------------------------ | ---------------------------------------- |
| `POST`   | `/admin/clients`                                 | Create a client from the front desk       |
| `GET`    | `/admin/clients/:id/photo-sets`                  | Before/after records, photos grouped      |
| `POST`   | `/admin/clients/:id/photo-sets`                  | Start a before/after record               |
| `PATCH`  | `/admin/photo-sets/:setId`                       | Edit a record / record consent            |
| `DELETE` | `/admin/photo-sets/:setId`                       | Delete a record and its photographs       |
| `POST`   | `/admin/clients/:id/photo-sets/:setId/photos`    | Upload a `BEFORE` or `AFTER` photo        |
| `GET`    | `/admin/clients/:id/documents`                   | List a client's files                     |
| `POST`   | `/admin/clients/:id/documents`                   | Upload a file                             |
| `GET`    | `/admin/assets/:assetId/file`                    | Stream the bytes (admin token required)   |
| `DELETE` | `/admin/assets/:assetId`                         | Delete a file and its stored object       |

---

## Client records, photos and files

The admin can create clients directly and keep a photographic and documentary record against
each one.

### Adding a client

`POST /admin/clients` creates a **record, not an account**. No password is chosen: the row is
written with a hash of random bytes nobody holds, so the account cannot be signed into at all.
A client who later wants app access claims it through the normal forgot-password flow, which
means staff never handle client credentials.

### Before/after records

A `ClientPhotoSet` groups the photographs for one treatment, and photos hang off it with a
`phase` of `BEFORE` or `AFTER`.

The pair is modelled as a document rather than as two loose images because the context belongs
to the pair: the treatment, the date, and above all the **consent**. `consentToPublish` defaults
to `false` and is stamped with `consentRecordedAt` only when it is actually granted —
photographing a client for their file is not permission to show them publicly. Consent recorded
per photo could let a "before" and its "after" disagree.

### Files

Any client can carry documents — consent forms, patch-test records, scans. Photos and documents
share one `ClientAsset` collection because their lifecycle is identical; only `kind` differs.

### How the bytes are handled

| Concern            | Approach                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| Where files live   | A `StorageAdapter` interface; `local` writes to `UPLOAD_DIR`. Swap the driver for S3/Cloudinary without touching a controller, model or route. |
| Stored names       | `<yyyy>/<mm>/<uuid><ext>` — never derived from the uploaded filename, which is kept as metadata only. |
| Type checking      | **Magic bytes**, not the extension or the browser's `Content-Type`. Both are attacker-controlled; a `.jpg` that is really HTML is the classic stored-XSS vector. JPEG, PNG, WebP and PDF are accepted; photo routes reject non-images. |
| Reading files back | There is **no static file route**. Bytes stream from `/admin/assets/:id/file` behind the admin guard, marked `private, no-store` and `nosniff`. Guessing a path reaches nothing. |
| In the browser     | Because the access token lives in memory rather than a cookie, an `<img src>` would arrive unauthenticated. `AuthImage` fetches the blob through the API client and renders an object URL, revoking it on unmount. |
| Write ordering     | Bytes first, then the row; a failed insert removes the stored object, so a failed upload never leaves an orphan. Deleting a record removes its photographs and their bytes together. |
| Size               | Capped by `MAX_UPLOAD_MB` (default 15); reel videos by `MAX_VIDEO_UPLOAD_MB` (default 80). |
| Reel videos        | Public marketing clips, so they take the opposite route to client media: stored under `public/videos`, served unauthenticated from `/api/media/video/…` with `Accept-Ranges` so the player can seek, and cached `immutable`. Accepted formats are MP4 (an allowlist of ISO brands, so a renamed `.mov` is refused) and WebM. |

> **Deployment note:** the `local` driver writes to the API container's own disk. On hosts with
> ephemeral filesystems (Render, Railway, Fly without a volume) uploads are lost on redeploy —
> attach a persistent volume, or implement the adapter against object storage.

---

## Frontend routes

| Area   | Routes                                                                                     |
| ------ | ------------------------------------------------------------------------------------------ |
| Public | `/`, `/services`, `/services/:slug`, `/about`, `/gallery`, `/faq`                          |
| Auth   | `/login`, `/register`, `/forgot-password`, `/reset-password`                                 |
| Client | `/app`, `/app/book`, `/app/appointments`, `/app/appointments/:id`, `/app/profile`, `/app/notifications` |
| Admin  | `/admin`, `/admin/calendar`, `/admin/appointments[/:id]`, `/admin/clients[/:id]`, `/admin/services`, `/admin/availability`, `/admin/gallery`, `/admin/instagram`, `/admin/settings` |

`/booking` is the landing page's CTA target: it forwards to the booking flow, and the route guard
sends unauthenticated visitors through sign-in first, returning them to booking afterwards.

Every route except the landing page is lazily loaded, so the marketing site never downloads the
admin dashboard.

---

## PWA installation

The client app is a real PWA: `manifest.webmanifest`, a Workbox service worker, maskable icons,
`display: standalone`, and `start_url: /app` so the installed icon opens straight into booking.

- **Android / Chrome / Edge** — the app captures `beforeinstallprompt` and offers an *Install*
  banner inside `/app`; also available from Profile.
- **iOS Safari** — no install event exists, so the UI shows the manual *Share → Add to Home Screen*
  hint instead.

Caching is deliberate: the app shell is precached, the read-only catalogue and gallery use
network-first (fresh online, readable offline), and **no authenticated or mutating request is ever
cached**. `navigateFallbackDenylist` keeps `/api` out of the SPA fallback.

The service worker only runs in a production build:

```bash
npm run build --workspace frontend
npm run preview --workspace frontend
```

Icons and placeholder imagery are generated, not committed as opaque binaries:

```bash
cd frontend
node scripts/generate-placeholders.mjs   # abstract brand-coloured SVGs
node scripts/generate-icons.mjs          # PNG monogram icon set
```

Replace both with real Nurella artwork when it is available.

---

## Design system

One brand, three experiences. Tokens live in
[`frontend/src/styles/tokens.css`](frontend/src/styles/tokens.css): palette, fluid type scale,
spacing, radii, shadows, motion and status colours. `components.css` defines every reusable
surface (buttons, fields, cards, badges, dialogs, tables, toasts, states) once.

- **Landing** — editorial and generous: full-bleed hero with subtle parallax, scroll reveals,
  serif display type.
- **Client PWA** — mobile-first, thumb-friendly bottom tab bar, 44px+ touch targets, safe-area
  aware.
- **Admin** — dense and functional: sidebar, tables, day/week/month calendar that becomes a list on
  mobile rather than a squeezed grid.

Accessibility is built into the primitives: `Field` wires label/hint/error with the right ARIA
relationships, `Dialog` traps focus and restores it on close, one focus ring is used everywhere,
and every animation collapses under `prefers-reduced-motion`.

---

## Search and AI discoverability (GEO)

The public site is built to be readable and quotable by AI assistants (ChatGPT, Claude, Gemini,
Perplexity) as well as by search engines. Full detail in [`docs/GEO.md`](docs/GEO.md); the manual
NAP checklist is in [`docs/GEO-NAP-AUDIT.md`](docs/GEO-NAP-AUDIT.md).

- **Structured data** — one `BeautySalon` entity site-wide, plus `Service` per treatment, `ItemList`
  on `/services`, `FAQPage` on `/faq`, `AboutPage`, `WebSite` and `BreadcrumbList`. Built by
  [`frontend/src/lib/geo.js`](frontend/src/lib/geo.js), which the app and the build scripts share.
- **`/faq`** — 21 questions phrased the way people ask an assistant, answered in 2–4 sentences.
  Questions that depend on unpublished facts (address, phone, hours) stay unpublished until those
  facts are configured.
- **Fact-first pages** — every treatment and category opens with what it is, who it's for, what it
  addresses, how long it takes and what it costs, before any marketing copy.
- **Pre-rendering** — `npm run build` writes a real HTML file per public route containing that
  route's metadata, JSON-LD and a plain-text copy of its facts, because most AI crawlers do not run
  JavaScript. The fallback lives inside `#root`, which React clears on first render, so nothing is
  hidden and crawlers and people see the same content.
- **`robots.txt` / `sitemap.xml` / `llms.txt`** — generated by
  [`frontend/scripts/generate-geo.mjs`](frontend/scripts/generate-geo.mjs) from the same content and
  the live catalogue. Edit the script, not the generated files.

The same rule as the rest of the project applies: **nothing is invented**. Address, phone, hours and
prices are absent from the markup until they are configured, rather than filled with a plausible
value an assistant would then repeat.

---

## Security

- Passwords hashed with bcrypt (cost 12); the hash is `select: false` and stripped from every
  serialised response.
- Short-lived access token held **in memory only** (never `localStorage`, so XSS cannot read it),
  with the refresh token in an `httpOnly` cookie. Concurrent 401s share a single refresh request.
- `tokenVersion` invalidates every outstanding session on logout and on password change.
- Registration always creates a `CLIENT` — the public API cannot mint an admin.
- Role checks gate the whole `/api/admin` surface; ownership is re-checked in the service layer, so
  one client can never read another's appointment.
- Login answers identically for "unknown email" and "wrong password", so accounts cannot be
  enumerated; password reset does the same.
- Every request body, query and param is parsed by a Zod schema that **replaces** the request data
  with validated primitives. A payload such as `{ "email": { "$ne": null } }` fails validation
  before it can reach a query — which is also why Mongoose's blunt global `sanitizeFilter` is
  deliberately off (it would break the calendar's legitimate `$gt`/`$lt` range queries).
- Uploaded client media is never served statically: bytes stream through an admin-guarded route
  with `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. File types are
  identified by magic bytes rather than the extension or the browser-supplied `Content-Type`, and
  stored filenames are UUIDs so an uploaded name can never influence the path written to.
- Helmet, an explicit CORS allow-list, and tiered rate limits (general / auth / booking).
- Sensitive keys are redacted centrally before anything is logged; stack traces never appear in
  production responses.

---

## Production build and deployment

```bash
npm run build        # backend → backend/dist, frontend → frontend/dist
npm start            # runs the compiled API
```

Deployment checklist:

1. **Set `LOUNGE_TIMEZONE`.** The default `UTC` will show wrong times; the server logs a warning at
   boot and the admin Settings page flags it.
2. Set strong, distinct `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
3. Change the seeded admin password.
4. Serve `frontend/dist` as a static SPA with a catch-all rewrite to `index.html`.
5. Point `VITE_API_URL` at the API and add the web origin to `CLIENT_URL` / `CORS_ORIGINS`.
6. **Serve over HTTPS.** In production the refresh cookie is `Secure; SameSite=None`, which
   browsers reject over plain HTTP — and a PWA will not install without TLS.
7. Set `VITE_SITE_URL` to the production origin and `GEO_API_URL` to the production API, then
   rebuild — `robots.txt`, `sitemap.xml`, `llms.txt` and the pre-rendered pages are generated from
   them. The static host must resolve `dist/<route>/index.html` before the SPA catch-all, or the
   pre-rendered pages are never served. See [`docs/GEO.md`](docs/GEO.md).
8. `autoIndex` is disabled in production; run `npm run seed` once against the production database
   so indexes (notably the unique `slotlocks` index) exist.
9. Put the API behind a reverse proxy — `trust proxy` is enabled in production so rate limiting sees
   real client IPs.

Notifications are in-app today. The schema already carries `channels` and per-channel `deliveries`
rows, so email / SMS / WhatsApp / push become a worker that drains `PENDING` deliveries — no schema
change. No external provider is wired in, because no credentials were supplied.

---

## Content rules and placeholders

All 46 service names come from the brief and are reproduced **exactly**, including entries that
legitimately appear in more than one category (`Hifu` under Laser and `HIFU` under Advanced Skin
Treatments; `manicure` under Nails and `Manicure` under Beauty & Nails). Landing page copy lives in
[`frontend/src/content/brand.ts`](frontend/src/content/brand.ts) verbatim.

Nothing was invented to fill a gap. What is deliberately missing:

| Item                        | Status                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| **Prices**                  | None set. The UI omits price entirely until an admin configures one.    |
| **Service durations**       | Seeded with a **placeholder 60 minutes**. The booking engine needs a duration, so a single honest placeholder is used rather than guessing each treatment. **Set the real durations in Admin → Services.** |
| **Working hours**           | An **example** schedule (Mon–Sat) is seeded so the engine has something to work with. Configure the real one in Admin → Availability. |
| **Address, phone, email**   | Not present. Configurable via `VITE_BUSINESS_*` in `frontend/.env`; until set they are omitted from the footer, the structured data, the FAQ and `llms.txt` rather than guessed. See [`docs/GEO-NAP-AUDIT.md`](docs/GEO-NAP-AUDIT.md). |
| **Staff, reviews, statistics** | Not present. Reviews have a home (`reviews` in `frontend/src/content/geo/business.json`) that drives both the on-page section and the `Review`/`AggregateRating` markup — empty until real ones exist. |
| **Photography**             | Generated abstract brand-coloured placeholders, each labelled as such.  |

The outstanding items are also listed in `MISSING_INFORMATION` and surfaced on the admin **Settings**
page, so they are visible in the product rather than buried in a README.

Demo bookings created by `npm run seed:demo` are tagged `[DEMO DATA — development only]`, use a
clearly fictional client (`Demo Client (development data)`), and the seed refuses to create them
when `NODE_ENV=production`.
