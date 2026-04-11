import type { Product, Sector, Source, LeadData } from '@/types/lead'
import type { DiscoveredLead } from '@/types/discovery'

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

// ---------------------------------------------------------------------------
// Discovery helpers
// ---------------------------------------------------------------------------

export interface ProductOffer {
  product: Product
  name: string
  setupFee: string
  monthly: string
  pitch: string
  whyItFits: string
  isRecommended: boolean
}

/**
 * Returns all 6 products with contextual offer angles tailored to the lead's
 * sector and digital presence signals.
 */
export function getAllProductsWithOffer(lead: DiscoveredLead): ProductOffer[] {
  const recommended = lead.recommendedProduct
  const noWebsite = !lead.hasWebsite
  const sector = lead.sector
  const name = lead.businessName

  const WHY_IT_FITS: Record<Product, string> = {
    ai_receptionist:
      sector === 'clinic_medical' || sector === 'legal_consulting'
        ? `${name} likely receives high volumes of inbound calls. An AI receptionist handles after-hours queries instantly so no inquiry slips through.`
        : `Missed calls are missed revenue. An AI receptionist means ${name} never loses a customer because no one picked up.`,

    starter_website: noWebsite
      ? `${name} has no web presence. A starter site with an AI chatbot gives instant digital credibility and handles inquiries 24/7.`
      : `Even with an existing site, a chatbot upgrade turns passive visitors into active leads for ${name}.`,

    pro_website_bookings:
      sector === 'salon_hair' || sector === 'clinic_medical' || sector === 'auto_mechanic'
        ? `${name} relies on appointments. Online booking reduces no-shows and eliminates phone tag with clients.`
        : noWebsite
        ? `${name} has no website — a pro site with bookings jumps straight to revenue-generating infrastructure.`
        : `An upgrade to online bookings and a client portal gives ${name} a professional edge over local competitors.`,

    lead_activation:
      sector === 'legal_consulting' || sector === 'real_estate'
        ? `${name} likely has dormant past contacts. Lead Activation re-engages that list into paying clients with zero ad spend.`
        : `If ${name} has any history of customer contacts (WhatsApp, walk-ins), Lead Activation turns that list into revenue.`,

    speed_to_lead:
      sector === 'real_estate'
        ? `Real estate leads go cold in minutes. Speed-to-Lead ensures ${name} calls every new inquiry within 2 minutes of submission.`
        : `When a potential customer submits an inquiry, ${name} will be the first business to call them back — before any competitor gets the chance.`,

    content_dashboard: lead.hasWebsite
      ? `${name} already has an online presence. A content dashboard keeps them consistently visible on social without the manual effort.`
      : `Once ${name} gets online, content consistency is what keeps them visible. Start building that habit from day one.`,
  }

  const products = Object.keys(PRODUCT_DETAILS) as Product[]
  return products.map((product) => ({
    product,
    ...PRODUCT_DETAILS[product],
    whyItFits: WHY_IT_FITS[product],
    isRecommended: product === recommended,
  }))
}

/**
 * Bridges a DiscoveredLead to a LeadData so existing PDF section components
 * can be reused without modification. Fields unavailable from Places API are
 * set to safe empty defaults.
 */
export function discoveredLeadToLeadData(
  lead: DiscoveredLead,
  agentName: string = '',
): LeadData {
  return {
    agentName,
    businessName: lead.businessName,
    ownerName: lead.businessName, // Places API has no owner name — business name is the best fallback
    phone: lead.phone,
    location: lead.location,
    sector: lead.sector,
    source: lead.source,
    hasWebsite: lead.hasWebsite,
    hasGoogleProfile: lead.hasGoogleProfile,
    facebookUrl: '',
    followerCount: null,
    lastPostDate: '',
    heatScore: lead.heatScore,
    heatScoreOverridden: false,
    recommendedProduct: lead.recommendedProduct,
    notes: lead.websiteUrl || lead.googleMapsUrl || '',
    dateGenerated: new Date().toISOString(),
  }
}
