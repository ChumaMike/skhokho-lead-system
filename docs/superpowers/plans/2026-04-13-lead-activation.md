# Lead Activation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Activate Leads" tab to the Skhokho Lead System that sends AI-generated WhatsApp message sequences to leads via Twilio, tracks replies, and notifies agents when leads respond.

**Architecture:** New third tab in the existing Next.js app. Supabase stores lead activation state and message history. Claude (claude-haiku) generates personalized 3-message WhatsApp sequences per lead. Twilio sends Day 1 immediately; a Vercel cron fires Day 4 and Day 7 follow-ups if no reply. Twilio webhook pauses the sequence when a lead replies and flags the agent.

**Tech Stack:** Next.js App Router, Supabase (`@supabase/supabase-js`), Twilio (`twilio`), Anthropic SDK (`@anthropic-ai/sdk`), TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-13-lead-activation-design.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `types/activation.ts` | TypeScript types: `ActivationLead`, `ActivationMessage`, `ActivationLeadInput`, `ActivationStatus` |
| `lib/supabase.ts` | Supabase service-role client (server-side only) |
| `lib/activation.ts` | `normalizePhone`, `generateMessages` (Claude), `sendWhatsApp` (Twilio) |
| `app/api/activate/route.ts` | POST: generate + send Day 1, create Supabase records |
| `app/api/activation-queue/route.ts` | GET: fetch all leads with latest messages |
| `app/api/twilio-webhook/route.ts` | POST: receive inbound reply, pause sequence, flag lead |
| `app/api/activation-leads/[id]/route.ts` | PATCH: update lead status (booked/dead) |
| `app/api/activation-cron/route.ts` | POST: send scheduled Day 4/7 messages |
| `components/activation/ActivationLeadCard.tsx` | Single lead card with status, heat badge, last message, actions |
| `components/activation/ActivationToolbar.tsx` | Lead count, "Activate All Queued" button, sector filter |
| `components/activation/ActivationPipeline.tsx` | Four-column pipeline, polls queue, composes Card + Toolbar |
| `vercel.json` | Cron schedule for `activation-cron` |

### Modified files
| File | Change |
|---|---|
| `app/page.tsx` | Add `'activate'` tab type, tab button with red badge, render `ActivationPipeline` |
| `components/LeadDiscovery.tsx` | Add "Activate Selected (N)" button in bulk-action area |
| `components/LeadForm.tsx` | Add "Add to Activation Queue" button after PDF download |
| `.env.local` | Add Twilio, Anthropic, Supabase keys |
| `package.json` | `@supabase/supabase-js`, `twilio`, `@anthropic-ai/sdk` |

---

## Task 1: Read docs + install packages

**Files:**
- Modify: `package.json`
- Modify: `.env.local`

- [ ] **Step 1: Read Next.js App Router docs**

```bash
cat "node_modules/next/dist/docs/app-router.md" 2>/dev/null | head -100 || ls node_modules/next/dist/docs/
```

Read whichever doc covers Route Handlers and any breaking changes from your Next.js version.

- [ ] **Step 2: Install packages**

```bash
npm install @supabase/supabase-js twilio @anthropic-ai/sdk
```

Expected: packages added to `node_modules`, `package.json` updated.

- [ ] **Step 3: Add env vars to `.env.local`**

Append to the existing `.env.local` (values from `C:/Users/MEYISWA0024/Videos/MTA SOCIAL MEDIA AGENTS/mta-social-system/.env.local`):

```
# ── Activation System ──────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=<your-twilio-account-sid>
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_WHATSAPP_FROM=whatsapp:+1XXXXXXXXXX

ANTHROPIC_API_KEY=<your-anthropic-api-key>

NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# Generate with: openssl rand -hex 32
CRON_SECRET=<generated-hex>
```

- [ ] **Step 4: Generate CRON_SECRET and update `.env.local`**

```bash
openssl rand -hex 32
```

Replace `replace_with_random_32_byte_hex` in `.env.local` with the output.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.local
git commit -m "chore: install supabase, twilio, anthropic-ai packages + activation env vars"
```

---

## Task 2: Supabase schema

**Files:**
- Create: `supabase/migrations/001_activation_tables.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/001_activation_tables.sql

create table if not exists activation_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text,
  phone text not null,
  sector text not null,
  recommended_product text not null,
  heat_score int not null,
  heat_level text not null,
  location text not null,
  agent_name text not null,
  source_type text not null check (source_type in ('entered', 'discovered')),
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'replied', 'booked', 'dead')),
  has_website boolean not null default false,
  google_maps_url text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  replied_at timestamptz
);

create table if not exists activation_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references activation_leads(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  body text not null,
  sequence_day int,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'delivered', 'failed', 'cancelled')),
  channel text not null default 'whatsapp',
  sent_at timestamptz,
  scheduled_for timestamptz
);

create index if not exists activation_leads_status_idx on activation_leads(status);
create index if not exists activation_messages_lead_id_idx on activation_messages(lead_id);
create index if not exists activation_messages_scheduled_idx
  on activation_messages(scheduled_for)
  where status = 'scheduled';
```

- [ ] **Step 2: Run migration in Supabase dashboard**

Go to https://supabase.com → project `fxnbghdnajcldnnkjewc` → SQL Editor → paste and run the migration.

Expected: no errors, two new tables visible in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "chore: add supabase activation_leads and activation_messages tables"
```

