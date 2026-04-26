import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Resend } from 'resend'
import Anthropic from '@anthropic-ai/sdk'
import type { ActivationLeadInput } from '@/types/activation'
import { PRODUCT_DETAILS } from '@/lib/productMatch'

/** Extracts the bare email address from a "Display Name <addr@example>" form. Returns input unchanged if no angle brackets. */
function bareAddress(addr: string): string {
  const m = addr.match(/<([^>]+)>/)
  return m ? m[1] : addr
}

function getSecret(): string {
  const s = process.env.UNSUBSCRIBE_HMAC_SECRET
  if (!s) throw new Error('UNSUBSCRIBE_HMAC_SECRET is not set')
  return s
}

function getAddress(): string {
  const a = process.env.EMAIL_PHYSICAL_ADDRESS
  if (!a) throw new Error('EMAIL_PHYSICAL_ADDRESS is not set (POPIA s.69 requires a physical address in every outbound email)')
  return a
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
  const address = getAddress()
  const token = signUnsubscribeToken(leadId)
  const unsubUrl = `https://skhokholabs.xyz/unsubscribe?lead=${encodeURIComponent(leadId)}&t=${token}`
  return `${body}

—
Skhokho Labs · ${address} · skhokholabs.xyz
You received this because we identified ${businessName} as a potential fit for our SA small-business AI tools.
Don't want these? Unsubscribe: ${unsubUrl}`
}

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
      'List-Unsubscribe': `<${unsubUrl}>, <mailto:${bareAddress(replyTo)}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  if (result.error) throw new Error(`Resend error: ${result.error.message}`)
  if (!result.data?.id) throw new Error('Resend returned no message id')
  return result.data.id
}

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
