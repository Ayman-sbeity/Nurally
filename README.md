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
- [Signing in](#signing-in)
- [Staff and permissions](#staff-and-permissions)
- [Map and Google Maps visibility](#map-and-google-maps-visibility)
- [PWA installation](#pwa-installation)
- [Push notifications](#push-notifications)
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
| `npm run push:keys --workspace backend` | Print a VAPID key pair for push notifications      |
| `npm run audit:permissions --workspace backend` | Print the permission guarding every admin route; fails if one is ungated |

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
| `VAPID_PUBLIC_KEY`          | Web Push key pair — optional; blank keeps notifications in-app only    |
| `VAPID_PRIVATE_KEY`         | See [Push notifications](#push-notifications); never commit this       |
| `VAPID_SUBJECT`             | Contact the push service can reach you at (`mailto:` or `https:`)      |

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
| POST   | `/api/notifications/:id/read`         | Mark one read               |
| POST   | `/api/notifications/read-all`         | Mark all read               |
| GET    | `/api/notifications/push/config`      | VAPID key + devices count   |
| POST   | `/api/notifications/push/subscribe`   | Register this device        |
| POST   | `/api/notifications/push/unsubscribe` | Unregister this device      |
| POST   | `/api/notifications/push/test`        | Send yourself a test push   |

### Admin (owner, or staff with the matching permission)

`GET /api/admin/dashboard` · `/calendar` · `/appointments` · `/appointments/:id` ·
`/clients` · `/clients/:id` — and the actions
`approve`, `reject`, `offer-time`, `reschedule`, `approve-reschedule`, `complete`, `no-show`,
`cancel`; plus service, availability (`working-hours`, `blocked`) and gallery management.

Every one of these carries a `resource:action` permission — run
`npm run audit:permissions --workspace backend` to print the full table. Staff management is
owner-only:

| Method   | Route              | Purpose                                    |
| -------- | ------------------ | ------------------------------------------ |
| `GET`    | `/admin/staff`     | The team, plus the permission vocabulary    |
| `POST`   | `/admin/staff`     | Create an employee account                  |
| `PATCH`  | `/admin/staff/:id` | Rename, reset password, change access       |
| `DELETE` | `/admin/staff/:id` | Remove an employee                          |

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
| Admin  | `/admin`, `/admin/calendar`, `/admin/appointments[/:id]`, `/admin/clients[/:id]`, `/admin/services`, `/admin/availability`, `/admin/gallery`, `/admin/instagram`, `/admin/staff`, `/admin/settings` |

`/booking` is the landing page's CTA target: it forwards to the booking flow, and the route guard
sends unauthenticated visitors through sign-in first, returning them to booking afterwards.

Every route except the landing page is lazily loaded, so the marketing site never downloads the
admin dashboard.

---

## Signing in

Clients sign in with their **phone number**. It is the one identifier every client has — several are
booked in at the desk with nothing else — so it is required at sign-up, while email is optional and
used only for appointment updates.

| Flow | Identifier |
| ---- | ---------- |
| Client sign-up | Phone (required) · email optional |
| Sign-in | Phone for clients, email for staff and the owner — one field accepts either |
| Forgot password | Handled by the lounge, see below |

### Forgot password

**There is no self-service reset, by design.** The server has no SMS provider and no mail transport,
so a form promising a code or a link would collect an identifier and send nothing.

Instead the client contacts the lounge, and staff reset it from **Admin → Clients → *client* →
Reset password**. That sets a temporary password and shows it once, to be read out over the phone.
The client signs in with it and changes it under Profile → Password.

The temporary password is 12 characters from a 55-character alphabet (~69 bits) with `0/O` and
`1/l/I` removed so it cannot be misheard or mistyped. It is **returned in the response and stored
nowhere** — not logged, not persisted in plaintext — so the dialog that displays it is the only
place it ever exists. Resetting also bumps the client's token version, ending every session they
had open: if the reason they cannot sign in is that somebody else can, this closes that door.

Requires the `CLIENTS:EDIT` permission — an employee trusted to change a client's record is trusted
to help them back into it.

> To move to a real self-service reset later, add an SMS or mail transport. The token endpoints
> (`/api/auth/forgot-password`, `/api/auth/reset-password`) are intact and already generate and
> verify single-use, expiring tokens — only delivery is missing.

---

## Staff and permissions

The lounge owner can give employees their own sign-in and choose, per person, which admin sections
they may open and what they may do in each.

### Roles

| Role     | Home     | Access                                                              |
| -------- | -------- | ------------------------------------------------------------------- |
| `CLIENT` | `/app`   | Their own appointments only                                          |
| `STAFF`  | `/admin` | Exactly the sections granted to them, nothing else                   |
| `ADMIN`  | `/admin` | Everything, unconditionally — the owner. Cannot be limited or deleted |

### Granting access

**Admin → Staff → Add team member.** Each section gets a row with four checkboxes:

| Action     | Means                                                             |
| ---------- | ----------------------------------------------------------------- |
| **View**   | The section appears in their sidebar and opens                     |
| **Add**    | They may create records in it                                      |
| **Edit**   | They may change existing records                                   |
| **Delete** | They may remove records                                            |

View is the hinge: clearing it drops the whole section, and ticking any write action turns View on
with it — a section that cannot be opened but can be written to is not a state worth expressing.
Overview, Calendar and Settings are read-only projections, so they offer View alone.

Appointments read a little differently, because a booking is never deleted: **Add** books clients
in, **Edit** approves, offers times, reschedules and completes, and **Delete** cancels. That split
lets an employee run the front desk without being able to call off a booking.

### Where it is enforced

Server-side, on every request. Each admin route declares a `resource:action` pair, checked against
the caller's grants before the handler runs:

```bash
npm run audit:permissions --workspace backend   # prints the guard on all 53 admin routes
```

The audit **exits non-zero if any admin route is left ungated**, so a route added later without a
permission cannot quietly ship. The two documented exceptions are the media uploaders, which write
to the public artwork area and return a URL the destination record's own permission then governs.

The admin UI hides what an employee cannot use — sidebar entries, buttons, whole pages — but that
is a courtesy, not the protection. A stale bundle or a hand-made request gains nothing.

Two things deliberately cannot be delegated:

- **Staff management is owner-only.** Anyone who can edit staff can grant themselves everything
  else, so this is the one section with no permission to hand out — otherwise the lock would be
  kept beside its key.
- **The owner account cannot be limited, deactivated or deleted**, by itself or anyone else. An
  account that could lock itself out of its own lounge is a worse failure than any it prevents.

Changing an employee's access or deactivating them **bumps their token version**, which ends every
session they have open. Narrowing permissions has to reach someone already signed in, or a
mid-shift change would not take effect until their token happened to expire.

### What staff see

Booking alerts fan out to the owner and to any employee granted `APPOINTMENTS:VIEW` — filtered by
permission rather than role, so someone who only maintains the gallery is not told a named client's
treatment. Their own name is recorded in appointment history, and stays there after they leave.

Settings is reachable by every employee regardless of grants: it is where they turn on their own
[push notifications](#push-notifications) and see their own account. The `SETTINGS` permission
gates the booking-engine panel inside it.

---

## Map and Google Maps visibility

### On the site

A **Visit us** section appears on the landing page and `/about`: address, phone, opening hours, a
**Get directions** button, and an embedded Google map.

It renders only once an address or coordinates are configured, and is omitted entirely otherwise —
the same rule the rest of the content follows. Nothing about the lounge is invented.

The map is **click-to-load**. Embedding Google's iframe directly would put a third-party request,
its cookies and around a megabyte of script on the first paint of the landing page, paid by every
visitor including the majority who never look at the map. A styled placeholder takes its place and
the real map loads on click, in the same footprint so nothing shifts.

Directions point at `VITE_BUSINESS_MAP_URL` (or `VITE_GOOGLE_BUSINESS_URL`) when set, falling back
to a coordinate pin. Prefer the real listing URL: it opens the profile with its reviews and photos,
and every visit is a signal that the listing is the genuine one.

### Being found *in* Google Maps

**This part is not a code task, and the site cannot do it.** Appearing in Maps at all requires a
**Google Business Profile** that has been created and verified — until then the lounge does not
exist as a place, and no amount of markup on this site substitutes for it.

What the site already contributes, once the env vars are filled:

| Signal | Where it comes from |
| ------ | ------------------- |
| `BeautySalon` structured data with `address`, `geo`, `telephone`, `openingHoursSpecification` | `src/lib/geo.js` → `businessSchema()` |
| `hasMap` pointing at the lounge's own listing | `VITE_BUSINESS_MAP_URL` |
| `sameAs` linking Instagram / Facebook / the Google listing — how a search engine confirms these are one business | `VITE_*_URL` |
| A visible, crawlable NAP block in the footer of every page | `VITE_BUSINESS_*` |

The order that actually works:

1. **Create and verify the Google Business Profile** at
   [business.google.com](https://business.google.com) — pick the right primary category, add real
   photos and the true opening hours. Verification is by postcard, phone or video and is the step
   that takes real time.
2. **Fill `frontend/.env`** with the *same* address and phone, written exactly as on the profile —
   see [`docs/GEO-NAP-AUDIT.md`](docs/GEO-NAP-AUDIT.md). A suite number that differs by a comma is
   enough to split one business into two weaker entities.
3. **Set `VITE_GOOGLE_BUSINESS_URL` and `VITE_BUSINESS_MAP_URL`** to the listing, then rebuild.
4. **Ask happy clients for reviews.** Reviews and profile completeness drive Maps ranking far more
   than anything on the website.

Steps 2 and 3 are the whole of the code side, and they are one file.

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

## Push notifications

The lounge's phone rings when a client books, even with the app closed. Delivery is
[Web Push](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) with VAPID — no Firebase
account, no third-party service, no per-message cost.

Every notification the app already created in-app now also goes out as a push: a new booking
request fans out to all admins, and confirmations, offers, reschedules and cancellations go to
the client. Push is layered onto the existing `Notification` record rather than living beside it,
so the in-app inbox and the device alert can never disagree.

### Setup

```bash
npm run push:keys --workspace backend   # prints a VAPID key pair
```

Add the pair to `backend/.env` and restart the API:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

Then open **Admin → Settings → Push notifications** and press *Turn on notifications*, once per
device. *Send a test* confirms it works without waiting for a real booking. Clients get the same
switch on their Profile page.

Leaving the keys blank is a supported state: push is skipped and notifications stay in-app only.

> **Keep the key pair stable.** The public key is baked into every subscription already handed
> out, so rotating it silently invalidates every device and each must re-enable.

### Requirements

| Platform                       | Works                                                      |
| ------------------------------ | ---------------------------------------------------------- |
| Android Chrome / Edge / Firefox | Yes, in the browser or installed                           |
| Desktop Chrome / Edge / Firefox | Yes                                                        |
| **iOS / iPadOS 16.4+**          | **Only in an installed PWA** — Share → Add to Home Screen   |

Two more constraints worth knowing: the page must be served over **HTTPS** (localhost is exempt),
and the service worker is only built for production, so `npm run dev` cannot show a push. Test with
`npm run build --workspace frontend && npm run preview --workspace frontend`.

### How it works

- `PushSubscription` stores one row per device, keyed by its endpoint — the owner may have the
  admin open on a phone and a laptop, and both ring.
- `push.service.ts` sends to every device, with a 5s timeout so a slow push service can never
  stall the booking request that triggered it, and a 24h TTL so a phone that was off overnight
  still receives it.
- Endpoints that answer `404`/`410` are permanently gone (permission revoked, app uninstalled) and
  are deleted on the spot, so dead devices never accumulate.
- Push handlers live in [`frontend/public/push-sw.js`](frontend/public/push-sw.js), imported into
  the generated Workbox worker via `workbox.importScripts` — the caching rules stay generated.
- A tapped notification focuses an already-open window and navigates it to the appointment,
  rather than opening a second copy of the app.

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
