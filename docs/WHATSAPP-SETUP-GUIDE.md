# WhatsApp AI Assistant — setup guide

Click-by-click. Companion to [WHATSAPP-AI-ASSISTANT.md](./WHATSAPP-AI-ASSISTANT.md), which describes
what the code does; this describes how to get the credentials it needs and how to go live.

Meta redesigns this dashboard regularly. Wording moves, the order rarely does — if a label below
does not match what you see, look for the nearest equivalent rather than assuming the step is gone.

Budget an hour for a first-time setup, most of it waiting on verification.

---

## What you need before you start

- A Facebook account.
- A phone number that is **not currently registered on WhatsApp** (personal or Business app). If the
  number is already on WhatsApp you must delete that account first, and doing so erases its chat
  history. Most lounges buy a second SIM for this.
- A server reachable over **HTTPS** with a real certificate. Meta will not deliver webhooks to
  `http://`, to an IP address, or to a self-signed certificate. For local development use
  [ngrok](https://ngrok.com) (`ngrok http 5000`) and paste the `https://….ngrok-free.app` URL.

---

## Step 1 — Gemini API key

1. Go to <https://aistudio.google.com/apikey>.
2. Sign in with a Google account.
3. **Create API key** → pick a Google Cloud project (or let it make one).
4. Copy the key. It is shown in full only once.

```
GEMINI_API_KEY=AIza…
GEMINI_MODEL=gemini-2.0-flash
```

The free tier is generous and will cover a small lounge's traffic. Add billing to the Cloud project
before launch anyway — hitting the free-tier ceiling mid-conversation looks exactly like an outage.

---

## Step 2 — Meta app

1. Go to <https://developers.facebook.com> → **My Apps** → **Create App**.
2. Use case: **Other** → app type: **Business** → name it (e.g. `Nurella Assistant`) → create.
3. On the app dashboard, find **WhatsApp** in the product list → **Set up**.
4. It will ask for a **Business portfolio** (Business Manager account). Pick the existing one or
   create it — the lounge's legal business name.

---

## Step 3 — Connect the phone number

Still inside **WhatsApp → API Setup**:

1. You start with a Meta-provided **test number**. Use it for the first end-to-end test; it can only
   message up to 5 numbers you add manually under *"To"*, so add your own phone there.
2. For the real number: **Add phone number** → business display name, category, description → enter
   the number → verify by SMS or voice call.
3. Copy the two identifiers shown on this page:

```
WA_PHONE_NUMBER_ID=123456789012345     # "Phone number ID" — NOT the phone number itself
WA_WABA_ID=987654321098765             # "WhatsApp Business Account ID"
```

> The **Phone number ID** is a numeric id, not `+961…`. Copying the wrong one is the single most
> common setup mistake; sends fail with `(#100) Invalid parameter`.

---

## Step 4 — Permanent access token

The token shown on the API Setup page expires in 24 hours. It is fine for the first test and useless
for production. Make a permanent one:

1. <https://business.facebook.com/settings> → your business → **Users → System users**.
2. **Add** → name it (e.g. `whatsapp-bot`) → role **Admin** → create.
3. **Add assets** → **Apps** → select your app → toggle **Manage app** → save.
4. **Add assets** → **WhatsApp accounts** → select your WABA → toggle **Manage** (grant **full
   control**) → save.
5. Back on the system user → **Generate new token** → select your app → **Token expiration: Never**.
6. Tick the permissions **`whatsapp_business_messaging`** and **`whatsapp_business_management`**.
7. Generate, then copy. **It is shown once.**

```
WA_TOKEN=EAAG…
```

For several client businesses on one platform (Option A in the spec), add each client's WABA as an
asset to this same system user. One token then covers every number.

---

## Step 5 — App secret

Used to verify that incoming webhooks really came from Meta (checklist item 1).

1. App dashboard → **App settings → Basic**.
2. Next to **App secret**, click **Show**, confirm your password, copy it.

```
WA_APP_SECRET=1a2b3c…
```

If you leave this blank the server still runs, logs a warning at boot and accepts unsigned webhooks.
Do not ship to production that way — anyone who learns your webhook URL could feed the bot messages.

---

## Step 6 — Choose your verify token

Any random string. You invent it; it only ever proves that the webhook Meta is calling belongs to
you.

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

```
WA_VERIFY_TOKEN=<paste the output>
```

---

## Step 7 — Fill in `.env` and start the server

In `backend/.env` (see `backend/.env.example` for the annotated block):

```
WA_TOKEN=EAAG…
WA_PHONE_NUMBER_ID=123456789012345
WA_WABA_ID=987654321098765
WA_VERIFY_TOKEN=<your string>
WA_APP_SECRET=1a2b3c…
GEMINI_API_KEY=AIza…
GEMINI_MODEL=gemini-2.0-flash
```

Start it, and confirm the boot log says the assistant is enabled:

```bash
npm run dev:api
# INFO  … WhatsApp assistant enabled (phone number id 123456789012345, model gemini-2.0-flash)
```

If it says *disabled*, one of `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_VERIFY_TOKEN` or
`GEMINI_API_KEY` is missing. The rest of the API is unaffected either way.

---

## Step 8 — Load the business profile

The assistant answers from a `BusinessProfile` document, not from the code. Build it from the live
catalogue and opening hours:

```bash
npm run whatsapp:profile --workspace backend          # dry run, prints what it would write
npm run whatsapp:profile:apply --workspace backend    # writes it
```

Re-run it whenever treatments or opening hours change. It is idempotent — safe to run repeatedly.

To edit the wording, the location line or the FAQs afterwards, edit the `businessprofiles` document
directly (MongoDB Compass, or `mongosh`). The script only overwrites the fields it owns: services,
hours, name and timezone. Your `description`, `location`, `faqs` and `bookingPolicy` edits survive.

---

## Step 9 — Point the webhook at your server

1. App dashboard → **WhatsApp → Configuration** → **Edit** next to Webhook.
2. **Callback URL:** `https://<your-domain>/api/whatsapp/webhook`
3. **Verify token:** the `WA_VERIFY_TOKEN` from Step 6.
4. **Verify and save.** Meta immediately sends a `GET` — your server echoes the challenge back and
   the dialog closes. If it errors, the URL is unreachable over HTTPS or the token does not match;
   check the server log, which records every rejected verification.
5. **Manage** the webhook fields and subscribe to:
   - **`messages`** — required. Incoming customer messages and delivery statuses.
   - **`message_echoes`** — optional but recommended. Copies of messages *staff* send from the
     WhatsApp Business app. Without it the AI still steps aside when staff reply (detected from the
     status event), but it cannot read the `/resume` and `/ai off` commands.

---

## Step 10 — Test

Message the business number from your own phone.

| Test | Send | Expect |
| --- | --- | --- |
| Basic answer | `what treatments do you offer?` | A short list drawn from the real catalogue |
| Hours | `are you open on Sunday?` | The real opening hours, or that it's closed |
| Off-topic | `what's the weather tomorrow?` | Polite redirect back to the lounge |
| No invented facts | `how much is a facial?` | Says the price is confirmed at consultation — never a number the catalogue doesn't have |
| Availability | `any openings Thursday for laser?` | Real times, from the calendar |
| Booking | `book me a laser session Thursday 3pm, I'm Sara` | "Request received, the lounge will confirm" — never "confirmed" |
| Booking landed | Open the admin dashboard | A new **PENDING** appointment for Sara, holding the slot |
| Takeover | Reply manually from the WhatsApp Business app, then message the bot from the customer phone | Silence — the AI has stepped aside for 30 minutes |
| Handback | Staff types `/resume` | The AI answers the next customer message |
| Junk | Send only emoji, then a 3,000-character paragraph | No crash, a sensible reply or a graceful redirect |
| Duplicate | *(nothing to do)* | Check the log — retried webhooks are skipped, never answered twice |

Watch the server log while testing. Every turn logs the customer, the tokens used and the tools
called.

---

## Step 11 — Website button

Add the number to `frontend/.env` and rebuild:

```
VITE_WHATSAPP_NUMBER=96170303380      # digits only, country code included, no + and no spaces
VITE_WHATSAPP_MESSAGE=Hi Nurella, I'd like to ask about a treatment
```

The floating button appears on every public page only once `VITE_WHATSAPP_NUMBER` is set — an unset
number renders nothing rather than a broken link.

---

## Step 12 — Go live

1. **App Review**: app dashboard → toggle the app from **Development** to **Live**. Until you do,
   only the numbers you added manually can message it.
2. **Business verification**: Business Manager → Security Centre → verify the business. Unverified
   numbers are limited to 250 conversations a day.
3. **Uptime monitor**: point [UptimeRobot](https://uptimerobot.com) (free) at
   `https://<your-domain>/api/health` every 5 minutes, alerting by email. That endpoint also reports
   database connectivity, so a Mongo outage trips it too.
4. **Display name review**: the business display name from Step 3 goes through Meta review. Until it
   is approved, customers see the raw number rather than the lounge's name.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Webhook verification fails in the dialog | URL not HTTPS / not reachable, or `WA_VERIFY_TOKEN` mismatch. The server logs every rejection with the token it received. |
| Verification succeeds, no messages arrive | The `messages` field is not subscribed (Step 9.5), or the app is still in Development mode and you are messaging from a number that isn't on the test list. |
| `(#100) Invalid parameter` on send | `WA_PHONE_NUMBER_ID` holds the phone number instead of the numeric id. |
| `(#190)` / `OAuthException` on send | Token expired — you are still on the 24-hour token from Step 3. Redo Step 4. |
| `(#131030) recipient not in allowed list` | App is in Development mode; add the number under **API Setup → To**, or go Live. |
| Bot silent for one customer only | That thread is paused after a staff reply. Wait `WA_HANDOFF_MINUTES`, or have staff type `/resume`. |
| Bot replies twice | Two server instances are both subscribed. Deduplication is per-database, so this is safe — but only if both point at the same MongoDB. |
| "Technical hiccup" replies | Gemini call failed. The log line `WhatsApp AI turn failed` carries the reason — usually an invalid or over-quota `GEMINI_API_KEY`. |
| Bot invents a price | The `BusinessProfile` has a price the catalogue doesn't. Re-run Step 8. |

---

## Cost, roughly

- **Gemini 2.0 Flash** — free tier covers a small lounge. Beyond it, a typical 8-message
  conversation costs a fraction of a US cent.
- **WhatsApp Cloud API** — service conversations (customer messages first, you reply within 24h)
  are free, with 1,000 free business-initiated conversations a month. Everything the assistant does
  is customer-initiated, so it lands in the free bucket. Appointment reminders — template messages
  you send first — are the part that eventually costs money.