---

## Task 3: TypeScript types

**Files:**
- Create: `types/activation.ts`

- [ ] **Step 1: Create `types/activation.ts`**

```typescript
import type { Sector, Product, HeatLevel } from './lead'

export type ActivationStatus = 'queued' | 'sent' | 'replied' | 'booked' | 'dead'
export type MessageDirection = 'outbound' | 'inbound'
export type MessageStatus = 'scheduled' | 'sent' | 'delivered' | 'failed' | 'cancelled'

export interface ActivationLead {
  id: string
  businessName: string
  ownerName: string | null
  phone: string
  sector: Sector
  recommendedProduct: Product
  heatScore: number
  heatLevel: HeatLevel
  location: string
  agentName: string
  sourceType: 'entered' | 'discovered'
  status: ActivationStatus
  hasWebsite: boolean
  googleMapsUrl: string | null
  createdAt: string
  activatedAt: string | null
  repliedAt: string | null
  messages?: ActivationMessage[]
}

export interface ActivationMessage {
  id: string
  leadId: string
  direction: MessageDirection
  body: string
  sequenceDay: number | null
  status: MessageStatus
  channel: 'whatsapp'
  sentAt: string | null
  scheduledFor: string | null
}

export interface ActivationLeadInput {
  businessName: string
  ownerName?: string
  phone: string
  sector: Sector
  recommendedProduct: Product
  heatScore: number
  heatLevel: HeatLevel
  location: string
  agentName: string
  sourceType: 'entered' | 'discovered'
  hasWebsite?: boolean
  googleMapsUrl?: string
}

/** Maps camelCase ActivationLead to snake_case DB row */
export function toDbRow(lead: ActivationLeadInput & { status?: ActivationStatus }) {
  return {
    business_name: lead.businessName,
    owner_name: lead.ownerName ?? null,
    phone: lead.phone,
    sector: lead.sector,
    recommended_product: lead.recommendedProduct,
    heat_score: lead.heatScore,
    heat_level: lead.heatLevel,
    location: lead.location,
    agent_name: lead.agentName,
    source_type: lead.sourceType,
    status: lead.status ?? 'queued',
    has_website: lead.hasWebsite ?? false,
    google_maps_url: lead.googleMapsUrl ?? null,
  }
}

/** Maps snake_case DB row to camelCase ActivationLead */
export function fromDbRow(row: Record<string, unknown>): ActivationLead {
  return {
    id: row.id as string,
    businessName: row.business_name as string,
    ownerName: row.owner_name as string | null,
    phone: row.phone as string,
    sector: row.sector as Sector,
    recommendedProduct: row.recommended_product as Product,
    heatScore: row.heat_score as number,
    heatLevel: row.heat_level as HeatLevel,
    location: row.location as string,
    agentName: row.agent_name as string,
    sourceType: row.source_type as 'entered' | 'discovered',
    status: row.status as ActivationStatus,
    hasWebsite: row.has_website as boolean,
    googleMapsUrl: row.google_maps_url as string | null,
    createdAt: row.created_at as string,
    activatedAt: row.activated_at as string | null,
    repliedAt: row.replied_at as string | null,
  }
}

export function msgFromDbRow(row: Record<string, unknown>): ActivationMessage {
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    direction: row.direction as MessageDirection,
    body: row.body as string,
    sequenceDay: row.sequence_day as number | null,
    status: row.status as MessageStatus,
    channel: 'whatsapp',
    sentAt: row.sent_at as string | null,
    scheduledFor: row.scheduled_for as string | null,
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/activation.ts
git commit -m "feat: add activation TypeScript types and DB row mappers"
```

---

## Task 4: Supabase client

**Files:**
- Create: `lib/supabase.ts`

- [ ] **Step 1: Create `lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
}

/** Server-side only. Never expose SUPABASE_SERVICE_ROLE_KEY to the client. */
export const supabase = createClient(supabaseUrl, supabaseServiceKey)
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add supabase server-side client"
```

---

## Task 5: `lib/activation.ts` — phone normalization (TDD)

**Files:**
- Create: `lib/activation.ts`
- Create: `lib/__tests__/activation.test.ts`

- [ ] **Step 1: Set up Jest (if not already configured)**

Check for existing Jest config:
```bash
cat package.json | grep -E '"jest"|"test"'
```

If no Jest configured, add to `package.json` devDependencies and create config:

```bash
npm install --save-dev jest @types/jest ts-jest
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/$1"
    }
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `lib/__tests__/activation.test.ts`:

```typescript
import { normalizePhone } from '../activation'

