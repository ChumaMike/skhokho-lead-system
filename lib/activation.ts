/**
 * Normalizes a South African phone number to E.164 format (+27XXXXXXXXX).
 * Handles: "083 456 7890", "+27 83 456 7890", "27834567890", "+27834567890"
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('27') && digits.length === 11) {
    return `+${digits}`
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+27${digits.slice(1)}`
  }
  // Fallback: prefix + if not already there
  return phone.startsWith('+') ? `+${digits}` : `+${digits}`
}
