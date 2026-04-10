import type { Sector } from '@/types/lead'

/**
 * Returns a text search query string for the Google Places API
 * based on the given sector.
 */
export function getSectorSearchQuery(sector: Sector): string {
  const map: Record<Sector, string> = {
    spaza_food: 'spaza shop OR food vendor OR tuck shop',
    salon_hair: 'hair salon OR beauty salon',
    auto_mechanic: 'auto repair OR car mechanic',
    real_estate: 'real estate agency',
    legal_consulting: 'law firm OR legal consulting',
    clinic_medical: 'medical clinic OR doctor',
    other: 'small business',
  }
  return map[sector]
}
