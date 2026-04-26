import { NextRequest, NextResponse } from 'next/server'
import type { DiscoverySearchParams } from '@/types/discovery'
import { searchPlaces } from '@/lib/placesApi'
import { scrapeContacts } from '@/lib/scrapeContacts'
import { getSectorSearchQuery } from '@/lib/sectorToPlaceType'

export async function POST(request: NextRequest) {
  // 1. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 2. Validate required fields
  const b = body as Record<string, unknown>

  const VALID_SECTORS = ['spaza_food', 'salon_hair', 'auto_mechanic', 'real_estate', 'legal_consulting', 'clinic_medical', 'other']

  if (!b.sector || !VALID_SECTORS.includes(b.sector as string)) {
    return NextResponse.json({ error: 'Invalid or missing sector' }, { status: 400 })
  }
  if (!b.location || typeof b.location !== 'string' || (b.location as string).trim() === '') {
    return NextResponse.json({ error: 'location is required' }, { status: 400 })
  }

  // radius: default to 5000 if not provided, clamp to 500–50000
  const radius = typeof b.radius === 'number' ? Math.min(50000, Math.max(500, b.radius)) : 5000

  // maxResults: default to 20 if not provided, clamp to 1–500
  const maxResults = typeof b.maxResults === 'number' ? Math.min(500, Math.max(1, b.maxResults)) : 20

  const params: DiscoverySearchParams = {
    sector: b.sector as DiscoverySearchParams['sector'],
    location: (b.location as string).trim(),
    radius,
    maxResults,
  }

  // 3. Check API key
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: 'GOOGLE_PLACES_API_KEY is not configured on the server' },
      { status: 500 }
    )
  }

  // 4. Call Places API
  try {
    const leads = await searchPlaces(params)

    // Best-effort email enrichment in parallel — failures are silent
    const enriched = await Promise.all(
      leads.map(async (lead) => {
        if (!lead.websiteUrl && !lead.facebookPageUrl) return lead
        const { email } = await scrapeContacts(lead.websiteUrl || null, lead.facebookPageUrl || null)
        return { ...lead, email }
      }),
    )

    const searchQuery = `${getSectorSearchQuery(params.sector)} in ${params.location}`

    return NextResponse.json({
      leads: enriched,
      searchQuery,
      totalFound: enriched.length,
      searchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Lead discovery error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search for leads' },
      { status: 500 }
    )
  }
}
