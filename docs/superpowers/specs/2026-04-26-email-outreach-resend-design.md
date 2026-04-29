# Email Outreach via Resend — Design

**Date:** 2026-04-26
**Status:** Approved, ready for implementation plan
**Related:** `2026-04-13-lead-activation-design.md` (WhatsApp-only baseline this extends)

## Goal

Add email as a second outbound channel running in parallel to the existing WhatsApp activation pipeline, using Resend as the provider. Same Day 1 / Day 4 / Day 7 cadence. Fire-and-forget on the inbound side — no email reply ingestion, no AI auto-reply on email.

## Non-goals (explicit YAGNI)

- Inbound email parsing, unified WA+email reply threads, AI auto-reply on email
- Per-agent sender identities (single sender for now)
- HTML-templated emails (plain text only)
- Embedded scheduling / click-to-call inside email body
- A/B testing of subject lines
- Automated warming schedule

## Decisions (from brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| Q1 | Email source | Hybrid: best-effort scrape from Facebook page + website during discovery; manual override always available in `AddLeadModal` |
| Q2 | Channel routing | Both channels in parallel — same Day 1/4/7 cadence, send WhatsApp + email together when both contacts exist |
| Q3 | Reply handling | Fire-and-forget — replies land in `chuma@skhokholabs.xyz` personal inbox; dashboard never sees them |
| Q4 | Sender identity | Universal sender `chuma@skhokholabs.xyz`; body still signed by `agentName` (signature mismatch accepted as known tradeoff) |
| Q5 | Format | Plain text with email-native copy (separate Claude generation per channel — not a rehoused WhatsApp blurb) |
| —  | Sending domain | `mail.skhokholabs.xyz` subdomain for SPF/DKIM/return-path; From header still on apex `chuma@skhokholabs.xyz` |

## Architecture

Email runs as a peer channel alongside WhatsApp on the existing activation pipeline. The cron, message generator, and storage layer all extend to handle `channel='email'` without forking the flow.

```
Discovery (Places API)
   │
   ├─► scrapeContacts(facebookUrl, websiteUrl) ─► email candidate
   │
Activation (POST /api/activate)
   │
   ├─► generateMessages(lead)        ─► 3 WhatsApp messages
   ├─► generateEmailMessages(lead)   ─► 3 email subject+body pairs
   │   (both must succeed; rolled back atomically on failure)
   │
   └─► queue 6 rows in activation_messages
       (WA Day1/4/7, email Day1/4/7, all status='scheduled')

Cron (every N minutes)
   │
   ├─► pick scheduled rows past their scheduled_for
   ├─► channel='whatsapp' → sendWhatsApp(...)
   └─► channel='email'    → sendEmail(...)
       (skip email rows when lead.email_status IN ('bounced','unsubscribed'))

Resend webhook (POST /api/resend-webhook)
   │
   ├─► verify signature
   ├─► append event to email_events
   ├─► update activation_messages.status (delivered/read/failed)
   └─► on bounce/complaint → set lead.email_status

Recipient
   │
   ├─► clicks unsubscribe link → GET /api/unsubscribe?lead=<id>&t=<hmac>
   │   → lead.email_status='unsubscribed'
   │
   └─► hits Reply → email lands in chuma@skhokholabs.xyz inbox
       (out of system, handled manually)
```

## Data model

### `activation_leads` — additions

| Column | Type | Notes |
|--------|------|-------|
| `email` | `TEXT NULL` | Normalised lowercase, simple regex validation at write time |
| `email_status` | `TEXT NULL` | `null` \| `'valid'` \| `'bounced'` \| `'unsubscribed'`. Drives whether queued email rows actually fire. |

### `activation_messages` — changes

| Column | Change | Notes |
|--------|--------|-------|
| `channel` | extend enum | Add `'email'` to existing `'whatsapp'` |
| `subject` | new `TEXT NULL` | Populated for email rows, null for WhatsApp |
| `meta_message_id` | rename → `provider_message_id` | Holds Meta `wamid` or Resend message id depending on channel |

### `email_events` — new table

| Column | Type |
|--------|------|
| `id` | `UUID PK` |
| `message_id` | `UUID FK → activation_messages.id` |
| `event_type` | `TEXT` (`delivered` \| `opened` \| `clicked` \| `bounced` \| `complained`) |
| `created_at` | `TIMESTAMPTZ` |
| `payload` | `JSONB` (raw Resend webhook body) |

Index: `(message_id, event_type)` for fast lookup.

## Components

### `lib/email.ts` (new)

Mirrors the shape of `lib/activation.ts`:

- `sendEmail(to, subject, body, leadId): Promise<string>` — Resend SDK call, returns provider id. Appends compliance footer before send.
- `buildEmailPrompt(lead, productPitch, whyItFits, supportingProducts): string` — exported for testing.
- `generateEmailMessages(lead, ...): Promise<{day1: {subject, body}, day4: {subject, body}, day7: {subject, body}}>` — single Claude Haiku call, parses JSON.
- `appendComplianceFooter(body, leadId): string` — adds POPIA-required unsubscribe link + physical address.
- `signUnsubscribeToken(leadId): string` — HMAC-SHA256 over `leadId` with `UNSUBSCRIBE_HMAC_SECRET`.
- `verifyUnsubscribeToken(leadId, token): boolean`

### `lib/scrapeContacts.ts` (new)

Best-effort email harvester:

- `scrapeContacts(facebookUrl: string | null, websiteUrl: string | null): Promise<{email: string | null, source: 'website' | 'facebook' | null}>`
- Fetch HTML with 5s timeout; on any error return `{email: null, source: null}`.
- Regex: `[\w.+-]+@[\w-]+\.[\w.-]+`
- De-prioritise generic prefixes (`info@`, `contact@`, `webmaster@`) — return them only if no personal-looking address found.
- Filter out obvious noise: `example.com`, `sentry.io`, `@2x.png`, addresses inside `<script>` blocks.

