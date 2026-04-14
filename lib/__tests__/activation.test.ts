import { normalizePhone, buildMessagePrompt } from '../activation'
import type { ActivationLeadInput } from '@/types/activation'

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
    const prompt = buildMessagePrompt(lead, 'Take bookings online', 'Relies on appointments', ['ai_receptionist', 'content_dashboard'])
    expect(prompt).toContain("Mama T's Salon")
  })

  it('includes agent name in prompt', () => {
    const prompt = buildMessagePrompt(lead, 'Take bookings online', 'Relies on appointments', ['ai_receptionist', 'content_dashboard'])
    expect(prompt).toContain('Thabo')
  })

  it('includes product pitch in prompt', () => {
    const prompt = buildMessagePrompt(lead, 'Take bookings online', 'Relies on appointments', ['ai_receptionist', 'content_dashboard'])
    expect(prompt).toContain('Take bookings online')
  })

  it('mentions no website when hasWebsite is false', () => {
    const prompt = buildMessagePrompt(lead, 'Take bookings online', 'Relies on appointments', ['ai_receptionist', 'content_dashboard'])
    expect(prompt).toContain('false')
  })
})
