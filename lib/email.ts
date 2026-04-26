import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Resend } from 'resend'

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
