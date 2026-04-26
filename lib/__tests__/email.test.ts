// Stub the server-only marker so jest (node env) can import lib/email.ts.
jest.mock('server-only', () => ({}))

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

  it('throws when EMAIL_PHYSICAL_ADDRESS is unset', () => {
    const saved = process.env.EMAIL_PHYSICAL_ADDRESS
    delete process.env.EMAIL_PHYSICAL_ADDRESS
    try {
      expect(() => appendComplianceFooter('Hello', 'lead-1', 'Acme')).toThrow(/EMAIL_PHYSICAL_ADDRESS/)
    } finally {
      process.env.EMAIL_PHYSICAL_ADDRESS = saved
    }
  })
})

describe('unsubscribe token', () => {
  const origSecret = process.env.UNSUBSCRIBE_HMAC_SECRET
  beforeAll(() => {
    process.env.UNSUBSCRIBE_HMAC_SECRET = 'test-secret-do-not-use-in-prod'
  })
  afterAll(() => {
    process.env.UNSUBSCRIBE_HMAC_SECRET = origSecret
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

  it('strips display name from EMAIL_REPLY_TO when building mailto', async () => {
    process.env.EMAIL_REPLY_TO = 'Chuma Meyiswa <chuma@skhokholabs.xyz>'
    mockSend.mockResolvedValueOnce({ data: { id: 'x' }, error: null })
    await sendEmail({ to: 'owner@example.com', subject: 's', body: 'b', leadId: 'l', businessName: 'B' })
    const arg = mockSend.mock.calls[0][0]
    expect(arg.headers['List-Unsubscribe']).toContain('mailto:chuma@skhokholabs.xyz?subject=unsubscribe')
    expect(arg.headers['List-Unsubscribe']).not.toContain('Chuma Meyiswa')
  })
})

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
