import { signUnsubscribeToken } from '@/lib/email'

// Mock the supabase client so we can assert what got called
const mockUpdate = jest.fn().mockReturnThis()
const mockEq = jest.fn().mockResolvedValue({ data: null, error: null })
const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate })
mockUpdate.mockReturnValue({ eq: mockEq })

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}))

// Stub the server-only guard since lib/email.ts pulls it in
jest.mock('server-only', () => ({}))

import { GET } from './route'

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