describe('normalizePhone', () => {
  it('converts local SA format (083...) to E.164', () => {
    expect(normalizePhone('0834567890')).toBe('+27834567890')
  })

  it('converts spaced local format (083 456 7890) to E.164', () => {
    expect(normalizePhone('083 456 7890')).toBe('+27834567890')
  })

  it('strips spaces from international format', () => {
    expect(normalizePhone('+27 83 456 7890')).toBe('+27834567890')
  })

  it('handles already-correct E.164', () => {
    expect(normalizePhone('+27834567890')).toBe('+27834567890')
  })

  it('converts 27xxxxxxxxx (no plus) to E.164', () => {
    expect(normalizePhone('27834567890')).toBe('+27834567890')
  })
})
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
npx jest lib/__tests__/activation.test.ts
```

Expected: FAIL — `normalizePhone` not found.

- [ ] **Step 4: Implement `normalizePhone` in `lib/activation.ts`**

```typescript
/**
 * Normalizes a South African phone number to E.164 format (+27XXXXXXXXX).
 * Handles: "083 456 7890", "+27 83 456 7890", "27834567890", "+27834567890"
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('27') && digits.length === 11) {
    return `+${digits}`
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+27${digits.slice(1)}`
  }
  // Fallback: prefix + if not already there
  return phone.startsWith('+') ? `+${digits}` : `+${digits}`
}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npx jest lib/__tests__/activation.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/activation.ts lib/__tests__/activation.test.ts package.json
git commit -m "feat: add normalizePhone utility with tests"
```

---

## Task 6: `lib/activation.ts` — message generation

**Files:**
- Modify: `lib/activation.ts`
- Modify: `lib/__tests__/activation.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/__tests__/activation.test.ts`:

```typescript
import { buildMessagePrompt } from '../activation'
import type { ActivationLeadInput } from '@/types/activation'

describe('buildMessagePrompt', () => {
  const lead: ActivationLeadInput = {
    businessName: "Mama T's Salon",
    ownerName: 'Mama T',
    phone: '+27834567890',
    sector: 'salon_hair',
    recommendedProduct: 'pro_website_bookings',
    heatScore: 9,
    heatLevel: 'HOT',
    location: 'Soweto',
    agentName: 'Thabo',
    sourceType: 'discovered',
    hasWebsite: false,
  }

  it('includes business name in prompt', () => {
    const prompt = buildMessagePrompt(lead, 'Take bookings online', 'Relies on appointments')
    expect(prompt).toContain("Mama T's Salon")
  })

  it('includes agent name in prompt', () => {
    const prompt = buildMessagePrompt(lead, 'Take bookings online', 'Relies on appointments')
    expect(prompt).toContain('Thabo')
  })

  it('includes product pitch in prompt', () => {
    const prompt = buildMessagePrompt(lead, 'Take bookings online', 'Relies on appointments')
    expect(prompt).toContain('Take bookings online')
  })

  it('mentions no website when hasWebsite is false', () => {
    const prompt = buildMessagePrompt(lead, 'Take bookings online', 'Relies on appointments')
    expect(prompt).toContain('false')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest lib/__tests__/activation.test.ts --testNamePattern="buildMessagePrompt"
```

Expected: FAIL — `buildMessagePrompt` not found.

- [ ] **Step 3: Add `buildMessagePrompt` and `generateMessages` to `lib/activation.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { ActivationLeadInput } from '@/types/activation'

/**
 * Builds the user-facing Claude prompt string for generating 3 WhatsApp messages.
 * Exported for testing.
 */
export function buildMessagePrompt(
  lead: ActivationLeadInput,
  productPitch: string,
  whyItFits: string,
): string {
  return `Write a 3-message WhatsApp outreach sequence for this lead:

Business: ${lead.businessName}
Owner: ${lead.ownerName ?? 'Business Owner'}
Sector: ${lead.sector}
Location: ${lead.location}
Has Website: ${lead.hasWebsite ?? false}
Recommended Product: ${lead.recommendedProduct}
Product Pitch: ${productPitch}
Why It Fits: ${whyItFits}
Agent Name: ${lead.agentName}
Heat Level: ${lead.heatLevel}

Rules:
- Day 1: warm opener, name the gap (no website, no bookings, etc.), specific product offer, soft CTA
- Day 4: social proof follow-up, SA business example, ask for a call
- Day 7: low-pressure final message, leave door open
- Each message under 150 words
- Max one emoji per message
- SA-local greetings (Sawubona, Howzit, Sho) where natural
- Never pushy — ask permission, not demand

Return ONLY a valid JSON object with keys "day1", "day4", "day7". No markdown, no explanation.`
}

const SYSTEM_PROMPT = `You are a friendly sales agent for Skhokho Labs, South Africa's leading AI automation studio for small businesses. You write WhatsApp messages that are warm, conversational, and SA-local. You never use corporate jargon. You always write as if texting a friend who runs a business.`

/**
 * Calls Claude to generate a 3-message WhatsApp sequence for a lead.
 * Returns { day1, day4, day7 }.
 */
export async function generateMessages(
  lead: ActivationLeadInput,
  productPitch: string,
  whyItFits: string,
): Promise<{ day1: string; day4: string; day7: string }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildMessagePrompt(lead, productPitch, whyItFits),
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  return JSON.parse(text) as { day1: string; day4: string; day7: string }
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest lib/__tests__/activation.test.ts
```

Expected: PASS (9 tests total — 5 from Task 5 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add lib/activation.ts lib/__tests__/activation.test.ts
git commit -m "feat: add buildMessagePrompt and generateMessages (Claude)"
```

---

## Task 7: `lib/activation.ts` — Twilio send

**Files:**
- Modify: `lib/activation.ts`

- [ ] **Step 1: Add `sendWhatsApp` to `lib/activation.ts`**

