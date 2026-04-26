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
