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
