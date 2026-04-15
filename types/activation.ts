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
  facebookPageUrl: string | null
  instagramUrl: string | null
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
  facebookPageUrl?: string
  instagramUrl?: string
}

// ── DB column shape (mirrors the Supabase schema) ───────────────────────────

interface ActivationLeadRow {
  business_name: string
  owner_name: string | null
  phone: string
  sector: string
  recommended_product: string
  heat_score: number
  heat_level: string
  location: string
  agent_name: string
  source_type: string
  status: string
  has_website: boolean
  google_maps_url: string | null
  facebook_page_url: string | null
  instagram_url: string | null
  created_at: string
  activated_at: string | null
  replied_at: string | null
}

// ── Runtime type guard helpers ───────────────────────────────────────────────

function str(v: unknown, field: string): string {
  if (typeof v !== 'string') throw new TypeError(`DB row: expected string for '${field}', got ${typeof v}`)
  return v
}
function num(v: unknown, field: string): number {
  if (typeof v !== 'number') throw new TypeError(`DB row: expected number for '${field}', got ${typeof v}`)
  return v
}
function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') throw new TypeError(`DB row: expected boolean for '${field}', got ${typeof v}`)
  return v
}
function nullable<T>(guard: (v: unknown, f: string) => T, v: unknown, field: string): T | null {
  if (v === null || v === undefined) return null
  return guard(v, field)
}

// ── Row mappers ──────────────────────────────────────────────────────────────

/** Maps camelCase ActivationLeadInput to snake_case DB row */
export function toDbRow(lead: ActivationLeadInput & { status?: ActivationStatus }): ActivationLeadRow & { status: string } {
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
    facebook_page_url: lead.facebookPageUrl ?? null,
    instagram_url: lead.instagramUrl ?? null,
    created_at: new Date().toISOString(),
    activated_at: null,
    replied_at: null,
  }
}

/** Maps a raw Supabase DB row to a camelCase ActivationLead (without messages) */
export function fromDbRow(row: Record<string, unknown>): ActivationLead {
  return {
    id: str(row.id, 'id'),
    businessName: str(row.business_name, 'business_name'),
    ownerName: nullable(str, row.owner_name, 'owner_name'),
    phone: str(row.phone, 'phone'),
    sector: str(row.sector, 'sector') as Sector,
    recommendedProduct: str(row.recommended_product, 'recommended_product') as Product,
    heatScore: num(row.heat_score, 'heat_score'),
    heatLevel: str(row.heat_level, 'heat_level') as HeatLevel,
    location: str(row.location, 'location'),
    agentName: str(row.agent_name, 'agent_name'),
    sourceType: str(row.source_type, 'source_type') as 'entered' | 'discovered',
    status: str(row.status, 'status') as ActivationStatus,
    hasWebsite: bool(row.has_website, 'has_website'),
    googleMapsUrl: nullable(str, row.google_maps_url, 'google_maps_url'),
    facebookPageUrl: nullable(str, row.facebook_page_url, 'facebook_page_url'),
    instagramUrl: nullable(str, row.instagram_url, 'instagram_url'),
    createdAt: str(row.created_at, 'created_at'),
    activatedAt: nullable(str, row.activated_at, 'activated_at'),
    repliedAt: nullable(str, row.replied_at, 'replied_at'),
  }
}

/** Maps a raw Supabase DB row to a camelCase ActivationMessage */
export function msgFromDbRow(row: Record<string, unknown>): ActivationMessage {
  return {
    id: str(row.id, 'id'),
    leadId: str(row.lead_id, 'lead_id'),
    direction: str(row.direction, 'direction') as MessageDirection,
    body: str(row.body, 'body'),
    sequenceDay: row.sequence_day === null || row.sequence_day === undefined ? null : num(row.sequence_day, 'sequence_day'),
    status: str(row.status, 'status') as MessageStatus,
    channel: 'whatsapp',
    sentAt: nullable(str, row.sent_at, 'sent_at'),
    scheduledFor: nullable(str, row.scheduled_for, 'scheduled_for'),
  }
}

/** Assembles a lead row with its embedded messages (from Supabase nested select) */
export function fromDbRowWithMessages(row: Record<string, unknown>): ActivationLead {
  const lead = fromDbRow(row)
  const messageRows = Array.isArray(row.activation_messages) ? row.activation_messages : []
  lead.messages = messageRows.map((m: Record<string, unknown>) => msgFromDbRow(m))
  return lead
}
