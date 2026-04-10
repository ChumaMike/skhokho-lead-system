import type { Sector, Product, HeatLevel } from '@/types/lead'

export interface DiscoveredLead {
  placeId: string
  businessName: string
  phone: string             // empty string if not available
  address: string
  location: string          // user-supplied search location
  sector: Sector
  source: 'google_maps'
  hasWebsite: boolean
  websiteUrl: string        // empty string if not available
  googleMapsUrl: string
  hasGoogleProfile: boolean // always true (found via Places API)
  heatScore: number
  heatLevel: HeatLevel
  recommendedProduct: Product
}

export interface DiscoverySearchParams {
  sector: Sector
  location: string
  radius: number            // metres (500–50000)
  maxResults: number        // 1–20
}

export interface DiscoveryResult {
  leads: DiscoveredLead[]
  searchQuery: string
  totalFound: number
  searchedAt: string        // ISO timestamp
}
