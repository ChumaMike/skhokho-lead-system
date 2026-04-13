import { normalizePhone } from '../activation'

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