```typescript
import twilio from 'twilio'

/**
 * Sends a WhatsApp message via Twilio.
 * Returns the Twilio message SID.
 */
export async function sendWhatsApp(toE164: string, body: string): Promise<string> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  const message = await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM!,
    to: `whatsapp:${toE164}`,
    body,
  })
  return message.sid
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If Twilio types fail, run `npm install --save-dev @types/twilio` (or check if `twilio` ships its own types — it does since v4).

- [ ] **Step 3: Commit**

```bash
git add lib/activation.ts
git commit -m "feat: add sendWhatsApp utility (Twilio)"
```

---

## Task 8: `POST /api/activate`

**Files:**
- Create: `app/api/activate/route.ts`

- [ ] **Step 1: Check how existing API routes are structured**

```bash
cat app/api/generate-pdf/route.ts
```

Note the import style and any middleware patterns.

- [ ] **Step 2: Create `app/api/activate/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { normalizePhone, generateMessages, sendWhatsApp } from '@/lib/activation'
import { getAllProductsWithOffer } from '@/lib/productMatch'
import { toDbRow } from '@/types/activation'
import type { ActivationLeadInput } from '@/types/activation'
import type { DiscoveredLead } from '@/types/discovery'

export async function POST(request: Request) {
  let leads: ActivationLeadInput[]
  try {
    leads = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: 'Provide a non-empty array of leads' }, { status: 400 })
  }

  let activated = 0
  let failed = 0

  for (const lead of leads) {
    try {
      const phone = normalizePhone(lead.phone)

      // Build a minimal DiscoveredLead shape for getAllProductsWithOffer
      const pseudoLead: DiscoveredLead = {
        placeId: '',
        businessName: lead.businessName,
        phone,
        address: lead.location,
        location: lead.location,
        sector: lead.sector,
        source: 'google_maps',
        hasWebsite: lead.hasWebsite ?? false,
        websiteUrl: '',
        googleMapsUrl: lead.googleMapsUrl ?? '',
        hasGoogleProfile: true,
        heatScore: lead.heatScore,
        heatLevel: lead.heatLevel,
        recommendedProduct: lead.recommendedProduct,
      }

      const products = getAllProductsWithOffer(pseudoLead)
      const offer = products.find((p) => p.product === lead.recommendedProduct)
      const pitch = offer?.pitch ?? ''
      const whyItFits = offer?.whyItFits ?? ''

      const messages = await generateMessages({ ...lead, phone }, pitch, whyItFits)

      const now = new Date()
      const day4Date = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      const day7Date = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000)

      const { data: activationLead, error: leadError } = await supabase
        .from('activation_leads')
        .insert(toDbRow({ ...lead, phone, status: 'sent' }))
        .select()
        .single()

      if (leadError) throw leadError

      await sendWhatsApp(phone, messages.day1)

      await supabase.from('activation_messages').insert([
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: messages.day1,
          sequence_day: 1,
          status: 'sent',
          channel: 'whatsapp',
          sent_at: now.toISOString(),
          scheduled_for: null,
        },
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: messages.day4,
          sequence_day: 4,
          status: 'scheduled',
          channel: 'whatsapp',
          sent_at: null,
          scheduled_for: day4Date.toISOString(),
        },
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: messages.day7,
          sequence_day: 7,
          status: 'scheduled',
          channel: 'whatsapp',
          sent_at: null,
          scheduled_for: day7Date.toISOString(),
        },
      ])

      activated++
    } catch (err) {
      console.error('Failed to activate lead:', (lead as ActivationLeadInput).businessName, err)
      failed++
    }
  }

  return NextResponse.json({ activated, failed })
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/activate/route.ts
git commit -m "feat: POST /api/activate — generate + send Day 1 WhatsApp per lead"
```

---

## Task 9: `GET /api/activation-queue`

**Files:**
- Create: `app/api/activation-queue/route.ts`

- [ ] **Step 1: Create `app/api/activation-queue/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fromDbRow, msgFromDbRow } from '@/types/activation'

export async function GET() {
  const { data: leads, error } = await supabase
    .from('activation_leads')
    .select('*, activation_messages(*)')
    .order('replied_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result = (leads ?? []).map((row) => ({
    ...fromDbRow(row),
    messages: (row.activation_messages ?? []).map(msgFromDbRow),
  }))

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/activation-queue/route.ts
git commit -m "feat: GET /api/activation-queue — fetch pipeline with messages"
```

---

## Task 10: `POST /api/twilio-webhook`

**Files:**
- Create: `app/api/twilio-webhook/route.ts`

- [ ] **Step 1: Create `app/api/twilio-webhook/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/activation'

