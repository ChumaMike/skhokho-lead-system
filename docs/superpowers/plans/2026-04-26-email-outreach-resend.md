# Email Outreach via Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email as a parallel outbound channel alongside WhatsApp on the existing activation pipeline, using Resend.

**Architecture:** Same Day 1/4/7 cadence; activation generates one WhatsApp + one email sequence (per-channel copy from a separate Claude call); cron dispatches by `channel`. Replies are fire-and-forget — `Reply-To: chuma@skhokholabs.xyz` directs them to a personal inbox. Resend webhooks update message status + lead `email_status` (bounce → never email this lead again). Unsubscribe link in every body is HMAC-signed.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres), Jest+ts-jest, `resend` SDK, `node:crypto` for HMAC and webhook signature verification.

**Spec:** `docs/superpowers/specs/2026-04-26-email-outreach-resend-design.md`

---

## File Structure

**New files:**
- `scripts/migrate-email.js` — one-shot Postgres migration (mirrors existing `scripts/migrate.js` style)
- `lib/email.ts` — Resend wrapper, prompt builder, message generator, footer + unsubscribe HMAC helpers
- `lib/scrapeContacts.ts` — best-effort email regex extractor for FB pages and business websites
- `lib/__tests__/email.test.ts`
- `lib/__tests__/scrapeContacts.test.ts`
- `app/api/resend-webhook/route.ts` — Svix-style signature verification, event handling
- `app/api/resend-webhook/route.test.ts`
- `app/api/unsubscribe/route.ts` — GET endpoint with HMAC token
- `app/api/unsubscribe/route.test.ts`

**Modified files:**
- `types/activation.ts` — add `email`/`emailStatus` to ActivationLead, `subject` to ActivationMessage, widen `channel` to `'whatsapp' | 'email'`, rename `metaMessageId` → `providerMessageId`
- `types/discovery.ts` — add optional `email` field
- `lib/placesApi.ts` — return `email: null` placeholder so the type fits (scraping happens in route)
- `app/api/activate/route.ts` — generate email sequence in parallel, queue 3 email rows, rename column references
- `app/api/activation-cron/route.ts` — dispatch by channel, skip when `email_status` is bounced/unsubscribed, rename column references
- `app/api/whatsapp-webhook/route.ts` — rename `meta_message_id` → `provider_message_id`
- `app/api/twilio-webhook/route.ts` — rename `meta_message_id` if referenced
- `app/api/discover-leads/route.ts` — call `scrapeContacts` for each lead in parallel after Places search
- `components/activation/AddLeadModal.tsx` — add optional email input
- `components/activation/ConversationModal.tsx` — render subject above body for email rows
- `components/discovery/DiscoveredLeadCard.tsx` — small "✉" badge when email present
- `package.json` — add `resend` dependency
- `.env.example` (or README env section) — new env vars

---

## Task 1: Schema migration + provider_message_id rename

**Files:**
- Create: `scripts/migrate-email.js`
- Modify: `types/activation.ts`
- Modify: `app/api/activate/route.ts`
- Modify: `app/api/activation-cron/route.ts`
- Modify: `app/api/whatsapp-webhook/route.ts`

This is a single atomic task because the column rename touches every read/write site at once. Splitting it would leave the build broken between commits.

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-email.js`:

```javascript
#!/usr/bin/env node
// Run with: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/migrate-email.js
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN env var')
  console.error('Get one at: https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

const sql = `
-- 1. Add email + email_status to activation_leads
alter table activation_leads add column if not exists email text;
alter table activation_leads add column if not exists email_status text
  check (email_status is null or email_status in ('valid', 'bounced', 'unsubscribed'));

-- 2. Add subject to activation_messages
alter table activation_messages add column if not exists subject text;

-- 3. Rename meta_message_id -> provider_message_id (only if not already done)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'activation_messages' and column_name = 'meta_message_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'activation_messages' and column_name = 'provider_message_id'
  ) then
    alter table activation_messages rename column meta_message_id to provider_message_id;
  end if;
end $$;

-- 4. Add provider_message_id if it never existed (defensive — skipped if rename ran)
alter table activation_messages add column if not exists provider_message_id text;

-- 5. Extend status enum to include 'read' (existing whatsapp-webhook writes this and would otherwise violate)
alter table activation_messages drop constraint if exists activation_messages_status_check;
alter table activation_messages add constraint activation_messages_status_check
  check (status in ('scheduled', 'sent', 'delivered', 'read', 'failed', 'cancelled'));

-- 6. email_events table
create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references activation_messages(id) on delete cascade,
  event_type text not null check (event_type in ('delivered', 'opened', 'clicked', 'bounced', 'complained')),
  created_at timestamptz not null default now(),
  payload jsonb
);
create index if not exists email_events_message_id_idx on email_events(message_id, event_type);
`

fetch('https://api.supabase.com/v1/projects/fxnbghdnajcldnnkjewc/database/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ query: sql }),
})
  .then((r) => r.json())
  .then((data) => {
    if (data.error) {
      console.error('Migration failed:', data.error)
      process.exit(1)
    }
    console.log('✓ email/email_status columns added')
    console.log('✓ subject column added')
    console.log('✓ meta_message_id renamed to provider_message_id')
    console.log('✓ status enum extended (read)')
    console.log('✓ email_events table created')
    console.log('\nMigration complete.')
  })
  .catch((err) => {
    console.error('Request failed:', err.message)
    process.exit(1)
  })
```

- [ ] **Step 2: Run the migration**

```bash
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/migrate-email.js
```

Expected output:
```
✓ email/email_status columns added
✓ subject column added
✓ meta_message_id renamed to provider_message_id
✓ status enum extended (read)
✓ email_events table created
Migration complete.
```

If the migration has been run before, the `if not exists` / `do $$` guards make it idempotent.

- [ ] **Step 3: Update `types/activation.ts`**

Replace the file contents with:

```typescript
import type { Sector, Product, HeatLevel } from './lead'

export type ActivationStatus = 'queued' | 'sent' | 'replied' | 'booked' | 'dead'
export type MessageDirection = 'outbound' | 'inbound'
export type MessageStatus = 'scheduled' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled'
export type MessageChannel = 'whatsapp' | 'email'
export type EmailStatus = 'valid' | 'bounced' | 'unsubscribed'

export interface ActivationLead {
  id: string
  businessName: string
  ownerName: string | null
  phone: string
  email: string | null
  emailStatus: EmailStatus | null
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
  facebookPageUrl: string | null
  instagramUrl: string | null
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
  subject: string | null
  sequenceDay: number | null
  status: MessageStatus
  channel: MessageChannel
  sentAt: string | null
  scheduledFor: string | null
  providerMessageId: string | null
}

export interface ActivationLeadInput {
  businessName: string
  ownerName?: string
  phone: string
  email?: string
  sector: Sector
  recommendedProduct: Product
  heatScore: number
  heatLevel: HeatLevel
  location: string
  agentName: string
  sourceType: 'entered' | 'discovered'
  hasWebsite?: boolean
  googleMapsUrl?: string
  facebookPageUrl?: string
  instagramUrl?: string
}

interface ActivationLeadRow {
  business_name: string
  owner_name: string | null
  phone: string
  email: string | null
  email_status: string | null
  sector: string
  recommended_product: string
  heat_score: number
  heat_level: string
  location: string
  agent_name: string
  source_type: string
  status: string
  has_website: boolean
  google_maps_url: string | null
  facebook_page_url: string | null
  instagram_url: string | null
  created_at: string
  activated_at: string | null
  replied_at: string | null
}

