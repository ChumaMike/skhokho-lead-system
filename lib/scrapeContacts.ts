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

const MAX_BYTES = 2_000_000  // 2 MB — enough for a homepage, prevents OOM

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SkhokhoLeadBot/1.0; +https://skhokholabs.xyz/bot)' },
    })
    if (!res.ok) return null

    // Cheap pre-check via Content-Length
    const declared = Number(res.headers.get('content-length') ?? 0)
    if (declared && declared > MAX_BYTES) return null

    // Stream and abort if oversize (covers chunked / no-content-length servers)
    if (!res.body) return await res.text()
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > MAX_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    return new TextDecoder('utf-8').decode(Buffer.concat(chunks.map(c => Buffer.from(c))))
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