export async function POST(request: Request) {
  // Validate Twilio signature
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const signature = request.headers.get('x-twilio-signature') ?? ''
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/twilio-webhook`

  const rawBody = await request.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody))

  const isValid = twilio.validateRequest(authToken, signature, url, params)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 })
  }

  const from: string = params.From ?? '' // e.g. "whatsapp:+27834567890"
  const body: string = params.Body ?? ''

  // Strip "whatsapp:" prefix and normalize
  const rawPhone = from.replace(/^whatsapp:/i, '')
  const phone = normalizePhone(rawPhone)

  // Find matching lead
  const { data: lead, error: findError } = await supabase
    .from('activation_leads')
    .select('id, status')
    .eq('phone', phone)
    .in('status', ['sent', 'queued'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (findError || !lead) {
    // No matching active lead — ignore
    return NextResponse.json({ received: true })
  }

  // Record inbound message
  await supabase.from('activation_messages').insert({
    lead_id: lead.id,
    direction: 'inbound',
    body,
    sequence_day: null,
    status: 'sent',
    channel: 'whatsapp',
    sent_at: new Date().toISOString(),
    scheduled_for: null,
  })

  // Cancel scheduled outbound messages
  await supabase
    .from('activation_messages')
    .update({ status: 'cancelled' })
    .eq('lead_id', lead.id)
    .eq('status', 'scheduled')

  // Update lead status to replied
  await supabase
    .from('activation_leads')
    .update({ status: 'replied', replied_at: new Date().toISOString() })
    .eq('id', lead.id)

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_APP_URL` to `.env.local`**

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Update this to your production URL when deploying.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/twilio-webhook/route.ts .env.local
git commit -m "feat: POST /api/twilio-webhook — receive reply, pause sequence, flag lead"
```

---

## Task 11: `PATCH /api/activation-leads/[id]` + cron

**Files:**
- Create: `app/api/activation-leads/[id]/route.ts`
- Create: `app/api/activation-cron/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create `app/api/activation-leads/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: { status: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!['booked', 'dead'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be booked or dead' }, { status: 400 })
  }

  const { error } = await supabase
    .from('activation_leads')
    .update({ status: body.status })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: true })
}
```

- [ ] **Step 2: Create `app/api/activation-cron/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendWhatsApp } from '@/lib/activation'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: due, error } = await supabase
    .from('activation_messages')
    .select('id, lead_id, body, activation_leads(phone, status)')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let failed = 0

  for (const msg of due ?? []) {
    const leadStatus = (msg.activation_leads as { status: string } | null)?.status
    // Skip if lead already replied, booked, or dead
    if (leadStatus && ['replied', 'booked', 'dead'].includes(leadStatus)) {
      await supabase
        .from('activation_messages')
        .update({ status: 'cancelled' })
        .eq('id', msg.id)
      continue
    }

    const phone = (msg.activation_leads as { phone: string } | null)?.phone
    if (!phone) continue

    try {
      await sendWhatsApp(phone, msg.body)
      await supabase
        .from('activation_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', msg.id)
      sent++
    } catch (err) {
      console.error('Failed to send scheduled message:', msg.id, err)
      await supabase
        .from('activation_messages')
        .update({ status: 'failed' })
        .eq('id', msg.id)
      failed++
    }
  }

  return NextResponse.json({ sent, failed })
}
```

- [ ] **Step 3: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/activation-cron",
      "schedule": "0 8 * * *"
    }
  ]
}
```

This runs daily at 08:00 UTC. Vercel will call the route with the `Authorization: Bearer <CRON_SECRET>` header automatically — but only on Vercel deployments. For local testing, call the route manually.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors. Note: if Next.js version uses `{ params: { id: string } }` instead of `Promise<{ id: string }>`, adjust accordingly — check `node_modules/next/dist/docs/` for the correct `params` type for your version.

- [ ] **Step 5: Commit**

```bash
git add app/api/activation-leads/ app/api/activation-cron/ vercel.json
git commit -m "feat: PATCH /api/activation-leads/[id] + activation-cron + vercel cron schedule"
```

---

## Task 12: `ActivationLeadCard` component

**Files:**
- Create: `components/activation/ActivationLeadCard.tsx`

- [ ] **Step 1: Check PRODUCT_DETAILS for setup fee display**

```bash
grep -A 4 "setupFee" lib/productMatch.ts | head -20
```

Note the format (e.g. `"R2,500"`). We display this in the Booked column.

- [ ] **Step 2: Create `components/activation/ActivationLeadCard.tsx`**

```typescript
'use client'

import { PRODUCT_DETAILS } from '@/lib/productMatch'
import type { ActivationLead } from '@/types/activation'

interface Props {
  lead: ActivationLead
  onTakeOver: (id: string) => void
  onMarkBooked: (id: string) => void
  onMarkDead: (id: string) => void
}

