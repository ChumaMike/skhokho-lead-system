import type { Product, Sector, Source } from '@/types/lead'

export const PRODUCT_DETAILS: Record<
  Product,
  { name: string; setupFee: string; monthly: string; pitch: string }
> = {
  ai_receptionist: {
    name: 'AI Inbound Receptionist',
    setupFee: 'R2,500',
    monthly: 'Usage-based',
    pitch: 'Never miss a customer call — AI answers 24/7',
  },
  starter_website: {
    name: 'Starter Website + AI Chatbot',
    setupFee: 'R1,500',
    monthly: 'R300/month',
    pitch: 'Get online fast with a website that talks back',
  },
  pro_website_bookings: {
    name: 'Pro Website with Bookings & Portal',
    setupFee: 'R2,500',
    monthly: 'R450/month',
    pitch: 'Take bookings online and reduce no-shows',
  },
  lead_activation: {
    name: 'Lead Activation System',
    setupFee: 'R2,000',
    monthly: 'R300/month',
    pitch: 'Turn your contact list into paying customers',
  },
  speed_to_lead: {
    name: 'Speed-to-Lead Agent',
    setupFee: 'R4,500',
    monthly: 'R600/month',
    pitch: 'Call every new lead within minutes of form submission',
  },
  content_dashboard: {
    name: 'Content Dashboard',
    setupFee: 'R4,500',
    monthly: 'R800/month',
    pitch: 'Plan, create, and schedule content without the stress',
  },
}

/**
 * Returns the primary recommended product for a given sector.
 */
export function getRecommendedProduct(sector: Sector): Product {
  const map: Record<Sector, Product> = {
    spaza_food: 'pro_website_bookings',
    salon_hair: 'pro_website_bookings',
    auto_mechanic: 'pro_website_bookings',
    real_estate: 'speed_to_lead',
    legal_consulting: 'lead_activation',
    clinic_medical: 'pro_website_bookings',
    other: 'starter_website',
  }
  return map[sector]
}

export const SECTOR_LABELS: Record<Sector, string> = {
  spaza_food: 'Spaza Shop / Food Vendor',
  salon_hair: 'Salon / Hair',
  auto_mechanic: 'Auto Mechanic',
  real_estate: 'Real Estate',
  legal_consulting: 'Legal / Consulting',
  clinic_medical: 'Clinic / Medical',
  other: 'Other',
}

export const SOURCE_LABELS: Record<Source, string> = {
  google_maps: 'Google Maps',
  facebook: 'Facebook',
  walk_in: 'Walk-in',
  referral: 'Referral',
}
