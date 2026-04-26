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
