export type Sector =
  | 'spaza_food'
  | 'salon_hair'
  | 'auto_mechanic'
  | 'real_estate'
  | 'legal_consulting'
  | 'clinic_medical'
  | 'other'

export type Source = 'google_maps' | 'facebook' | 'walk_in' | 'referral'

export type Product =
  | 'ai_receptionist'
  | 'starter_website'
  | 'pro_website_bookings'
  | 'lead_activation'
  | 'speed_to_lead'
  | 'content_dashboard'

export type HeatLevel = 'HOT' | 'WARM' | 'COLD'

export interface LeadData {
  agentName: string
  businessName: string
  ownerName: string
  phone: string
  location: string
  sector: Sector
  source: Source
  hasWebsite: boolean
  hasGoogleProfile: boolean
  facebookUrl: string
  followerCount: number | null
  lastPostDate: string        // ISO date string or empty string
  heatScore: number           // 1–10
  heatScoreOverridden: boolean
  recommendedProduct: Product
  notes: string
  dateGenerated: string       // ISO date string
}
