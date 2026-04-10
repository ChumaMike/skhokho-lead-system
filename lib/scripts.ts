import type { LeadData, Sector } from '@/types/lead'
import { PRODUCT_DETAILS } from '@/lib/productMatch'

// ---------------------------------------------------------------------------
// Phone Script
// ---------------------------------------------------------------------------

/**
 * Returns a filled phone call script for the given lead.
 */
export function getPhoneScript(lead: LeadData): string {
  const productName = PRODUCT_DETAILS[lead.recommendedProduct].name

  const painPoint = lead.hasWebsite
    ? `could be getting more bookings online`
    : `doesn't have a website yet`

  return `Hi, is this ${lead.ownerName} from ${lead.businessName}?

My name is ${lead.agentName} — I help local businesses in ${lead.location} get more customers through ${productName}.

I noticed ${lead.businessName} ${painPoint} — I help businesses like yours fix that quickly.

Are you open to a 2-minute chat about how it works?`
}

// ---------------------------------------------------------------------------
// Facebook DM Script
// ---------------------------------------------------------------------------

/**
 * Returns a filled Facebook / Instagram DM script for the given lead.
 */
export function getFacebookDMScript(lead: LeadData): string {
  return `Hi ${lead.ownerName} 👋 I came across ${lead.businessName} and love what you're doing!

I help businesses like yours in ${lead.location} get more customers. I have an idea that could work really well for ${lead.businessName}.

Would it be okay if I share it with you on WhatsApp? What's your number?`
}

// ---------------------------------------------------------------------------
// Walk-in Script
// ---------------------------------------------------------------------------

/**
 * Returns a filled walk-in conversation script for the given lead.
 */
export function getWalkInScript(lead: LeadData): string {
  const productName = PRODUCT_DETAILS[lead.recommendedProduct].name

  return `Hi there! Is the owner around? I'm ${lead.agentName} — I work with local businesses in ${lead.location}.

I help businesses like ${lead.businessName} get more customers through ${productName}. I'd love to share a quick idea with you.

Could I get a WhatsApp number to send you more info? Takes 2 minutes to explain.`
}

// ---------------------------------------------------------------------------
// Follow-up Sequence
// ---------------------------------------------------------------------------

type FollowUpMessage = { day: number; angle: string; message: string }

/** Sector-specific example businesses used in Day 2 follow-up. */
const SECTOR_EXAMPLES: Record<Sector, string> = {
  spaza_food:
    'a spaza shop owner in Soweto who started taking pre-orders through their website',
  salon_hair:
    'a hair salon in Johannesburg that filled her entire Saturday with online bookings',
  auto_mechanic:
    'an auto workshop in Cape Town that started getting service requests straight from Google',
  real_estate:
    'a real estate agent in Pretoria who cut her response time to new leads from 2 hours to 2 minutes',
  legal_consulting:
    'a small law firm in Durban that re-activated 40 old contacts and closed 3 new clients in a month',
  clinic_medical:
    'a medical clinic in Sandton that eliminated no-shows by letting patients book and confirm online',
  other:
    'a local business in their area that started getting consistent inquiries after launching their website',
}

/** Sector-specific stats used in Day 4 follow-up. */
const SECTOR_STATS: Record<Sector, string> = {
  spaza_food:
    '70% of local food shoppers check online before visiting a store for the first time.',
  salon_hair:
    'Salons with online booking see up to 30% fewer no-shows compared to phone-only booking.',
  auto_mechanic:
    '88% of consumers trust online reviews as much as personal recommendations when choosing a mechanic.',
  real_estate:
    'Leads contacted within 5 minutes of inquiry are 9x more likely to convert than those called after 30 minutes.',
  legal_consulting:
    'Law firms that follow up with prospects within 24 hours close 60% more business than those that wait longer.',
  clinic_medical:
    'Clinics that offer online booking fill 20% more appointments and reduce admin time by half.',
  other:
    'Businesses with an active online presence generate up to 2x more inbound leads than those without one.',
}

/** Sector-specific re-engagement questions used in Day 7 follow-up. */
const SECTOR_QUESTIONS: Record<Sector, string> = {
  spaza_food:
    "Are you currently getting enough new customers through the week, or is foot traffic slower than you'd like?",
  salon_hair:
    "Are your appointment slots fully booked, or do you still have gaps you'd like to fill each week?",
  auto_mechanic:
    "When a new customer searches for a mechanic nearby, does your business show up — or are you invisible to them?",
  real_estate:
    "How quickly are you currently reaching out to new property inquiries — same day, or does it sometimes slip?",
  legal_consulting:
    "Do you have a reliable way to re-engage past contacts who never converted into clients?",
  clinic_medical:
    "Are patients able to book appointments with you online right now, or do they have to call in every time?",
  other:
    "What's your biggest challenge right now when it comes to getting consistent new customers?",
}

/**
 * Returns a 3-message follow-up sequence for the given lead.
 * Messages are sector-specific and reference the recommended product.
 */
export function getFollowUpSequence(lead: LeadData): FollowUpMessage[] {
  const productName = PRODUCT_DETAILS[lead.recommendedProduct].name
  const example = SECTOR_EXAMPLES[lead.sector]
  const stat = SECTOR_STATS[lead.sector]
  const question = SECTOR_QUESTIONS[lead.sector]

  return [
    {
      day: 2,
      angle: 'Example',
      message: `Hi ${lead.ownerName}, just following up from earlier. We recently helped ${example} — using the same ${productName} I mentioned for ${lead.businessName}. Happy to show you exactly how it worked if you have 5 minutes this week?`,
    },
    {
      day: 4,
      angle: 'Stat',
      message: `Hey ${lead.ownerName} — quick thought for ${lead.businessName}: ${stat} Our ${productName} is designed to help with exactly this. Worth a quick chat?`,
    },
    {
      day: 7,
      angle: 'Question',
      message: `Hi ${lead.ownerName}, last message from me on this — ${question} If the timing isn't right, no problem at all. But if you'd like to explore what ${productName} could do for ${lead.businessName}, I'm here.`,
    },
  ]
}
