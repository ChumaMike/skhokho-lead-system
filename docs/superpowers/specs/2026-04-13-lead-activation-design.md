# Lead Activation System — Design Spec
**Date:** 2026-04-13  
**Project:** Skhokho Lead System  
**Scope:** Sub-project 1 of 3 — Core engine + WhatsApp channel

---

## Context

The existing Skhokho Lead System has two tabs: **Enter Lead** (manual entry + PDF dossier) and **Discover Leads** (Google Places batch discovery + PDF). Both tabs generate lead intelligence but stop short of outreach — agents download a PDF and contact leads manually.

This spec describes a third tab, **Activate Leads**, that closes the loop: agents select discovered leads, the system generates personalized WhatsApp messages via Claude, sends them via Twilio, tracks replies, and notifies agents when a lead responds so they can take over the conversation.

Sub-projects 2 (Email, Facebook DM, SMS channels) and 3 (Analytics) are out of scope for this spec.

---

## Goals

- Allow agents to push leads from Discover (or Enter) directly into an activation queue with one click
- Auto-generate a 3-message WhatsApp sequence per lead, personalized by sector, product, heat score, and agent name
- Send messages on schedule via Twilio WhatsApp API (Day 1 → Day 4 → Day 7 if no reply)
- Pause sequence and notify agent in-app when a lead replies
- Show a pipeline view (Queue → Sent → Replied → Booked) so agents always know where each lead stands

---

## Architecture

### Data Flow

```
Discover Leads tab
  → agent selects leads → clicks "Activate Selected"
    → POST /api/activate
      → Claude API generates 3 messages per lead
      → Twilio sends Day 1 WhatsApp immediately
      → Supabase: activation_leads row created (status: sent)
      → Supabase: activation_messages rows created (Day 4 & 7 scheduled)
        → Cron job checks for scheduled messages → sends via Twilio
          → Lead replies → Twilio webhook → POST /api/twilio-webhook
            → Supabase: lead status → "replied"
            → In-app notification badge increments
              → Agent clicks "Take Over" → manual conversation
                → Agent marks lead as "booked" or "dead"
```

### Infrastructure

| Service | Purpose | Credentials source |
|---|---|---|
| Supabase | Lead persistence, message history | MTA project `.env.local` |
| Twilio | WhatsApp send/receive | MTA project `.env.local` |
| Anthropic (Claude) | Message generation | MTA project `.env.local` |
| Next.js cron (Vercel) | Schedule Day 4 & Day 7 follow-ups | New `CRON_SECRET` |

---

## Database Schema (Supabase)

### `activation_leads`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `business_name` | text | |
| `owner_name` | text | nullable |
| `phone` | text | E.164 format, e.g. +27831234567 |
| `sector` | text | Matches existing `Sector` type |
| `recommended_product` | text | Matches existing `Product` type |
| `heat_score` | int | 1–10 |
| `heat_level` | text | HOT / WARM / COLD |
| `location` | text | |
| `agent_name` | text | |
| `source_type` | text | 'entered' or 'discovered' |
| `status` | text | `queued` (added, not yet activated) / `sent` (Day 1 sent) / `replied` / `booked` / `dead` |
| `google_maps_url` | text | nullable, from discovery |
| `created_at` | timestamptz | |
| `activated_at` | timestamptz | nullable |
| `replied_at` | timestamptz | nullable |

### `activation_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `lead_id` | uuid | FK → activation_leads |
| `direction` | text | 'outbound' or 'inbound' |
| `body` | text | Message content |
| `sequence_day` | int | 1, 4, or 7 (null for inbound) |
| `status` | text | scheduled / sent / delivered / failed |
| `channel` | text | 'whatsapp' (extensible for email/sms later) |
| `sent_at` | timestamptz | nullable |
| `scheduled_for` | timestamptz | nullable |

---

## UI — Activate Leads Tab

### Tab Bar
- Third tab added to `app/page.tsx` alongside Enter Lead and Discover Leads
- Shows a red notification badge with count of leads in "replied" status

### Pipeline View (`components/activation/ActivationPipeline.tsx`)
Four columns, left to right:
1. **Queue** — leads added but Day 1 not yet sent (grey)
2. **Sent** — Day 1 (or later follow-up) sent, awaiting reply (blue)
3. **Replied** — lead responded, agent action needed (amber, glowing border)
4. **Booked** — agent marked as converted (green, shows expected setup fee)

### Lead Card (`components/activation/ActivationLeadCard.tsx`)
- Business name, phone, location
- Heat badge (HOT/WARM/COLD)
- Recommended product name
- Last message preview (truncated)
- "Take Over" CTA button on Replied cards
- "Mark as Booked" / "Mark as Dead" actions on Replied cards

### Toolbar
- Lead count and "X need attention" summary
- "Activate All Queued" bulk action button
- Sector filter dropdown

