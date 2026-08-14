# WhatsApp AI Assistant — Technical Build Spec

Give this file to Claude (or any dev) together with your website codebase. It describes exactly what to build.

> **Status: implemented.** See [Implementation notes](#implementation-notes-nurella) at the end of this
> document for what was built, where it lives, and the three places the running code deliberately
> differs from the spec below.

## Goal

Add a WhatsApp AI assistant that:
1. Answers customer questions — ONLY about this business (services, prices, hours, location, FAQs).
2. Takes appointment bookings through natural conversation.
3. Runs on WhatsApp Business Cloud API (Meta) + Gemini (Google AI).
4. Connects to the existing website via a "Chat on WhatsApp" button.

## Stack

- Backend: Node.js + Express (add to existing backend, or new small service)
- Database: MongoDB (existing DB or new collection)
- AI: Google Gemini API (`gemini-2.0-flash` model)
- Messaging: Meta WhatsApp Business Cloud API

## Required environment variables

```
MONGO_URI=
WA_TOKEN=              # Meta permanent access token
WA_PHONE_NUMBER_ID=    # from Meta developer app
WA_VERIFY_TOKEN=       # any string I choose myself
GEMINI_API_KEY=        # from Google AI Studio
GEMINI_MODEL=gemini-2.0-flash
```

## Data models (MongoDB)

**BusinessProfile** (one document — my business info)
- name, description, hours, location
- services: [{ name, price, durationMinutes }]
- faqs: [{ q, a }]

**Conversation** (one per customer phone number)
- customerPhone
- history: [{ role: "user"|"model", text, at }]
- keep only last ~20 messages per conversation (cost control)

**Appointment**
- customerPhone, customerName, service, requestedDate, requestedTime
- status: pending / confirmed / cancelled

## Endpoints

**GET /webhook** — Meta calls this once to verify the webhook. Must echo back `hub.challenge` if `hub.verify_token` matches `WA_VERIFY_TOKEN`.

**POST /webhook** — Meta calls this on every incoming WhatsApp message.
1. Respond `200` immediately (Meta requires a response within 20 seconds — do the real work after).
2. Extract sender phone + message text from the payload.
3. Load `BusinessProfile` and the customer's `Conversation` history.
4. Call Gemini with:
   - A system prompt built from BusinessProfile (services/hours/FAQs).
   - Hard rule: only answer questions about this business — redirect anything else.
   - A function/tool definition `book_appointment(service, date, time, name)` that Gemini calls once it has collected all four fields.
5. If Gemini calls `book_appointment`, save it to the `Appointment` collection.
6. Save the new turn to `Conversation.history`.
7. Send the AI's reply back to the customer via the WhatsApp Cloud API `POST /messages` endpoint.

## Human handoff (AI pauses when staff replies manually)

Add to **Conversation** model:
- `aiPaused: Boolean` (default false)
- `pausedUntil: Date`

Logic in the webhook:
1. Meta's webhook also fires for **outgoing** messages sent from the connected WhatsApp Business number (i.e. staff replying manually from the phone/app). Detect this via the `statuses` or message direction in the payload.
2. When staff sends a manual message to a customer → set that customer's `Conversation.aiPaused = true`, `pausedUntil = now + 30 minutes`.
3. On every incoming customer message: BEFORE calling Gemini, check `aiPaused`.
   - If `aiPaused` is true and `pausedUntil` is still in the future → save the message to history, do NOT call Gemini, do NOT auto-reply. Staff is handling it.
   - If `pausedUntil` has passed → clear `aiPaused`, resume normal AI replies.
4. Optional: let staff type `/resume` as a message to immediately hand back to AI, or `/ai off` to pause indefinitely until manually resumed.

This means: you (or any staff) can jump into any conversation from your phone at any time, reply normally, and the bot goes silent on that customer until you're done.

## Website integration

Add a floating WhatsApp button/link anywhere on the site:

```html
<a href="https://wa.me/<MY_WHATSAPP_NUMBER>?text=Hi" target="_blank">
  Chat with us on WhatsApp
</a>
```

No backend work needed for this part — clicking it opens WhatsApp with a pre-filled message to the business number. The webhook above handles the rest automatically.

## Speed requirements

- Use `gemini-2.0-flash` (not Pro) — it's the fast + cheap tier, replies in ~1-2 seconds.
- Keep conversation history capped at ~20 messages so each request stays small and fast.
- Respond to Meta's webhook with `200` before doing any AI work, so Meta never times out and retries (which would cause duplicate replies).

## Guardrails to implement in the system prompt

1. Only answer about this business — services, pricing, hours, location, booking.
2. Never invent prices or services not listed in BusinessProfile.
3. Keep replies short (1-4 sentences) — this is WhatsApp, not email.
4. Never say a booking is "confirmed" — only that the request was received, staff will confirm.
5. Collect service + date + time + name before calling `book_appointment`.

## Multi-tenant architecture (multiple clients, one platform)

This lets you run the same platform for multiple businesses, each with their own WhatsApp number, from one codebase/deployment.

**Key change:** everything gets scoped by `WA_PHONE_NUMBER_ID` (which client's WhatsApp number received the message), not just phone number.

**BusinessProfile** — add:
- `phoneNumberId` (the client's `WA_PHONE_NUMBER_ID`, unique per client)
- `wabaId` (their WhatsApp Business Account ID)
- `accessToken` (if each client's number has its own token — see below)

**Conversation** — add:
- `phoneNumberId` — so the same customer messaging two different client businesses doesn't get mixed history. Unique index becomes `{ customerPhone, phoneNumberId }`, not just `customerPhone`.

**Appointment** — add:
- `phoneNumberId` — so bookings are scoped per client.

**Webhook logic change:**
Every incoming Meta payload includes `metadata.phone_number_id` — this tells you which client's number the message came in on. Use it to:
1. Look up the right `BusinessProfile` for that client.
2. Look up/create the right scoped `Conversation`.
3. Send the reply using that client's token/number, not a global one.

**Two ways to onboard client numbers:**

- **Option A — Manual (fine for a handful of clients):** you add each client's phone number under your one Meta app yourself (repeat the setup guide's Step 3 per client). All numbers share your one `WA_TOKEN` (System User token) as long as it has access to all of them via Business Manager.
- **Option B — Embedded Signup (for scaling to many self-service clients):** Meta provides a "Facebook Login for Business" flow where each client connects their own WhatsApp number directly through a popup on your website — no manual work per client. Requires additional Meta app review/approval. Worth building once you're past ~5-10 clients.

**Billing note:** with multiple clients on one Gemini API key, track token usage per `phoneNumberId` in your logs so you know each client's actual AI cost — useful if you're charging clients a subscription and want to know your margin.

## Production-readiness checklist (must-have, not optional)

These are the things that separate a demo bot from one that won't embarrass you in front of a real client.

**1. Webhook signature verification**
Verify every incoming webhook request is actually from Meta (using `X-Hub-Signature-256` header + your app secret), not a spoofed request. Reject anything that doesn't match.

**2. Message deduplication**
Meta sometimes sends the same webhook event twice (retries). Store the Meta `message.id` and skip if already processed — otherwise the bot can reply twice to one message.

**3. Error handling + fallback reply**
If Gemini API fails or times out (rare, but happens), don't leave the customer hanging. Catch the error and send a fallback: *"Sorry, having a technical hiccup — a team member will follow up shortly."* Log the failure so you know it happened.

**4. Rate limiting per customer**
Cap how many AI calls one phone number can trigger per minute (e.g. 10). Stops abuse/spam from blowing up your Gemini bill or looking broken under a flood of messages.

**5. Typing indicator / read receipts**
Mark incoming messages as "read" via the Cloud API as soon as they arrive. Makes the bot feel responsive instead of ignoring the customer while it "thinks."

**6. 24-hour session window handling**
WhatsApp only lets you send free-form replies within 24h of the customer's last message. If a customer goes quiet and you need to follow up later (e.g. appointment reminder), you must use a pre-approved **template message** — regular AI replies won't send. Build appointment reminders using approved templates, not the AI chat path.

**7. Logging**
Log every conversation (already stored in Mongo) plus every error, with timestamps. If a client says "the bot said something wrong," you need to pull up exactly what happened.

**8. Appointment conflict checking**
Before saving a booking as anything beyond "pending," check no other appointment already exists at that service+date+time. Otherwise you'll double-book.

**9. Timezone handling**
Store and confirm appointment times in one clear timezone (yours), and have the AI state the timezone in its confirmation message to avoid mismatched expectations.

**10. Data privacy**
Customer phone numbers + conversation history are personal data. Don't expose the DB publicly, use HTTPS everywhere, and have a basic policy on how long you keep conversation history (e.g. auto-delete after 6-12 months).

**11. Monitoring / uptime**
Use a free uptime monitor (e.g. UptimeRobot) pinging your server every few minutes, with an alert (email/SMS) if it goes down — so you know before a client tells you the bot stopped responding.

**12. Testing before going live**
Test with: normal questions, off-topic questions (should redirect), a full booking flow, a manual staff takeover, and a deliberately broken message (emoji-only, empty, very long) — make sure nothing crashes.

## Where credentials come from

- `GEMINI_API_KEY` → Google AI Studio (aistudio.google.com/apikey)
- `WA_TOKEN`, `WA_PHONE_NUMBER_ID` → Meta for Developers app (developers.facebook.com), WhatsApp product
- `WA_VERIFY_TOKEN` → any random string I pick myself, used only to verify the webhook belongs to me

See `whatsapp-setup-guide.md` for the exact click-by-click steps for these.

---

# Implementation notes (Nurella)

Everything above is built. This section records where it lives and — more importantly — the three
places the code deliberately differs from the spec, because Nurella is not a greenfield project: it
already has a booking engine, a calendar, a client database and an admin dashboard, and the
assistant had to plug into those rather than run beside them.

## Where the code lives

| Concern | File |
| --- | --- |
| Environment | [backend/src/config/env.ts](../backend/src/config/env.ts) — `WA_*`, `GEMINI_*`, `env.whatsappEnabled` |
| Business facts | [backend/src/models/BusinessProfile.ts](../backend/src/models/BusinessProfile.ts) |
| Chat history + handoff | [backend/src/models/Conversation.ts](../backend/src/models/Conversation.ts) |
| Dedup + outbound ledger | [backend/src/models/WhatsAppMessageLog.ts](../backend/src/models/WhatsAppMessageLog.ts) |
| Cloud API (send / read / signature) | [backend/src/services/whatsapp/cloudApi.ts](../backend/src/services/whatsapp/cloudApi.ts) |
| Gemini REST + function calling | [backend/src/services/whatsapp/gemini.ts](../backend/src/services/whatsapp/gemini.ts) |
| System prompt builder | [backend/src/services/whatsapp/prompt.ts](../backend/src/services/whatsapp/prompt.ts) |
| `check_availability` / `book_appointment` | [backend/src/services/whatsapp/tools.ts](../backend/src/services/whatsapp/tools.ts) |
| Conversation store + pause rules | [backend/src/services/whatsapp/conversation.ts](../backend/src/services/whatsapp/conversation.ts) |
| Orchestrator | [backend/src/services/whatsapp/assistant.ts](../backend/src/services/whatsapp/assistant.ts) |
| Webhook | [backend/src/controllers/whatsapp.controller.ts](../backend/src/controllers/whatsapp.controller.ts), [backend/src/routes/whatsapp.routes.ts](../backend/src/routes/whatsapp.routes.ts) |
| Profile sync script | [backend/src/scripts/syncBusinessProfile.ts](../backend/src/scripts/syncBusinessProfile.ts) |
| Floating button | [frontend/src/components/ui/WhatsAppButton.tsx](../frontend/src/components/ui/WhatsAppButton.tsx) |

Webhook URL: **`https://<your-domain>/api/whatsapp/webhook`** (GET to verify, POST for events).

## Deviation 1 — bookings land in the real `Appointment` collection

The spec describes a standalone `Appointment` document holding `customerPhone`, `customerName`,
`service`, `requestedDate`, `requestedTime`. Nurella already has an `Appointment` model that the
calendar, the admin queue, the client PWA and the slot-lock index all read from.

Writing WhatsApp bookings to a second collection would have produced two queues nobody reconciles
and, worse, bookings that do not hold a slot — so the calendar would happily hand the same 14:00 to
a website client and a WhatsApp client on the same afternoon.

So `book_appointment` calls the existing `createBooking()` service instead. That means a WhatsApp
booking:

- is checked against opening hours, breaks, blocked periods, per-treatment weekday restrictions and
  the minimum-notice window — the same authority the website uses (checklist item 8);
- claims a slot lock, so it cannot be double-booked;
- lands as `PENDING` and notifies the lounge, exactly like a website request — which is what makes
  guardrail 4 ("never say confirmed") true rather than just instructed;
- shows up in the existing admin dashboard with no new screen to build.

The customer is matched to a `User` by phone number, and a client record is created for them if this
is their first contact. `clientNotes` records that the request arrived over WhatsApp.

## Deviation 2 — a second tool, `check_availability`

The spec defines one tool. A model with only `book_appointment` has to *guess* which times exist,
and a bot that offers 15:00 to a customer and then refuses it is worse than one that says nothing.

`check_availability(service, date)` returns the day's real open slots from the same availability
engine. The system prompt forbids naming a time that did not come out of this tool, which is
guardrail 2 ("never invent") applied to times as well as prices.

## Deviation 3 — `MONGO_URI` is the existing `MONGODB_URI`

One database, one connection string. The assistant's collections live alongside the rest.

## Multi-tenancy: scoped, not yet self-service

Everything is keyed by `phone_number_id` as the spec describes — `BusinessProfile` is looked up by
it, `Conversation` is uniquely indexed on `{ phoneNumberId, customerPhone }`, and replies are sent
with that profile's own `accessToken` when it has one, falling back to `WA_TOKEN`. That is Option A
(manual onboarding) working today; Option B (Embedded Signup) is a Meta app-review exercise, not a
code change here.

Appointments are **not** scoped by `phoneNumberId` — they belong to Nurella's calendar, which is
single-tenant by construction. A second business joining the platform would need its own deployment
or a tenant column across the booking engine; that is a much larger change than the assistant.

Gemini token usage is logged per `phoneNumberId` on every call (`WhatsApp AI turn`), so per-client
cost is a log query.

## Checklist status

| # | Item | Where |
| --- | --- | --- |
| 1 | Signature verification | `cloudApi.verifySignature`, enforced in the route when `WA_APP_SECRET` is set |
| 2 | Deduplication | `WhatsAppMessageLog`, unique index on `messageId` |
| 3 | Fallback reply | `assistant.ts` — any thrown error sends the hiccup message and logs |
| 4 | Per-customer rate limit | `assistant.ts` — sliding window, `WA_RATE_LIMIT_PER_MINUTE` (default 10) |
| 5 | Read receipt + typing | `cloudApi.markRead`, best-effort, fired before the AI call |
| 6 | 24-hour window | Documented below — the assistant only ever *replies*, so it stays inside the window by construction |
| 7 | Logging | Every turn, every tool call and every failure through the app's `logger` |
| 8 | Conflict checking | The existing availability engine + slot locks (see Deviation 1) |
| 9 | Timezone | `LOUNGE_TIMEZONE`; the prompt states today's date and the zone, and the reply names it |
| 10 | Retention | TTL index on `Conversation.lastMessageAt`, `WA_HISTORY_RETENTION_DAYS` (default 365) |
| 11 | Monitoring | Point UptimeRobot at `/api/health` — it already reports database state |
| 12 | Testing | Test script in the setup guide |

### On item 6 (the 24-hour window)

Nothing in this feature sends an unprompted message: every WhatsApp send is a reply to a customer
message that arrived seconds earlier, so the free-form window is always open. Appointment reminders
are a separate feature and **must** use an approved template — do not route them through
`sendText()`.

## Operating it

```bash
# Build the BusinessProfile from the live catalogue, working hours and env.
npm run whatsapp:profile --workspace backend            # dry run — prints what it would write
npm run whatsapp:profile:apply --workspace backend      # writes it

# Re-run after changing services or opening hours; it is idempotent.
```

Staff commands, typed into the WhatsApp Business app inside a customer thread:

| Typed by staff | Effect |
| --- | --- |
| *(any normal message)* | Pauses the AI on that thread for `WA_HANDOFF_MINUTES` (default 30) |
| `/ai off` | Pauses indefinitely, until someone types `/resume` |
| `/resume` or `/ai on` | Hands the thread straight back to the AI |

Staff commands are only readable when the Meta app is subscribed to the **`message_echoes`** webhook
field. Without it the takeover still works — a manual reply is detected from the `statuses` event
instead — but `/resume` and `/ai off` cannot be seen, and a paused thread simply resumes when the
timer expires. See the setup guide.
