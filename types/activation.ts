import type { Sector, Product, HeatLevel } from './lead'

export type ActivationStatus = 'queued' | 'sent' | 'replied' | 'booked' | 'dead'
export type MessageDirection = 'outbound' | 'inbound'
export type MessageStatus = 'scheduled' | 'sent' | 'delivered' | 'failed' | 'cancelled'

export interface ActivationLead {
  id: string
  businessName: string
  ownerName: string | null
  phone: string
  sector: Sector
  recommendedProduct: Product
  heatScore: number
  heatLevel: HeatLevel
  location: string
  agentName: string
  sourceType: 'entered' | 'discovered'
  status: ActivationStatus
  hasWebsite: boolean
  googleMapsUrl: string | null
  createdAt: string
  activatedAt: string | null
  repliedAt: string | null
  messages?: ActivationMessage[]
}

export interface ActivationMessage {
  id: string
  leadId: string
  direction: MessageDirection
  body: string
  sequenceDay: number | null
  status: MessageStatus
  channel: 'whatsapp'
  sentAt: string | null
  scheduledFor: string | null
}

export interface ActivationLeadInput {
  businessName: string
  ownerName?: string
  phone: string
  sector: Sector
  recommendedProduct: Product
  heatScore: number
  heatLevel: HeatLevel
  location: string
  agentName: string
  sourceType: 'entered' | 'discovered'
  hasWebsite?: boolean
  googleMapsUrl?: string
}

/** Maps camelCase ActivationLead to snake_case DB row */
export function toDbRow(lead: ActivationLeadInput & { status?: ActivationStatus }) {
  return {
    business_name: lead.businessName,
    owner_name: lead.ownerName ?? null,
    phone: lead.phone,
    sector: lead.sector,
    recommended_product: lead.recommendedProduct,
    heat_score: lead.heatScore,
    heat_level: lead.heatLevel,
    location: lead.location,
    agent_name: lead.agentName,
    source_type: lead.sourceType,
    status: lead.status ?? 'queued',
    has_website: lead.hasWebsite ?? false,
    google_maps_url: lead.googleMapsUrl ?? null,
  }
}

/** Maps snake_case DB row to camelCase ActivationLead */
export function fromDbRow(row: Record<string, unknown>): ActivationLead {
  return {
    id: row.id as string,
    businessName: row.business_name as string,
    ownerName: row.owner_name as string | null,
    phone: row.phone as string,
    sector: row.sector as Sector,
    recommendedProduct: row.recommended_product as Product,
    heatScore: row.heat_score as number,
    heatLevel: row.heat_level as HeatLevel,
    location: row.location as string,
    agentName: row.agent_name as string,
    sourceType: row.source_type as 'entered' | 'discovered',
    status: row.status as ActivationStatus,
    hasWebsite: row.has_website as boolean,
    googleMapsUrl: row.google_maps_url as string | null,
    createdAt: row.created_at as string,
    activatedAt: row.activated_at as string | null,
    repliedAt: row.replied_at as string | null,
  }
}

export function msgFromDbRow(row: Record<string, unknown>): ActivationMessage {
  return {
    id: row.id as string,
    leadId: row.lead_id as string,
    direction: row.direction as MessageDirection,
    body: row.body as string,
    sequenceDay: row.sequence_day as number | null,
    status: row.status as MessageStatus,
    channel: 'whatsapp',
    sentAt: row.sent_at as string | null,
    scheduledFor: row.scheduled_for as string | null,
  }
}