export default function ActivationLeadCard({ lead, onTakeOver, onMarkBooked, onMarkDead }: Props) {
  const lastMessage = lead.messages
    ?.filter((m) => m.status !== 'cancelled')
    .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))[0]

  const heatColors: Record<string, string> = {
    HOT: 'bg-red-100 text-red-700',
    WARM: 'bg-yellow-100 text-yellow-700',
    COLD: 'bg-blue-100 text-blue-600',
  }

  const productName = PRODUCT_DETAILS[lead.recommendedProduct]?.name ?? lead.recommendedProduct
  const setupFee = PRODUCT_DETAILS[lead.recommendedProduct]?.setupFee ?? ''

  return (
    <div
      className={`bg-white rounded-xl p-4 border ${
        lead.status === 'replied'
          ? 'border-amber-400 shadow-md'
          : 'border-gray-200'
      }`}
    >
      <div className="font-semibold text-sm text-gray-900">{lead.businessName}</div>
      <div className="text-xs text-gray-500 mt-0.5">{lead.phone} · {lead.location}</div>

      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${heatColors[lead.heatLevel]}`}>
          {lead.heatLevel} {lead.heatScore}
        </span>
        <span className="text-xs text-gray-400">{productName}</span>
      </div>

      {lastMessage && (
        <div className="mt-2 bg-gray-50 rounded-lg p-2 text-xs text-gray-600 italic line-clamp-2">
          "{lastMessage.body.slice(0, 100)}{lastMessage.body.length > 100 ? '…' : ''}"
        </div>
      )}

      {lead.status === 'replied' && (
        <div className="mt-3 space-y-1.5">
          <div className="text-xs font-semibold text-amber-600">
            🔔 Replied{lead.repliedAt ? ` · ${new Date(lead.repliedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
          <button
            onClick={() => onTakeOver(lead.id)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
          >
            Take Over Conversation
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => onMarkBooked(lead.id)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
            >
              Mark Booked
            </button>
            <button
              onClick={() => onMarkDead(lead.id)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold py-1.5 rounded-lg transition-colors"
            >
              Mark Dead
            </button>
          </div>
        </div>
      )}

      {lead.status === 'booked' && (
        <div className="mt-2 bg-green-50 rounded-lg p-2 text-center">
          <div className="text-base font-bold text-green-700">{setupFee}</div>
          <div className="text-xs text-green-600">setup fee expected</div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/activation/ActivationLeadCard.tsx
git commit -m "feat: ActivationLeadCard component"
```

---

## Task 13: `ActivationToolbar` component

**Files:**
- Create: `components/activation/ActivationToolbar.tsx`

- [ ] **Step 1: Create `components/activation/ActivationToolbar.tsx`**

```typescript
'use client'

import { SECTOR_LABELS } from '@/lib/productMatch'
import type { Sector } from '@/types/lead'

interface Props {
  totalLeads: number
  repliedCount: number
  queuedCount: number
  sectorFilter: Sector | 'all'
  onSectorFilterChange: (sector: Sector | 'all') => void
  onActivateAllQueued: () => void
  isActivating: boolean
}

export default function ActivationToolbar({
  totalLeads,
  repliedCount,
  queuedCount,
  sectorFilter,
  onSectorFilterChange,
  onActivateAllQueued,
  isActivating,
}: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <div className="text-sm text-gray-500">
        {totalLeads} leads
        {repliedCount > 0 && (
          <span className="ml-2 text-amber-600 font-semibold">
            · {repliedCount} need{repliedCount === 1 ? 's' : ''} attention
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={sectorFilter}
          onChange={(e) => onSectorFilterChange(e.target.value as Sector | 'all')}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
        >
          <option value="all">All sectors</option>
          {(Object.keys(SECTOR_LABELS) as Sector[]).map((s) => (
            <option key={s} value={s}>
              {SECTOR_LABELS[s]}
            </option>
          ))}
        </select>

        <button
          onClick={onActivateAllQueued}
          disabled={isActivating || queuedCount === 0}
          className="bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
        >
          {isActivating ? 'Activating…' : `⚡ Activate All Queued (${queuedCount})`}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/activation/ActivationToolbar.tsx
git commit -m "feat: ActivationToolbar component"
```

---

## Task 14: `ActivationPipeline` component

**Files:**
- Create: `components/activation/ActivationPipeline.tsx`

- [ ] **Step 1: Create `components/activation/ActivationPipeline.tsx`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import ActivationLeadCard from './ActivationLeadCard'
import ActivationToolbar from './ActivationToolbar'
import type { ActivationLead } from '@/types/activation'
import type { Sector } from '@/types/lead'

const COLUMNS: { key: ActivationLead['status']; label: string; color: string }[] = [
  { key: 'queued', label: 'Queue', color: 'text-gray-500' },
  { key: 'sent', label: 'Sent', color: 'text-blue-600' },
  { key: 'replied', label: '⚡ Replied', color: 'text-amber-600' },
  { key: 'booked', label: '✓ Booked', color: 'text-green-600' },
]

export default function ActivationPipeline() {
  const [leads, setLeads] = useState<ActivationLead[]>([])
  const [sectorFilter, setSectorFilter] = useState<Sector | 'all'>('all')
  const [isActivating, setIsActivating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchLeads = useCallback(async () => {
    const res = await fetch('/api/activation-queue')
    if (res.ok) {
      const data = await res.json()
      setLeads(data)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchLeads()
    const interval = setInterval(fetchLeads, 15000) // Poll every 15s
    return () => clearInterval(interval)
  }, [fetchLeads])

  const filtered = sectorFilter === 'all'
    ? leads
    : leads.filter((l) => l.sector === sectorFilter)

  const updateLeadStatus = async (id: string, status: 'booked' | 'dead') => {
    await fetch(`/api/activation-leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchLeads()
  }

  const handleTakeOver = (id: string) => {
    const lead = leads.find((l) => l.id === id)
    if (lead) {
      window.open(`https://wa.me/${lead.phone.replace('+', '')}`, '_blank')
    }
  }

  const handleActivateAllQueued = async () => {
    const queued = leads.filter((l) => l.status === 'queued')
    if (queued.length === 0) return
    setIsActivating(true)
    try {
      await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          queued.map((l) => ({
            businessName: l.businessName,
            ownerName: l.ownerName,
            phone: l.phone,
            sector: l.sector,
            recommendedProduct: l.recommendedProduct,
            heatScore: l.heatScore,
            heatLevel: l.heatLevel,
            location: l.location,
            agentName: l.agentName,
            sourceType: l.sourceType,
            hasWebsite: l.hasWebsite,
            googleMapsUrl: l.googleMapsUrl,
          })),
        ),
      })
    } finally {
      setIsActivating(false)
      fetchLeads()
    }
  }

  const repliedCount = leads.filter((l) => l.status === 'replied').length
  const queuedCount = leads.filter((l) => l.status === 'queued').length

  return (
    <div className="flex flex-col h-full">
      <ActivationToolbar
        totalLeads={leads.length}
        repliedCount={repliedCount}
        queuedCount={queuedCount}
        sectorFilter={sectorFilter}
        onSectorFilterChange={setSectorFilter}
        onActivateAllQueued={handleActivateAllQueued}
        isActivating={isActivating}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Loading pipeline…
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-4 gap-px bg-gray-200 overflow-auto">
          {COLUMNS.map(({ key, label, color }) => {
            const columnLeads = filtered.filter((l) => l.status === key)
            return (
              <div key={key} className={`bg-gray-50 p-3 min-h-96 ${key === 'replied' ? 'bg-amber-50' : ''} ${key === 'booked' ? 'bg-green-50' : ''}`}>
                <div className={`text-xs font-bold uppercase tracking-wider mb-3 ${color}`}>
                  {label} · {columnLeads.length}
                </div>
                <div className="space-y-2">
                  {columnLeads.map((lead) => (
                    <ActivationLeadCard
                      key={lead.id}
                      lead={lead}
                      onTakeOver={handleTakeOver}
                      onMarkBooked={(id) => updateLeadStatus(id, 'booked')}
                      onMarkDead={(id) => updateLeadStatus(id, 'dead')}
                    />
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-4">Empty</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/activation/ActivationPipeline.tsx
git commit -m "feat: ActivationPipeline component with polling + pipeline columns"
```

---

## Task 15: Wire up "Activate Leads" tab in `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update tab type and add tab button + content**

Edit `app/page.tsx`. Change:

```typescript
const [activeTab, setActiveTab] = useState<'enter' | 'discover'>('enter')
```
to:
```typescript
const [activeTab, setActiveTab] = useState<'enter' | 'discover' | 'activate'>('enter')
```

Add import at top of file:
```typescript
import ActivationPipeline from '@/components/activation/ActivationPipeline'
```

Add state for notification badge (add alongside existing state):
```typescript
const [repliedCount, setRepliedCount] = useState(0)

// Poll for replied count to drive the notification badge
useEffect(() => {
  const fetchRepliedCount = async () => {
    const res = await fetch('/api/activation-queue')
    if (res.ok) {
      const data: { status: string }[] = await res.json()
      setRepliedCount(data.filter((l) => l.status === 'replied').length)
    }
  }
  fetchRepliedCount()
  const interval = setInterval(fetchRepliedCount, 15000)
  return () => clearInterval(interval)
}, [])
```

In the tab bar, after the "Discover Leads" button, add:
```typescript
<button
  onClick={() => setActiveTab('activate')}
  className={`px-5 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
    activeTab === 'activate'
      ? 'bg-green-600 text-white'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  }`}
>
  Activate Leads
  {repliedCount > 0 && (
    <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-bold">
      {repliedCount}
    </span>
  )}
</button>
```

Replace the `<main>` block's `max-w-3xl` with conditional width:
```typescript
<main className={`${activeTab === 'activate' ? 'max-w-7xl' : 'max-w-3xl'} mx-auto w-full px-4 py-8 flex-1`}>
```

After the `{activeTab === 'discover' && <LeadDiscovery />}` block add:
```typescript
{activeTab === 'activate' && (
  <div className="-mx-4 -my-8">
    <ActivationPipeline />
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify tab appears**

```bash
npm run dev
```

Open http://localhost:3000. Confirm "Activate Leads" tab renders and shows the empty pipeline.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add Activate Leads tab to main page with notification badge"
```

---

## Task 16: Add "Activate Selected" to `LeadDiscovery.tsx`

**Files:**
- Modify: `components/LeadDiscovery.tsx`

- [ ] **Step 1: Find the existing bulk action button area**

```bash
grep -n "Download\|download\|selectedLeads\|selected" components/LeadDiscovery.tsx | head -20
```

Note the variable name holding selected leads and where bulk action buttons are rendered.

- [ ] **Step 2: Add `activateSelected` handler and button**

Find the section in `LeadDiscovery.tsx` where bulk actions (Download JSON / Download PDF) are rendered. Add a new `activateSelected` function and button alongside the existing ones.

Add handler (inside the component, alongside existing handlers):
```typescript
const [isActivating, setIsActivating] = useState(false)
const [activationResult, setActivationResult] = useState<{ activated: number; failed: number } | null>(null)

async function activateSelected() {
  const toActivate = results.filter((r) => selectedLeads.has(r.placeId))
  if (toActivate.length === 0) return
  setIsActivating(true)
  setActivationResult(null)
  try {
    const res = await fetch('/api/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        toActivate.map((lead) => ({
          businessName: lead.businessName,
          ownerName: undefined,
          phone: lead.phone,
          sector: lead.sector,
          recommendedProduct: lead.recommendedProduct,
          heatScore: lead.heatScore,
          heatLevel: lead.heatLevel,
          location: lead.location,
          agentName: agentName,
          sourceType: 'discovered' as const,
          hasWebsite: lead.hasWebsite,
          googleMapsUrl: lead.googleMapsUrl,
        })),
      ),
    })
    if (res.ok) {
      const data = await res.json()
      setActivationResult(data)
    }
  } finally {
    setIsActivating(false)
  }
}
```

> Note: `results`, `selectedLeads`, and `agentName` are the existing state variable names — confirm the exact names in the file before adding this code.

Add button in the bulk actions area alongside the existing Download buttons:
```typescript
<button
  onClick={activateSelected}
  disabled={isActivating || selectedLeads.size === 0}
  className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
>
  {isActivating ? 'Activating…' : `⚡ Activate Selected (${selectedLeads.size})`}
</button>
```

Add success/error feedback below the bulk actions bar:
```typescript
{activationResult && (
  <div className={`mt-3 px-4 py-3 rounded-xl text-sm font-medium ${
    activationResult.failed > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-green-50 text-green-800 border border-green-200'
  }`}>
    {activationResult.activated} lead{activationResult.activated !== 1 ? 's' : ''} activated
    {activationResult.failed > 0 && ` · ${activationResult.failed} failed (check console)`}
    {' — '}switch to the <strong>Activate Leads</strong> tab to track progress.
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/LeadDiscovery.tsx
git commit -m "feat: add Activate Selected button to LeadDiscovery"
```

---

## Task 17: Add "Add to Queue" to `LeadForm.tsx`

**Files:**
- Modify: `components/LeadForm.tsx`

- [ ] **Step 1: Find where the PDF success state is displayed**

```bash
grep -n "success\|PDF\|download" components/LeadForm.tsx | head -20
```

The form passes `onSubmit` to `app/page.tsx` which handles the PDF download. We need to add an "Add to Activation Queue" button that appears in the success state.

- [ ] **Step 2: Locate where `success` prop or state is used in the form**

Check if `LeadForm.tsx` receives a `success` prop or manages its own success state. The form calls `onSubmit(data)` — the parent (`app/page.tsx`) manages `success` state. So add the button to `app/page.tsx`'s success banner instead.

In `app/page.tsx`, find the success banner:
```typescript
{success && (
  <div className="mb-6 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
    ✓ PDF downloaded successfully! Fill in the next lead below.
  </div>
)}
```

Replace it with:
```typescript
{success && lastSubmittedLead && (
  <div className="mb-6 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4">
    <span>✓ PDF downloaded successfully!</span>
    <button
      onClick={async () => {
        if (!lastSubmittedLead) return
        await fetch('/api/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            businessName: lastSubmittedLead.businessName,
            ownerName: lastSubmittedLead.ownerName,
            phone: lastSubmittedLead.phone,
            sector: lastSubmittedLead.sector,
            recommendedProduct: lastSubmittedLead.recommendedProduct,
            heatScore: lastSubmittedLead.heatScore,
            heatLevel: lastSubmittedLead.heatScore >= 9 ? 'HOT' : lastSubmittedLead.heatScore >= 6 ? 'WARM' : 'COLD',
            location: lastSubmittedLead.location,
            agentName: lastSubmittedLead.agentName,
            sourceType: 'entered' as const,
            hasWebsite: lastSubmittedLead.hasWebsite,
          }]),
        })
        setActiveTab('activate')
      }}
      className="bg-green-700 hover:bg-green-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
    >
      ⚡ Add to Activation Queue
    </button>
  </div>
)}
```

Add `lastSubmittedLead` state alongside existing state in `app/page.tsx`:
```typescript
const [lastSubmittedLead, setLastSubmittedLead] = useState<LeadData | null>(null)
```

In the `handleSubmit` function, after `setSuccess(true)`:
```typescript
setLastSubmittedLead(data)
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add Add to Activation Queue button on lead entry success"
```

---

## Task 18: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Discover leads and activate**

1. Go to **Discover Leads** tab
2. Search for any sector in any SA location
3. Select 1-2 leads with phone numbers
4. Click **⚡ Activate Selected (N)**
5. Check success banner appears

- [ ] **Step 3: Verify Supabase records**

In Supabase dashboard → Table Editor → `activation_leads`:
- Confirm row was created with `status = 'sent'`

In `activation_messages`:
- Confirm 3 rows per lead: Day 1 `status = 'sent'`, Day 4 and Day 7 `status = 'scheduled'`

- [ ] **Step 4: Verify WhatsApp message received**

Check that the Day 1 WhatsApp message arrived on the test phone number (`+27693023981` — the `MTA_APPROVER_WHATSAPP` number — or use a real lead's number).

- [ ] **Step 5: Test Twilio webhook with a reply**

Reply to the WhatsApp message from the test phone. Then:
- Refresh the **Activate Leads** tab
- Confirm the lead card moved to the **Replied** column
- Confirm the amber notification badge increments on the tab

- [ ] **Step 6: Test "Take Over"**

Click **Take Over Conversation** on the replied lead card.
- Confirm it opens `https://wa.me/27XXXXXXXXX` in a new tab

- [ ] **Step 7: Test cron endpoint locally**

```bash
curl -X POST http://localhost:3000/api/activation-cron \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)"
```

Expected response: `{"sent":0,"failed":0}` (nothing due yet).

- [ ] **Step 8: Configure Twilio webhook URL**

In Twilio Console → Messaging → WhatsApp Senders → your number → Incoming Message webhook:

Set to: `https://<your-deployed-domain>/api/twilio-webhook`

For local testing, use ngrok:
```bash
npx ngrok http 3000
```
Copy the HTTPS URL and set it as the webhook in Twilio Console.

- [ ] **Step 9: Run all tests**

```bash
npx jest
```

Expected: all tests pass.

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "feat: lead activation system — WhatsApp outreach pipeline complete"
```