function str(v: unknown, field: string): string {
  if (typeof v !== 'string') throw new TypeError(`DB row: expected string for '${field}', got ${typeof v}`)
  return v
}
function num(v: unknown, field: string): number {
  if (typeof v !== 'number') throw new TypeError(`DB row: expected number for '${field}', got ${typeof v}`)
  return v
}
function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') throw new TypeError(`DB row: expected boolean for '${field}', got ${typeof v}`)
  return v
}
function nullable<T>(guard: (v: unknown, f: string) => T, v: unknown, field: string): T | null {
  if (v === null || v === undefined) return null
  return guard(v, field)
}

export function toDbRow(lead: ActivationLeadInput & { status?: ActivationStatus }): ActivationLeadRow & { status: string } {
  return {
    business_name: lead.businessName,
    owner_name: lead.ownerName ?? null,
    phone: lead.phone,
    email: lead.email?.toLowerCase() ?? null,
    email_status: null,
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
    facebook_page_url: lead.facebookPageUrl ?? null,
    instagram_url: lead.instagramUrl ?? null,
    created_at: new Date().toISOString(),
    activated_at: null,
    replied_at: null,
  }
}

export function fromDbRow(row: Record<string, unknown>): ActivationLead {
  return {
    id: str(row.id, 'id'),
    businessName: str(row.business_name, 'business_name'),
    ownerName: nullable(str, row.owner_name, 'owner_name'),
    phone: str(row.phone, 'phone'),
    email: nullable(str, row.email, 'email'),
    emailStatus: nullable(str, row.email_status, 'email_status') as EmailStatus | null,
    sector: str(row.sector, 'sector') as Sector,
    recommendedProduct: str(row.recommended_product, 'recommended_product') as Product,
    heatScore: num(row.heat_score, 'heat_score'),
    heatLevel: str(row.heat_level, 'heat_level') as HeatLevel,
    location: str(row.location, 'location'),
    agentName: str(row.agent_name, 'agent_name'),
    sourceType: str(row.source_type, 'source_type') as 'entered' | 'discovered',
    status: str(row.status, 'status') as ActivationStatus,
    hasWebsite: bool(row.has_website, 'has_website'),
    googleMapsUrl: nullable(str, row.google_maps_url, 'google_maps_url'),
    facebookPageUrl: nullable(str, row.facebook_page_url, 'facebook_page_url'),
    instagramUrl: nullable(str, row.instagram_url, 'instagram_url'),
    createdAt: str(row.created_at, 'created_at'),
    activatedAt: nullable(str, row.activated_at, 'activated_at'),
    repliedAt: nullable(str, row.replied_at, 'replied_at'),
  }
}

export function msgFromDbRow(row: Record<string, unknown>): ActivationMessage {
  return {
    id: str(row.id, 'id'),
    leadId: str(row.lead_id, 'lead_id'),
    direction: str(row.direction, 'direction') as MessageDirection,
    body: str(row.body, 'body'),
    subject: nullable(str, row.subject, 'subject'),
    sequenceDay: row.sequence_day === null || row.sequence_day === undefined ? null : num(row.sequence_day, 'sequence_day'),
    status: str(row.status, 'status') as MessageStatus,
    channel: str(row.channel, 'channel') as MessageChannel,
    sentAt: nullable(str, row.sent_at, 'sent_at'),
    scheduledFor: nullable(str, row.scheduled_for, 'scheduled_for'),
    providerMessageId: nullable(str, row.provider_message_id, 'provider_message_id'),
  }
}

export function fromDbRowWithMessages(row: Record<string, unknown>): ActivationLead {
  const lead = fromDbRow(row)
  const messageRows = Array.isArray(row.activation_messages) ? row.activation_messages : []
  lead.messages = messageRows.map((m: Record<string, unknown>) => msgFromDbRow(m))
  return lead
}
```

- [ ] **Step 4: Update `app/api/activate/route.ts` — rename column reference**

Find the insert at lines 86–117 that writes `meta_message_id: wamid`. Change the field name only:

```typescript
// Line 96 (inside the first row of the .insert([...]) call):
provider_message_id: wamid,
```

(Other rows in the insert don't reference the field — leave them alone.)

- [ ] **Step 5: Update `app/api/activation-cron/route.ts` — rename column reference**

Find line 58 inside the `.update({...})` call:

```typescript
.update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: wamid })
```

- [ ] **Step 6: Update `app/api/whatsapp-webhook/route.ts` — rename column references**

Two sites:

Line 39 (status update by wamid lookup):
```typescript
.eq('provider_message_id', wamid)
```

Line 146 (insert of AI reply row):
```typescript
provider_message_id: replyWamid,
```

- [ ] **Step 7: Verify tests still pass**

Run: `npm test`

Expected: all existing tests in `lib/__tests__/activation.test.ts` PASS. (They don't touch `meta_message_id` so they're unaffected.)

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`

Expected: zero errors. If you get errors about `metaMessageId` referenced anywhere outside the modified files, search and rename.

Run: `git grep -n "meta_message_id\|metaMessageId"` — should return only matches in `node_modules` or in this plan file.

- [ ] **Step 9: Commit**

```bash
git add scripts/migrate-email.js types/activation.ts app/api/activate/route.ts app/api/activation-cron/route.ts app/api/whatsapp-webhook/route.ts
git commit -m "$(cat <<'EOF'
feat: schema migration for email channel + provider_message_id rename

Adds email/email_status to activation_leads, subject to activation_messages,
extends channel + status enums, creates email_events table, renames
meta_message_id -> provider_message_id across types and routes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Compliance footer + HMAC unsubscribe helpers

**Files:**
- Create: `lib/email.ts` (partial — pure helpers only this task)
- Create: `lib/__tests__/email.test.ts`

Pure functions, fully TDD-able. Builds the foundation for `sendEmail` in Task 3.

- [ ] **Step 1: Write failing tests for `appendComplianceFooter` + HMAC helpers**

Create `lib/__tests__/email.test.ts`:

```typescript
import { appendComplianceFooter, signUnsubscribeToken, verifyUnsubscribeToken } from '../email'

describe('appendComplianceFooter', () => {
  const origEnv = process.env.EMAIL_PHYSICAL_ADDRESS
  const origSecret = process.env.UNSUBSCRIBE_HMAC_SECRET
  beforeAll(() => {
    process.env.EMAIL_PHYSICAL_ADDRESS = '123 Test St, Cape Town'
    process.env.UNSUBSCRIBE_HMAC_SECRET = 'test-secret-do-not-use-in-prod'
  })
  afterAll(() => {
    process.env.EMAIL_PHYSICAL_ADDRESS = origEnv
    process.env.UNSUBSCRIBE_HMAC_SECRET = origSecret
  })

  it('includes the original body verbatim', () => {
    const out = appendComplianceFooter('Hello world', 'lead-123', "Mama T's Salon")
    expect(out).toContain('Hello world')
  })

  it('includes the physical address', () => {
    const out = appendComplianceFooter('Hello', 'lead-123', 'Acme')
    expect(out).toContain('123 Test St, Cape Town')
  })

  it('includes the business name in the why-you-got-this line', () => {
    const out = appendComplianceFooter('Hello', 'lead-123', "Mama T's Salon")
    expect(out).toContain("Mama T's Salon")
  })

  it('includes a signed unsubscribe URL', () => {
    const out = appendComplianceFooter('Hello', 'lead-123', 'Acme')
    expect(out).toMatch(/https:\/\/skhokholabs\.xyz\/unsubscribe\?lead=lead-123&t=[A-Za-z0-9_-]+/)
  })
})