### Push to Activation
- In `LeadDiscovery.tsx`: existing "Download PDF" button area gets a second button: **"Activate Selected (N)"**
- In `LeadForm.tsx`: after PDF generation, an **"Add to Activation Queue"** button appears
- Both push lead data to `POST /api/activate`

---

## API Routes

### `POST /api/activate`
**Input:** Array of `ActivationLeadInput` (subset of `DiscoveredLead` or `LeadData`)  
**Process:**
1. For each lead: call Claude API with structured prompt → get 3 messages back
2. Insert row into `activation_leads` (status: `sent`)
3. Send Day 1 message via Twilio immediately
4. Insert 3 rows into `activation_messages` (Day 1: sent, Day 4/7: scheduled)

**Output:** `{ activated: number, failed: number }`

### `GET /api/activation-queue`
**Output:** All `activation_leads` with their latest `activation_messages`, ordered by `replied_at` DESC, then `created_at` DESC

### `POST /api/twilio-webhook`
**Triggered by:** Twilio when lead sends an inbound WhatsApp message  
**Process:**
1. Match inbound phone number to `activation_leads`
2. Insert inbound message into `activation_messages`
3. Update lead status → `replied`, set `replied_at`
4. Update all scheduled outbound messages for this lead → `status: 'cancelled'` (not deleted)

**Security:** Validate Twilio webhook signature

### `PATCH /api/activation-leads/[id]`
**Input:** `{ status: 'booked' | 'dead' }`  
**Process:** Update lead status in Supabase

### `POST /api/activation-cron`
**Triggered by:** Vercel cron (daily)  
**Security:** Bearer `CRON_SECRET`  
**Process:** Query `activation_messages` where `status = scheduled` and `scheduled_for <= now()` → send each via Twilio → mark as sent

---

## Message Generation (Claude)

### Prompt structure
Claude receives a structured system prompt describing Skhokho Labs, the 6 products, and the tone guide (warm, direct, SA-local, WhatsApp-native). The user message passes lead variables.

### Personalization variables
`businessName`, `ownerName`, `sector`, `location`, `hasWebsite`, `recommendedProduct`, `productPitch`, `whyItFits`, `agentName`, `heatLevel`

### Output format
Claude returns a JSON object:
```json
{
  "day1": "...",
  "day4": "...",
  "day7": "..."
}
```

### Tone guide
- Conversational, not corporate
- SA-local greetings (Sawubona, Howzit, Sho)
- Short paragraphs, single emoji per message max
- Always name the lead and their business
- Specific to their gap (no website, no bookings, etc.)
- Soft CTA — ask permission, not a hard sell

### Phone number normalization
Phones stored by agents may be in various formats (`083 456 7890`, `+27 83 456 7890`). `lib/activation.ts` must normalize to E.164 (`+27831234567`) before sending via Twilio and before storing in Supabase. The Twilio webhook sends numbers in E.164, so normalization on ingest ensures matching works correctly.

### Reused from existing code
- `lib/productMatch.ts` → `getAllProductsWithOffer()` for `whyItFits` text
- `lib/scripts.ts` → tone reference for message structure
- `types/lead.ts` + `types/discovery.ts` → input types

---

## Environment Variables (add to `.env.local`)

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+13502211235
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

Values sourced from MTA project `.env.local` (same Supabase project, same Twilio account).

---

## New Files

```
app/
  api/
    activate/route.ts
    activation-queue/route.ts
    activation-cron/route.ts
    activation-leads/[id]/route.ts
    twilio-webhook/route.ts
components/
  activation/
    ActivationPipeline.tsx
    ActivationLeadCard.tsx
    ActivationToolbar.tsx
lib/
  activation.ts          (message generation + Twilio send helpers)
  supabase.ts            (Supabase client)
types/
  activation.ts          (ActivationLead, ActivationMessage types)
```

---

## Modified Files

| File | Change |
|---|---|
| `app/page.tsx` | Add "Activate Leads" tab + notification badge |
| `components/LeadDiscovery.tsx` | Add "Activate Selected" button |
| `components/LeadForm.tsx` | Add "Add to Activation Queue" button |
| `.env.local` | Add Twilio, Anthropic, Supabase keys |
| `package.json` | Add `@supabase/supabase-js`, `twilio` |

---

## Verification

1. Run `npm install` — no type errors
2. Set up Supabase tables (SQL in spec above)
3. Add env vars to `.env.local`
4. Configure Twilio webhook URL: `https://<your-domain>/api/twilio-webhook`
5. Discover leads → select 2-3 → click "Activate Selected"
6. Verify: Supabase rows created, WhatsApp messages received on test number
7. Reply from test number → verify lead moves to "Replied" column + notification badge appears
8. Click "Take Over" → verify sequence paused (no further messages sent)
9. Mark lead as "Booked" → verify column move + fee display

---

## Out of Scope (Sub-project 2)

- Email channel (Resend)
- Facebook Messenger DM
- SMS (BulkSMS / Clickatell)

## Out of Scope (Sub-project 3)

- Campaign analytics dashboard
- Response rate metrics
- A/B message testing