### Routes

- **`app/api/discover-leads/route.ts`** — call `scrapeContacts` for each Place after the existing Places enrichment; store on the row before returning to the client.
- **`app/api/activate/route.ts`** — when activating a lead with a present `email`, call `generateEmailMessages` in parallel with `generateMessages`. Both must succeed or the activation is rolled back. Queue 3 email rows with the same `scheduled_for` timestamps as the WhatsApp rows.
- **`app/api/activation-cron/route.ts`** — extend the dispatch switch: `channel='email'` → `sendEmail`. Before sending an email row, re-read `lead.email_status` and skip+mark `cancelled` if `bounced` or `unsubscribed`.
- **`app/api/resend-webhook/route.ts`** (new) — verify Resend signature using `RESEND_WEBHOOK_SECRET`, write event to `email_events`, update `activation_messages.status` (`delivered`/`read`/`failed`), update `activation_leads.email_status` on `bounce` / `complained`.
- **`app/api/unsubscribe/route.ts`** (new) — GET endpoint, validates HMAC token, sets `email_status='unsubscribed'`, renders a minimal confirmation HTML page. Idempotent.

### UI

- **`components/activation/AddLeadModal.tsx`** — add optional `email` text input. Validate format on submit.
- **`components/activation/ConversationModal.tsx`** — render email rows with subject line shown above body. Channel badge (WhatsApp / Email) already exists from a prior commit.
- **`components/discovery/DiscoveredLeadCard.tsx`** — surface scraped email as a small badge so the agent sees coverage at a glance.

## Sender / domain configuration

DNS on `mail.skhokholabs.xyz`:

- **SPF** TXT: `v=spf1 include:_spf.resend.com -all`
- **DKIM** CNAME: per Resend's onboarding instructions
- **DMARC** TXT: `v=DMARC1; p=quarantine; rua=mailto:dmarc@skhokholabs.xyz`

Headers on every send:

- `From: Chuma <chuma@skhokholabs.xyz>`
- `Reply-To: chuma@skhokholabs.xyz`
- `Return-Path:` (Resend manages, on `mail.skhokholabs.xyz`)
- `List-Unsubscribe: <https://skhokholabs.xyz/unsubscribe?lead=...&t=...>, <mailto:chuma@skhokholabs.xyz?subject=unsubscribe>`
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

Resend project sends via `mail.skhokholabs.xyz` with the friendly `From` on the apex (Resend permits this when the parent domain is also verified or when the From address is on a verified parent — confirmed at implementation time).

## Compliance footer

Appended to every outbound email body:

```
—
Skhokho Labs · {EMAIL_PHYSICAL_ADDRESS} · skhokholabs.xyz
You received this because we identified {businessName} as a potential fit for our SA small-business AI tools.
Don't want these? Unsubscribe: https://skhokholabs.xyz/unsubscribe?lead={leadId}&t={hmac}
```

POPIA s.69 requires (a) sender identification, (b) a contactable address, (c) a free opt-out. This footer + the `List-Unsubscribe` header cover all three.

## Error handling

| Failure | Behaviour |
|---------|-----------|
| `scrapeContacts` errors | Silent. Lead has `email=null`. Manual entry remains possible. |
| `generateEmailMessages` fails at activate-time | Activation rolled back atomically. WhatsApp generation runs in parallel and both must succeed. No half-queued state. |
| `sendEmail` fails in cron | Mark message `status='failed'`, log full error. No automatic retry — cron's next pass will not re-pick (status is no longer `scheduled`). |
| Hard bounce (Resend webhook) | `email_status='bounced'`. Future scheduled email rows for this lead skipped at send time (so a typo discovered between Day 1 and Day 4 still cancels the rest). |
| Spam complaint | Same as unsubscribe — `email_status='unsubscribed'`. Never email this lead again. |
| Webhook signature mismatch | 401, log and discard. |
| Unsubscribe token mismatch | 400, render generic error page. |

## Testing

- `lib/__tests__/email.test.ts` — `appendComplianceFooter`, prompt builder shape, response parsing (good + malformed), HMAC token round-trip. Mirrors `activation.test.ts` style.
- `lib/__tests__/scrapeContacts.test.ts` — regex extraction against fixture HTML (Facebook page snippet, business website snippet, page with no emails, page with only generic prefixes).
- `app/api/resend-webhook/route.test.ts` — signature verification (valid + invalid), each event type → correct DB updates, bounce sets `email_status='bounced'`.
- `app/api/unsubscribe/route.test.ts` — valid token sets `email_status='unsubscribed'`, invalid token rejected, idempotent on repeat call.

No live Resend calls in tests — mock the SDK at the module boundary.

## Environment variables

```
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
EMAIL_FROM_ADDRESS=chuma@skhokholabs.xyz
EMAIL_REPLY_TO=chuma@skhokholabs.xyz
EMAIL_SENDING_DOMAIN=mail.skhokholabs.xyz
EMAIL_PHYSICAL_ADDRESS=
UNSUBSCRIBE_HMAC_SECRET=
```

## Migration

A single migration adds the columns, extends the channel enum, renames `meta_message_id` → `provider_message_id`, and creates `email_events`. The rename means existing reads of `meta_message_id` need updating in the same migration PR.

## Open questions for implementation phase

- Exact physical address string for `EMAIL_PHYSICAL_ADDRESS` — needed before first send.
- Whether to gate first sends behind a feature flag during the warming period (recommend yes, ship with `EMAIL_OUTREACH_ENABLED=false` default).