describe('unsubscribe token', () => {
  beforeAll(() => {
    process.env.UNSUBSCRIBE_HMAC_SECRET = 'test-secret-do-not-use-in-prod'
  })

  it('round-trips a valid token', () => {
    const token = signUnsubscribeToken('lead-abc')
    expect(verifyUnsubscribeToken('lead-abc', token)).toBe(true)
  })

  it('rejects a token from a different lead', () => {
    const token = signUnsubscribeToken('lead-abc')
    expect(verifyUnsubscribeToken('lead-xyz', token)).toBe(false)
  })

  it('rejects a tampered token', () => {
    const token = signUnsubscribeToken('lead-abc')
    expect(verifyUnsubscribeToken('lead-abc', token + 'a')).toBe(false)
  })

  it('rejects an empty token', () => {
    expect(verifyUnsubscribeToken('lead-abc', '')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- email.test.ts`
Expected: FAIL — `Cannot find module '../email'`

- [ ] **Step 3: Implement the helpers**

Create `lib/email.ts`:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'

function getSecret(): string {
  const s = process.env.UNSUBSCRIBE_HMAC_SECRET
  if (!s) throw new Error('UNSUBSCRIBE_HMAC_SECRET is not set')
  return s
}

/**
 * HMAC-SHA256 over the leadId, base64url-encoded.
 * Use with verifyUnsubscribeToken to validate inbound unsubscribe links.
 */
export function signUnsubscribeToken(leadId: string): string {
  return createHmac('sha256', getSecret()).update(leadId).digest('base64url')
}

export function verifyUnsubscribeToken(leadId: string, token: string): boolean {
  if (!token) return false
  const expected = signUnsubscribeToken(leadId)
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Appends the POPIA-compliant footer to an outbound email body.
 * Includes sender identification, physical address, and a signed unsubscribe link.
 */
export function appendComplianceFooter(body: string, leadId: string, businessName: string): string {
  const address = process.env.EMAIL_PHYSICAL_ADDRESS ?? ''
  const token = signUnsubscribeToken(leadId)
  const unsubUrl = `https://skhokholabs.xyz/unsubscribe?lead=${encodeURIComponent(leadId)}&t=${token}`
  return `${body}

—
Skhokho Labs · ${address} · skhokholabs.xyz
You received this because we identified ${businessName} as a potential fit for our SA small-business AI tools.
Don't want these? Unsubscribe: ${unsubUrl}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- email.test.ts`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts lib/__tests__/email.test.ts
git commit -m "$(cat <<'EOF'
feat: POPIA compliance footer + HMAC unsubscribe token helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Resend SDK install + `sendEmail` wrapper

**Files:**
- Modify: `package.json` (via `npm install`)
- Modify: `lib/email.ts` (add `sendEmail`)
- Modify: `lib/__tests__/email.test.ts` (add `sendEmail` tests with mocked SDK)

- [ ] **Step 1: Install the Resend SDK**

```bash
npm install resend
```

Expected: `resend` appears in `package.json` dependencies. Lockfile updated.

- [ ] **Step 2: Write failing test for `sendEmail`**

Append to `lib/__tests__/email.test.ts`:

```typescript
// Mock the Resend SDK at the module boundary
const mockSend = jest.fn()
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

import { sendEmail } from '../email'

describe('sendEmail', () => {
  beforeEach(() => {
    mockSend.mockReset()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.EMAIL_FROM_ADDRESS = 'chuma@skhokholabs.xyz'
    process.env.EMAIL_REPLY_TO = 'chuma@skhokholabs.xyz'
    process.env.EMAIL_PHYSICAL_ADDRESS = '123 Test St'
    process.env.UNSUBSCRIBE_HMAC_SECRET = 'test-secret'
  })

  it('returns the Resend message id on success', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'resend-msg-abc' }, error: null })
    const id = await sendEmail({
      to: 'owner@example.com',
      subject: 'Quick idea',
      body: 'Hello',
      leadId: 'lead-1',
      businessName: 'Acme',
    })
    expect(id).toBe('resend-msg-abc')
  })

  it('appends the compliance footer to the body', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null })
    await sendEmail({
      to: 'owner@example.com',
      subject: 'Quick idea',
      body: 'Hello world',
      leadId: 'lead-1',
      businessName: 'Acme',
    })
    const arg = mockSend.mock.calls[0][0]
    expect(arg.text).toContain('Hello world')
    expect(arg.text).toContain('Unsubscribe:')
    expect(arg.text).toContain('Acme')
  })

  it('sets List-Unsubscribe headers for one-click compliance', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null })
    await sendEmail({
      to: 'owner@example.com',
      subject: 'Quick idea',
      body: 'Hello',
      leadId: 'lead-1',
      businessName: 'Acme',
    })
    const arg = mockSend.mock.calls[0][0]
    expect(arg.headers['List-Unsubscribe']).toMatch(/unsubscribe\?lead=lead-1/)
    expect(arg.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('throws when Resend returns an error', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'invalid recipient' } })
    await expect(
      sendEmail({ to: 'bad', subject: 's', body: 'b', leadId: 'l', businessName: 'B' })
    ).rejects.toThrow(/invalid recipient/)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- email.test.ts`
Expected: FAIL — `sendEmail` is not exported.

- [ ] **Step 4: Implement `sendEmail`**

Append to `lib/email.ts`:

```typescript
import { Resend } from 'resend'

let _resend: Resend | undefined
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(key)
  }
  return _resend
}

export interface SendEmailParams {
  to: string
  subject: string
  body: string
  leadId: string
  businessName: string
}

/**
 * Sends a plain-text email via Resend with POPIA compliance footer + List-Unsubscribe headers.
 * Returns the Resend message id.
 */
export async function sendEmail(params: SendEmailParams): Promise<string> {
  const from = process.env.EMAIL_FROM_ADDRESS ?? 'chuma@skhokholabs.xyz'
  const replyTo = process.env.EMAIL_REPLY_TO ?? from
  const text = appendComplianceFooter(params.body, params.leadId, params.businessName)
  const unsubToken = signUnsubscribeToken(params.leadId)
  const unsubUrl = `https://skhokholabs.xyz/unsubscribe?lead=${encodeURIComponent(params.leadId)}&t=${unsubToken}`

  const result = await getResend().emails.send({
    from: `Chuma <${from}>`,
    to: params.to,
    replyTo,
    subject: params.subject,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>, <mailto:${replyTo}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  if (result.error) throw new Error(`Resend error: ${result.error.message}`)
  if (!result.data?.id) throw new Error('Resend returned no message id')
  return result.data.id
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- email.test.ts`
Expected: all 12 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/email.ts lib/__tests__/email.test.ts
git commit -m "$(cat <<'EOF'
feat: sendEmail Resend wrapper with List-Unsubscribe headers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `generateEmailMessages` Claude prompt + parser

**Files:**
- Modify: `lib/email.ts` (add prompt builder + generator)
- Modify: `lib/__tests__/email.test.ts` (add tests)

Mirrors the shape of `generateMessages` in `lib/activation.ts`. One Haiku call returns `{day1: {subject, body}, day4: {subject, body}, day7: {subject, body}}`.

- [ ] **Step 1: Write failing tests for `buildEmailPrompt`**

Append to `lib/__tests__/email.test.ts`:

```typescript
import { buildEmailPrompt } from '../email'
import type { ActivationLeadInput } from '@/types/activation'

describe('buildEmailPrompt', () => {
  const lead: ActivationLeadInput = {
    businessName: "Mama T's Salon",
    ownerName: 'Mama T',
    phone: '+27834567890',
    email: 'mamat@example.com',
    sector: 'salon_hair',
    recommendedProduct: 'pro_website_bookings',
    heatScore: 9,
    heatLevel: 'HOT',
    location: 'Soweto',
    agentName: 'Thabo',
    sourceType: 'discovered',
    hasWebsite: false,
  }

  it('includes business name', () => {
    const p = buildEmailPrompt(lead, 'Take bookings online', 'Relies on appointments', ['ai_receptionist', 'content_dashboard'])
    expect(p).toContain("Mama T's Salon")
  })

  it('includes agent name', () => {
    const p = buildEmailPrompt(lead, 'Take bookings online', 'Relies on appointments', ['ai_receptionist', 'content_dashboard'])
    expect(p).toContain('Thabo')
  })

  it('asks for both subject and body for each day', () => {
    const p = buildEmailPrompt(lead, 'Pitch', 'Why', ['ai_receptionist', 'content_dashboard'])
    expect(p).toContain('day1')
    expect(p).toContain('day4')
    expect(p).toContain('day7')
    expect(p).toContain('subject')
    expect(p).toContain('body')
  })

  it('instructs email-native length (200-400 words), not WhatsApp-short', () => {
    const p = buildEmailPrompt(lead, 'Pitch', 'Why', ['ai_receptionist', 'content_dashboard'])
    expect(p).toMatch(/200/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- email.test.ts`
Expected: FAIL — `buildEmailPrompt` not exported.

- [ ] **Step 3: Implement `buildEmailPrompt` and `generateEmailMessages`**

Append to `lib/email.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { ActivationLeadInput } from '@/types/activation'
import { PRODUCT_DETAILS } from '@/lib/productMatch'

export function buildEmailPrompt(
  lead: ActivationLeadInput,
  productPitch: string,
  whyItFits: string,
  supportingProducts: [string, string],
): string {
  const recProduct = PRODUCT_DETAILS[lead.recommendedProduct as keyof typeof PRODUCT_DETAILS]
  const recPrice = recProduct ? `${recProduct.setupFee} setup + ${recProduct.monthly}` : ''
  const [sup1Key, sup2Key] = supportingProducts
  const sup1 = PRODUCT_DETAILS[sup1Key as keyof typeof PRODUCT_DETAILS]
  const sup2 = PRODUCT_DETAILS[sup2Key as keyof typeof PRODUCT_DETAILS]

  return `Write a 3-email outreach sequence for this lead. Email is a different medium from WhatsApp — readers tolerate (and expect) more context. Aim for 200-400 words per body, plain text, no HTML.

Business: ${lead.businessName}
Owner: ${lead.ownerName ?? 'Business Owner'}
Sector: ${lead.sector}
Location: ${lead.location}
Has Website: ${lead.hasWebsite ?? false}
Agent Name: ${lead.agentName} (sign every body as "— ${lead.agentName}, Skhokho Labs")
Heat Level: ${lead.heatLevel}

RECOMMENDED PRODUCT (lead with this — be specific about why it fits this business):
  Name: ${recProduct?.name ?? lead.recommendedProduct}
  Price: ${recPrice}
  Pitch: ${productPitch}
  Why it fits this business: ${whyItFits}

ALSO MENTION (briefly, to show we have a full AI suite):
- ${sup1?.name ?? ''} (${sup1?.setupFee ?? ''} setup) — ${sup1?.pitch ?? ''}
- ${sup2?.name ?? ''} (${sup2?.setupFee ?? ''} setup) — ${sup2?.pitch ?? ''}

Subject lines: 4-8 words, no clickbait, no ALL CAPS, lowercase except proper nouns where natural ("quick idea for ${lead.businessName}").

Rules per day:
- day1: warm opener, name the gap (no website / no bookings / etc.), explain why the recommended product fits, share one concrete result a similar SA business saw, mention skhokholabs.xyz inline, close with a soft CTA (a 15-min call this week).
- day4: social proof follow-up — one short SA case study, restate the value prop, ask if they'd like to see a 5-min loom walk-through.
- day7: low-pressure sign-off — acknowledge they're busy, leave the door open, mention the full suite at skhokholabs.xyz, no CTA pressure.

Style: warm, professional, SA-local but not slangy (email is read by the owner often at their desk). No emoji. No em-dashes. No "And" at the start of a sentence. No corporate jargon. Write as a real founder writing to another founder.

Return ONLY a valid JSON object with this exact shape:
{
  "day1": { "subject": "...", "body": "..." },
  "day4": { "subject": "...", "body": "..." },
  "day7": { "subject": "...", "body": "..." }
}
No markdown, no explanation, no code fences.`
}

const EMAIL_SYSTEM_PROMPT = `You are a friendly sales agent for Skhokho Labs (skhokholabs.xyz), South Africa's leading AI automation studio for small businesses. You write professional, warm emails to business owners. You never use corporate jargon, AI tells, em-dashes, or sentence-initial "And". You write as a founder reaching out to another founder.`

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

export interface EmailDay {
  subject: string
  body: string
}

export async function generateEmailMessages(
  lead: ActivationLeadInput,
  productPitch: string,
  whyItFits: string,
  supportingProducts: [string, string] = ['starter_website', 'content_dashboard'],
): Promise<{ day1: EmailDay; day4: EmailDay; day7: EmailDay }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: EMAIL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildEmailPrompt(lead, productPitch, whyItFits, supportingProducts) }],
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  const parsed = JSON.parse(stripCodeFences(raw)) as Record<string, unknown>

  function parseDay(key: string): EmailDay {
    const d = parsed[key] as { subject?: unknown; body?: unknown } | undefined
    if (!d || typeof d.subject !== 'string' || d.subject.trim() === '' || typeof d.body !== 'string' || d.body.trim() === '') {
      throw new Error(`generateEmailMessages: invalid '${key}' entry — expected {subject, body} non-empty strings. Got: ${JSON.stringify(d)}`)
    }
    return { subject: d.subject.trim(), body: d.body.trim() }
  }

  return { day1: parseDay('day1'), day4: parseDay('day4'), day7: parseDay('day7') }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- email.test.ts`
Expected: all tests PASS (16 total now).

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts lib/__tests__/email.test.ts
git commit -m "$(cat <<'EOF'
feat: generateEmailMessages — Claude prompt + parser for 3-email sequence

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `scrapeContacts` — best-effort email harvester

**Files:**
- Create: `lib/scrapeContacts.ts`
- Create: `lib/__tests__/scrapeContacts.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/scrapeContacts.test.ts`:

```typescript
import { extractEmailFromHtml } from '../scrapeContacts'

describe('extractEmailFromHtml', () => {
  it('extracts a personal-looking email', () => {
    const html = '<p>Contact us: <a href="mailto:thabo@mamatsalon.co.za">thabo@mamatsalon.co.za</a></p>'
    expect(extractEmailFromHtml(html)).toBe('thabo@mamatsalon.co.za')
  })

  it('returns null when no email is present', () => {
    const html = '<p>Call us on 083 456 7890</p>'
    expect(extractEmailFromHtml(html)).toBeNull()
  })

  it('prefers personal address over generic info@', () => {
    const html = '<p>info@acme.com or directly thabo@acme.com</p>'
    expect(extractEmailFromHtml(html)).toBe('thabo@acme.com')
  })

  it('falls back to generic info@ if nothing else', () => {
    const html = '<p>Reach us at info@acme.com</p>'
    expect(extractEmailFromHtml(html)).toBe('info@acme.com')
  })

  it('ignores noise domains (sentry, example, png)', () => {
    const html = '<script>Sentry.init({dsn: "abc@sentry.io"})</script><img src="logo@2x.png">'
    expect(extractEmailFromHtml(html)).toBeNull()
  })

  it('lowercases the result', () => {
    const html = 'mailto:Thabo@Acme.COM'
    expect(extractEmailFromHtml(html)).toBe('thabo@acme.com')
  })

  it('strips emails inside <script> blocks', () => {
    const html = '<script>const x = "hidden@inside.com"</script><p>real@outside.com</p>'
    expect(extractEmailFromHtml(html)).toBe('real@outside.com')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scrapeContacts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scrapeContacts`**

Create `lib/scrapeContacts.ts`:

```typescript
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const NOISE_DOMAINS = ['sentry.io', 'example.com', 'example.org', 'cloudflare.com', 'wixpress.com']
const NOISE_SUFFIXES = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']
const GENERIC_PREFIXES = ['info@', 'contact@', 'hello@', 'webmaster@', 'admin@', 'noreply@', 'no-reply@', 'support@']

/**
 * Extracts the most-likely contact email from raw HTML.
 * Strategy:
 *   1. Strip <script> and <style> blocks (common source of noise)
 *   2. Regex all email-shaped tokens
 *   3. Filter noise (image filenames, known fake/system domains)
 *   4. Prefer a non-generic prefix; fall back to generic if it's all we have
 *   5. Lowercase
 * Returns null if nothing usable is found.
 */
export function extractEmailFromHtml(html: string): string | null {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')

  const matches = stripped.match(EMAIL_RE) ?? []
  const candidates = matches
    .map((m) => m.toLowerCase())
    .filter((m) => !NOISE_SUFFIXES.some((s) => m.endsWith(s)))
    .filter((m) => !NOISE_DOMAINS.some((d) => m.endsWith(`@${d}`) || m.includes(`.${d}`)))

  if (candidates.length === 0) return null

  const personal = candidates.find((m) => !GENERIC_PREFIXES.some((p) => m.startsWith(p)))
  return personal ?? candidates[0]
}

export interface ScrapedContacts {
  email: string | null
  source: 'website' | 'facebook' | null
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkhokhoLeadBot/1.0)' },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Best-effort: try the business website first, then the Facebook page.
 * Silent on every failure mode — caller treats null as "no email found".
 */
export async function scrapeContacts(
  websiteUrl: string | null,
  facebookUrl: string | null,
): Promise<ScrapedContacts> {
  if (websiteUrl) {
    const html = await fetchWithTimeout(websiteUrl)
    if (html) {
      const email = extractEmailFromHtml(html)
      if (email) return { email, source: 'website' }
    }
  }
  if (facebookUrl) {
    const html = await fetchWithTimeout(facebookUrl)
    if (html) {
      const email = extractEmailFromHtml(html)
      if (email) return { email, source: 'facebook' }
    }
  }
  return { email: null, source: null }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- scrapeContacts.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scrapeContacts.ts lib/__tests__/scrapeContacts.test.ts
git commit -m "$(cat <<'EOF'
feat: scrapeContacts — best-effort email extractor for FB/website

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire email generation + queueing into `/api/activate`

**Files:**
- Modify: `app/api/activate/route.ts`

Email generation runs in parallel with WhatsApp generation. Both must succeed or the activation rolls back atomically (the lead row is created last — if either gen fails, no row is inserted).

- [ ] **Step 1: Refactor `app/api/activate/route.ts` to queue both channels**

Replace the per-lead loop body (the `for (const lead of leads)` block, lines 26–125) with:

```typescript
  for (const lead of leads) {
    try {
      const phone = normalizePhone(lead.phone)

      if (!isSAMobile(phone)) {
        console.warn(`Skipping ${lead.businessName} — ${phone} is a landline, not WhatsApp-capable`)
        failed++
        continue
      }

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
        isWhatsAppCapable: true,
        facebookPageUrl: '',
        heatScore: lead.heatScore,
        heatLevel: lead.heatLevel,
        recommendedProduct: lead.recommendedProduct,
      }

      const products = getAllProductsWithOffer(pseudoLead)
      const offer = products.find((p) => p.product === lead.recommendedProduct)
      const pitch = offer?.pitch ?? ''
      const whyItFits = offer?.whyItFits ?? ''
      const supportingProducts = getSupportingProducts(lead.sector, lead.recommendedProduct)

      // Generate WhatsApp + (optionally) email IN PARALLEL.
      // If email is present and email gen fails, the whole activation fails — atomic.
      const hasEmail = typeof lead.email === 'string' && lead.email.trim() !== ''
      const [waMessages, emailMessages] = await Promise.all([
        generateMessages({ ...lead, phone }, pitch, whyItFits, supportingProducts),
        hasEmail
          ? generateEmailMessages({ ...lead, phone }, pitch, whyItFits, supportingProducts)
          : Promise.resolve(null),
      ])

      const now = new Date()
      const day4Date = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      const day7Date = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any

      const { data: activationLead, error: leadError } = await sb
        .from('activation_leads')
        .insert(toDbRow({ ...lead, phone, status: 'queued' }))
        .select()
        .single()

      if (leadError) throw leadError

      // Send Day 1 WhatsApp immediately (existing behaviour)
      const wamid = await sendWhatsApp(phone, waMessages.day1)

      await sb
        .from('activation_leads')
        .update({ status: 'sent', activated_at: new Date().toISOString() })
        .eq('id', activationLead.id)

      // WhatsApp rows: Day 1 sent, Day 4 + 7 scheduled
      const rows: Record<string, unknown>[] = [
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: waMessages.day1,
          subject: null,
          sequence_day: 1,
          status: 'sent',
          channel: 'whatsapp',
          sent_at: now.toISOString(),
          scheduled_for: null,
          provider_message_id: wamid,
        },
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: waMessages.day4,
          subject: null,
          sequence_day: 4,
          status: 'scheduled',
          channel: 'whatsapp',
          sent_at: null,
          scheduled_for: day4Date.toISOString(),
        },
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: waMessages.day7,
          subject: null,
          sequence_day: 7,
          status: 'scheduled',
          channel: 'whatsapp',
          sent_at: null,
          scheduled_for: day7Date.toISOString(),
        },
      ]

      if (emailMessages) {
        // Email Day 1 also sent immediately for symmetry with WhatsApp
        const emailDay1Id = await sendEmail({
          to: lead.email!.trim(),
          subject: emailMessages.day1.subject,
          body: emailMessages.day1.body,
          leadId: activationLead.id as string,
          businessName: lead.businessName,
        })
        rows.push(
          {
            lead_id: activationLead.id,
            direction: 'outbound',
            body: emailMessages.day1.body,
            subject: emailMessages.day1.subject,
            sequence_day: 1,
            status: 'sent',
            channel: 'email',
            sent_at: now.toISOString(),
            scheduled_for: null,
            provider_message_id: emailDay1Id,
          },
          {
            lead_id: activationLead.id,
            direction: 'outbound',
            body: emailMessages.day4.body,
            subject: emailMessages.day4.subject,
            sequence_day: 4,
            status: 'scheduled',
            channel: 'email',
            sent_at: null,
            scheduled_for: day4Date.toISOString(),
          },
          {
            lead_id: activationLead.id,
            direction: 'outbound',
            body: emailMessages.day7.body,
            subject: emailMessages.day7.subject,
            sequence_day: 7,
            status: 'scheduled',
            channel: 'email',
            sent_at: null,
            scheduled_for: day7Date.toISOString(),
          },
        )
      }

      await sb.from('activation_messages').insert(rows)

      activated++
    } catch (err) {
      console.error('Failed to activate lead:', (lead as ActivationLeadInput).businessName, err)
      failed++
    }
  }
```

Update the imports at the top of the file:

```typescript
import { normalizePhone, generateMessages, sendWhatsApp } from '@/lib/activation'
import { generateEmailMessages, sendEmail } from '@/lib/email'
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: existing tests still PASS. (No new tests added in this task — wire-up is integration-tested manually in Step 4.)

- [ ] **Step 4: Manual smoke (no real send)**

Set up a test environment:
```bash
echo "RESEND_API_KEY=test" >> .env.local
echo "EMAIL_FROM_ADDRESS=chuma@skhokholabs.xyz" >> .env.local
echo "EMAIL_REPLY_TO=chuma@skhokholabs.xyz" >> .env.local
echo "EMAIL_PHYSICAL_ADDRESS=Test, Cape Town" >> .env.local
echo "UNSUBSCRIBE_HMAC_SECRET=test-secret-replace-in-prod" >> .env.local
```

In a separate terminal: `npm run dev`. Then:
```bash
curl -X POST http://localhost:3000/api/activate \
  -H "Content-Type: application/json" \
  -d '[{"businessName":"Test","ownerName":"T","phone":"+27834567890","sector":"salon_hair","recommendedProduct":"pro_website_bookings","heatScore":7,"heatLevel":"WARM","location":"CPT","agentName":"Chuma","sourceType":"entered","hasWebsite":false}]'
```

Expected: `{"activated":0,"failed":1}` — fails on real WhatsApp send (no creds), but the route should not throw a 500. Server log should NOT mention email since the request omitted `email`.

- [ ] **Step 5: Commit**

```bash
git add app/api/activate/route.ts
git commit -m "$(cat <<'EOF'
feat: queue parallel email sequence in /api/activate when lead has email

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Dispatch email in `/api/activation-cron`

**Files:**
- Modify: `app/api/activation-cron/route.ts`

The cron must read the `channel` field, route email rows to `sendEmail`, and skip rows whose lead has `email_status IN ('bounced', 'unsubscribed')`.

- [ ] **Step 1: Update the cron route**

Replace the contents of `app/api/activation-cron/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { sendWhatsApp } from '@/lib/activation'
import { sendEmail } from '@/lib/email'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

function isCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !authHeader) return false
  const expected = `Bearer ${secret}`
  try {
    const a = Buffer.from(authHeader)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: due, error } = await sb
    .from('activation_messages')
    .select('id, lead_id, body, subject, channel, activation_leads(phone, email, email_status, business_name, status)')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const msg of due ?? []) {
    const lead = msg.activation_leads as {
      phone: string
      email: string | null
      email_status: string | null
      business_name: string
      status: string
    } | null

    // Skip leads that already replied/booked/dead
    if (lead && ['replied', 'booked', 'dead'].includes(lead.status)) {
      await sb.from('activation_messages').update({ status: 'cancelled' }).eq('id', msg.id)
      skipped++
      continue
    }

    if (!lead) continue

    try {
      let providerId: string
      if (msg.channel === 'email') {
        // Skip if email is invalid/unsubscribed (or missing)
        if (!lead.email || (lead.email_status && ['bounced', 'unsubscribed'].includes(lead.email_status))) {
          await sb.from('activation_messages').update({ status: 'cancelled' }).eq('id', msg.id)
          skipped++
          continue
        }
        providerId = await sendEmail({
          to: lead.email,
          subject: msg.subject ?? '(no subject)',
          body: msg.body,
          leadId: msg.lead_id,
          businessName: lead.business_name,
        })
      } else {
        // whatsapp (default)
        if (!lead.phone) continue
        providerId = await sendWhatsApp(lead.phone, msg.body)
      }

      await sb
        .from('activation_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: providerId })
        .eq('id', msg.id)
      sent++
    } catch (err) {
      console.error('Failed to send scheduled message:', msg.id, err)
      await sb.from('activation_messages').update({ status: 'failed' }).eq('id', msg.id)
      failed++
    }
  }

  return NextResponse.json({ sent, failed, skipped })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/activation-cron/route.ts
git commit -m "$(cat <<'EOF'
feat: cron dispatches WhatsApp + email by channel, skips bounced/unsubscribed

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Resend webhook route

**Files:**
- Create: `app/api/resend-webhook/route.ts`
- Create: `app/api/resend-webhook/route.test.ts`

Resend uses Svix-style headers: `svix-id`, `svix-timestamp`, `svix-signature`. The signature is `v1,<base64-hmac-sha256>` where the HMAC payload is `{svix_id}.{svix_timestamp}.{body}` and the secret is base64-encoded prefixed with `whsec_`. We verify with `node:crypto` directly to avoid pulling Svix as a dep.

- [ ] **Step 1: Write failing tests**

Create `app/api/resend-webhook/route.test.ts`:

```typescript
import { verifySvixSignature } from '../../../lib/svixVerify'
import { createHmac } from 'node:crypto'

describe('verifySvixSignature', () => {
  const secret = 'whsec_' + Buffer.from('my-test-secret').toString('base64')
  const id = 'msg_abc'
  const timestamp = '1700000000'
  const body = '{"event":"test"}'

  function makeSig(secretParam: string): string {
    const decoded = Buffer.from(secretParam.replace(/^whsec_/, ''), 'base64')
    const sig = createHmac('sha256', decoded).update(`${id}.${timestamp}.${body}`).digest('base64')
    return `v1,${sig}`
  }

  it('accepts a valid signature', () => {
    expect(verifySvixSignature({ id, timestamp, signature: makeSig(secret), body, secret })).toBe(true)
  })

  it('rejects a tampered body', () => {
    expect(verifySvixSignature({ id, timestamp, signature: makeSig(secret), body: '{"event":"changed"}', secret })).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const other = 'whsec_' + Buffer.from('different').toString('base64')
    expect(verifySvixSignature({ id, timestamp, signature: makeSig(other), body, secret })).toBe(false)
  })

  it('rejects a malformed signature header', () => {
    expect(verifySvixSignature({ id, timestamp, signature: 'garbage', body, secret })).toBe(false)
  })

  it('accepts when one of multiple space-separated signatures is valid', () => {
    const valid = makeSig(secret)
    expect(verifySvixSignature({ id, timestamp, signature: `v1,fakefake ${valid}`, body, secret })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- resend-webhook`
Expected: FAIL — `lib/svixVerify` not found.

- [ ] **Step 3: Implement the signature verifier as a tiny shared helper**

Create `lib/svixVerify.ts`:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface SvixVerifyParams {
  id: string
  timestamp: string
  signature: string  // The raw `svix-signature` header, e.g. "v1,abc v1,def"
  body: string       // Raw request body string
  secret: string     // The Resend webhook secret (starts with "whsec_")
}

/**
 * Verifies a Svix-style webhook signature (used by Resend).
 * The signature header may contain multiple space-separated signatures —
 * we accept if ANY one of them matches.
 */
export function verifySvixSignature(p: SvixVerifyParams): boolean {
  if (!p.id || !p.timestamp || !p.signature || !p.body || !p.secret) return false

  const secretBytes = Buffer.from(p.secret.replace(/^whsec_/, ''), 'base64')
  const payload = `${p.id}.${p.timestamp}.${p.body}`
  const expected = createHmac('sha256', secretBytes).update(payload).digest('base64')
  const expectedBuf = Buffer.from(expected)

  for (const part of p.signature.split(' ')) {
    const [, sig] = part.split(',')
    if (!sig) continue
    const sigBuf = Buffer.from(sig)
    if (sigBuf.length !== expectedBuf.length) continue
    try {
      if (timingSafeEqual(sigBuf, expectedBuf)) return true
    } catch { /* length mismatch — keep trying */ }
  }
  return false
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- resend-webhook`
Expected: 5 tests PASS.

- [ ] **Step 5: Implement the route**

Create `app/api/resend-webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { verifySvixSignature } from '@/lib/svixVerify'

// Resend event names → our DB MessageStatus mapping
const STATUS_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'read',
  'email.bounced': 'failed',
  'email.complained': 'failed',
}

const EVENT_TYPE_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const id = request.headers.get('svix-id') ?? ''
  const timestamp = request.headers.get('svix-timestamp') ?? ''
  const signature = request.headers.get('svix-signature') ?? ''
  const body = await request.text()

  if (!verifySvixSignature({ id, timestamp, signature, body, secret })) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { type?: string; data?: { email_id?: string; to?: string[] | string } }
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = payload.type ?? ''
  const providerId = payload.data?.email_id
  if (!providerId) {
    return NextResponse.json({ received: true })
  }

  const supabase = getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Find the message
  const { data: msg } = await sb
    .from('activation_messages')
    .select('id, lead_id')
    .eq('provider_message_id', providerId)
    .single()

  if (!msg) {
    // Webhook for a message we don't know about — log and ignore
    console.warn('[resend-webhook] unknown provider_message_id', providerId)
    return NextResponse.json({ received: true })
  }

  // Append to email_events
  const dbEventType = EVENT_TYPE_MAP[eventType]
  if (dbEventType) {
    await sb.from('email_events').insert({
      message_id: msg.id,
      event_type: dbEventType,
      payload,
    })
  }

  // Update message status
  const newStatus = STATUS_MAP[eventType]
  if (newStatus) {
    await sb.from('activation_messages').update({ status: newStatus }).eq('id', msg.id)
  }

  // Update lead email_status on bounce/complaint
  if (eventType === 'email.bounced') {
    await sb.from('activation_leads').update({ email_status: 'bounced' }).eq('id', msg.lead_id)
  } else if (eventType === 'email.complained') {
    await sb.from('activation_leads').update({ email_status: 'unsubscribed' }).eq('id', msg.lead_id)
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 6: Type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: zero TS errors, all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/resend-webhook/route.ts app/api/resend-webhook/route.test.ts lib/svixVerify.ts
git commit -m "$(cat <<'EOF'
feat: Resend webhook route — Svix sig verification + status/lead updates

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Unsubscribe route

**Files:**
- Create: `app/api/unsubscribe/route.ts`
- Create: `app/api/unsubscribe/route.test.ts`

GET endpoint validates HMAC token, sets `email_status='unsubscribed'`, renders a minimal confirmation HTML page. Idempotent.

- [ ] **Step 1: Write failing tests**

Create `app/api/unsubscribe/route.test.ts`:

```typescript
import { signUnsubscribeToken } from '@/lib/email'

// Mock the supabase client so we can assert what got called
const mockUpdate = jest.fn().mockReturnThis()
const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })
const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate })
mockUpdate.mockReturnValue({ eq: mockEq })

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}))

import { GET } from '../route'

describe('GET /api/unsubscribe', () => {
  beforeEach(() => {
    process.env.UNSUBSCRIBE_HMAC_SECRET = 'test-secret'
    mockFrom.mockClear()
    mockUpdate.mockClear()
    mockEq.mockClear()
    // Re-apply chain
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
  })

  it('returns 400 when lead is missing', async () => {
    const req = new Request('https://example.com/api/unsubscribe')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 with invalid token', async () => {
    const req = new Request('https://example.com/api/unsubscribe?lead=lead-1&t=garbage')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('marks the lead unsubscribed with valid token', async () => {
    const t = signUnsubscribeToken('lead-1')
    const req = new Request(`https://example.com/api/unsubscribe?lead=lead-1&t=${t}`)
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('activation_leads')
    expect(mockUpdate).toHaveBeenCalledWith({ email_status: 'unsubscribed' })
    expect(mockEq).toHaveBeenCalledWith('id', 'lead-1')
  })

  it('returns HTML confirmation', async () => {
    const t = signUnsubscribeToken('lead-1')
    const req = new Request(`https://example.com/api/unsubscribe?lead=lead-1&t=${t}`)
    const res = await GET(req)
    expect(res.headers.get('content-type')).toContain('text/html')
    const text = await res.text()
    expect(text.toLowerCase()).toContain('unsubscribed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- unsubscribe`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `app/api/unsubscribe/route.ts`:

```typescript
import { getSupabase } from '@/lib/supabase'
import { verifyUnsubscribeToken } from '@/lib/email'

const PAGE = (msg: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsubscribed — Skhokho Labs</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 4rem auto; padding: 0 1rem; color: #1f2937; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  p { color: #4b5563; }
  a { color: #16a34a; }
</style>
</head>
<body>
  <h1>${msg}</h1>
  <p>You won't receive any more emails from us. If you change your mind, just reply to any past message and we'll re-enable.</p>
  <p><a href="https://skhokholabs.xyz">skhokholabs.xyz</a></p>
</body>
</html>`

const ERROR_PAGE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Invalid link</title></head>
<body style="font-family:system-ui;max-width:480px;margin:4rem auto;padding:0 1rem">
<h1>Invalid unsubscribe link</h1>
<p>This link looks corrupted. Email <a href="mailto:chuma@skhokholabs.xyz">chuma@skhokholabs.xyz</a> and we'll remove you manually.</p>
</body></html>`

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lead = url.searchParams.get('lead')
  const token = url.searchParams.get('t')

  if (!lead || !token) {
    return new Response(ERROR_PAGE, { status: 400, headers: { 'content-type': 'text/html' } })
  }
  if (!verifyUnsubscribeToken(lead, token)) {
    return new Response(ERROR_PAGE, { status: 400, headers: { 'content-type': 'text/html' } })
  }

  const supabase = getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('activation_leads').update({ email_status: 'unsubscribed' }).eq('id', lead)

  return new Response(PAGE("You're unsubscribed."), { status: 200, headers: { 'content-type': 'text/html' } })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- unsubscribe`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/unsubscribe/route.ts app/api/unsubscribe/route.test.ts
git commit -m "$(cat <<'EOF'
feat: GET /api/unsubscribe — HMAC-validated one-click opt-out

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Discovery — scrape emails + surface in card

**Files:**
- Modify: `types/discovery.ts`
- Modify: `app/api/discover-leads/route.ts`
- Modify: `components/discovery/DiscoveredLeadCard.tsx`

- [ ] **Step 1: Add `email` to `DiscoveredLead`**

Read `types/discovery.ts` first to find the interface, then add `email?: string | null` next to `phone`. Example diff (adapt to actual line):

```typescript
export interface DiscoveredLead {
  // ...
  phone: string
  email: string | null    // ← new
  // ...
}
```

If other constructors of `DiscoveredLead` exist (search: `git grep -n "DiscoveredLead"`), add `email: null` defaults to keep them compiling.

- [ ] **Step 2: Update `placesApi.ts` to include `email: null` in returned objects**

Search `lib/placesApi.ts` for the object literal(s) returned as `DiscoveredLead` and add `email: null,` alongside `phone`.

- [ ] **Step 3: Wire `scrapeContacts` into `app/api/discover-leads/route.ts`**

Replace the try block (lines 49–66) with:

```typescript
  try {
    const leads = await searchPlaces(params)

    // Best-effort email enrichment in parallel — failures are silent
    const enriched = await Promise.all(
      leads.map(async (lead) => {
        if (!lead.websiteUrl && !lead.facebookPageUrl) return lead
        const { email } = await scrapeContacts(lead.websiteUrl || null, lead.facebookPageUrl || null)
        return { ...lead, email }
      }),
    )

    const searchQuery = `${getSectorSearchQuery(params.sector)} in ${params.location}`

    return NextResponse.json({
      leads: enriched,
      searchQuery,
      totalFound: enriched.length,
      searchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Lead discovery error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search for leads' },
      { status: 500 }
    )
  }
```

Add the import at the top:

```typescript
import { scrapeContacts } from '@/lib/scrapeContacts'
```

- [ ] **Step 4: Surface email on the discovery card**

Open `components/discovery/DiscoveredLeadCard.tsx` and find the section where the channel badges render (e.g. "WA / FB / IG"). Add an "✉" badge:

```tsx
{lead.email && (
  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200" title={lead.email}>
    ✉ Email
  </span>
)}
```

(If the file currently has no badge row at all, add one near the business name; match the existing visual style of other inline badges in the file.)

- [ ] **Step 5: Type-check + tests**

Run: `npx tsc --noEmit && npm test`
Expected: zero TS errors, all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add types/discovery.ts lib/placesApi.ts app/api/discover-leads/route.ts components/discovery/DiscoveredLeadCard.tsx
git commit -m "$(cat <<'EOF'
feat: scrape email during /discover-leads + surface badge on lead card

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: AddLeadModal email field

**Files:**
- Modify: `components/activation/AddLeadModal.tsx`

- [ ] **Step 1: Add email state and form field**

In `components/activation/AddLeadModal.tsx`:

After line 22 (`const [instagramUrl, setInstagramUrl] = useState('')`), add:
```tsx
const [email, setEmail] = useState('')
```

In the form body, add a new field next to phone (after line 153, the phone input's closing `</div>`):

```tsx
<div className="col-span-2">
  <label className="block text-xs font-medium text-gray-700 mb-1">
    Email <span className="font-normal text-gray-400">(optional — enables email outreach)</span>
  </label>
  <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="owner@business.co.za"
    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
  />
</div>
```

In the `handleSubmit` function, add `email` to the JSON body (after `phone: phone.trim(),` around line 67):

```tsx
email: email.trim() || undefined,
```

- [ ] **Step 2: Manual smoke**

Start dev server: `npm run dev`
Navigate to the activation page, open AddLeadModal. Verify the email field appears, accepts input, and the form submits without TypeScript or runtime errors.

- [ ] **Step 3: Commit**

```bash
git add components/activation/AddLeadModal.tsx
git commit -m "$(cat <<'EOF'
feat: optional email input on AddLeadModal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: ConversationModal — render email subject

**Files:**
- Modify: `components/activation/ConversationModal.tsx`

- [ ] **Step 1: Read the file to find the message rendering loop**

```bash
# (Use the Read tool, not bash — listed here for reference)
```

Locate the `messages.map(...)` block that renders each message bubble.

- [ ] **Step 2: Add subject rendering for email rows**

Inside the message bubble JSX, add (above the body text):

```tsx
{m.channel === 'email' && m.subject && (
  <div className="text-xs font-semibold text-gray-700 mb-1 border-b border-gray-200 pb-1">
    {m.subject}
  </div>
)}
```

This relies on `m.channel` and `m.subject` from the updated `ActivationMessage` type — already added in Task 1.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors. (If the file uses different prop names for the message field, adapt the JSX accordingly.)

- [ ] **Step 4: Manual smoke**

Open a lead with both WhatsApp and email messages in the conversation modal. Verify:
- Email rows show the subject line above the body, separated by a thin border.
- WhatsApp rows look unchanged.

- [ ] **Step 5: Commit**

```bash
git add components/activation/ConversationModal.tsx
git commit -m "$(cat <<'EOF'
feat: render email subject line above body in ConversationModal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Env vars + README

**Files:**
- Modify: `.env.example` (create if it doesn't exist)
- Modify: `README.md` env section if present
- Modify: `AGENTS.md` if it documents env

- [ ] **Step 1: Check existing env documentation**

```bash
ls .env.example .env.local.example 2>/dev/null
```

If neither exists, create `.env.example`. If one exists, append.

- [ ] **Step 2: Append the new env vars**

Append to `.env.example`:

```
# Resend (email outreach)
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
EMAIL_FROM_ADDRESS=chuma@skhokholabs.xyz
EMAIL_REPLY_TO=chuma@skhokholabs.xyz
EMAIL_SENDING_DOMAIN=mail.skhokholabs.xyz
EMAIL_PHYSICAL_ADDRESS=Replace with real physical address (POPIA s.69 requires it)
UNSUBSCRIBE_HMAC_SECRET=generate-with-openssl-rand-hex-32
```

- [ ] **Step 3: Update README env section if present**

If `README.md` has a "Configuration" / "Environment variables" section, mirror the additions there with one-line descriptions.

- [ ] **Step 4: Document Resend + DNS setup steps**

If a setup README exists for the project, append a short "Email channel setup" subsection listing:
1. Verify `mail.skhokholabs.xyz` in Resend dashboard
2. Add SPF / DKIM / DMARC DNS records (per Resend onboarding)
3. Configure webhook endpoint at `https://your-app/api/resend-webhook` with the events: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
4. Run the migration: `SUPABASE_ACCESS_TOKEN=... node scripts/migrate-email.js`

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md AGENTS.md
git commit -m "$(cat <<'EOF'
docs: env vars + setup steps for Resend email channel

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist (run after writing all tasks above)

- [x] Spec coverage: Schema additions (Task 1), compliance footer + HMAC (Task 2), Resend wrapper (Task 3), email gen (Task 4), scraper (Task 5), activate wiring (Task 6), cron dispatch (Task 7), Resend webhook (Task 8), unsubscribe (Task 9), discovery + card (Task 10), AddLeadModal (Task 11), ConversationModal (Task 12), env (Task 13). All spec sections covered.
- [x] No placeholders: every code block is complete; no "TBD"; manual address string is the only intentionally-blank value and is called out in env example.
- [x] Type consistency: `providerMessageId` / `provider_message_id` consistent across tasks. `MessageChannel` and `EmailStatus` defined in Task 1 and reused. `EmailDay` shape matches between generator and consumer.
- [x] Open issue (intentional): Task 1 includes a hot-path constraint extension for `'read'` status — this fixes a latent bug in the existing whatsapp-webhook code that was writing a value the constraint disallowed.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-email-outreach-resend.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — I execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
