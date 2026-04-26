import type { LeadData } from '@/types/lead'
import type { DiscoveredLead, DiscoverySearchParams } from '@/types/discovery'
import { calculateHeatScore, getHeatLevel } from '@/lib/heatScore'
import { getRecommendedProduct } from '@/lib/productMatch'
import { getSectorSearchQuery } from '@/lib/sectorToPlaceType'

interface PlacesApiPlace {
  id?: string
  displayName?: { text?: string; languageCode?: string }
  formattedAddress?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
}

interface PlacesApiResponse {
  places?: PlacesApiPlace[]
}

/**
 * Returns true if the phone number is a South African mobile number (06x/07x/08x)
 * and therefore likely reachable on WhatsApp.
 */
export function isSAMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  // E.164 format: +27 6xx xxx xxxx → 276xxxxxxxx
  if (digits.startsWith('27') && digits.length === 11) {
    return ['6', '7', '8'].includes(digits[2])
  }
  // Local format: 06x/07x/08x
  if (digits.startsWith('0') && digits.length === 10) {
    return ['6', '7', '8'].includes(digits[1])
  }
  return false
}

/**
 * Searches Facebook Graph API for a business page by name.
 * Returns the page URL or null if not found / API unavailable.
 */
async function findFacebookPage(businessName: string): Promise<string | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token) return null
  try {
    const q = encodeURIComponent(businessName)
    const res = await fetch(
      `https://graph.facebook.com/v19.0/pages/search?q=${q}&fields=name,link&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) return null
    const data = await res.json() as { data?: Array<{ name: string; link?: string }> }
    return data.data?.[0]?.link ?? null
  } catch {
    return null
  }
}

interface PlacesApiResponseWithToken extends PlacesApiResponse {
  nextPageToken?: string
}

const PLACES_API_PAGE_SIZE = 20 // max per Google Places API call

/**
 * Fetches one page from Google Places Text Search API.
 * Returns places and an optional nextPageToken for pagination.
 */
async function fetchPlacesPage(
  apiKey: string,
  textQuery: string,
  pageSize: number,
  pageToken?: string,
): Promise<{ places: PlacesApiPlace[]; nextPageToken?: string }> {
  const body: Record<string, unknown> = {
    textQuery,
    maxResultCount: pageSize,
    languageCode: 'en',
  }
  if (pageToken) body.pageToken = pageToken

  let response: Response
  try {
    response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,nextPageToken',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new Error(`Google Places API network error: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Places API request failed (${response.status}): ${text}`)
  }

  const data: PlacesApiResponseWithToken = await response.json()
  return { places: data.places ?? [], nextPageToken: data.nextPageToken }
}

/**
 * Searches Google Places API v1 Text Search for businesses matching the
 * given discovery params and returns a list of DiscoveredLead objects
 * sorted by heatScore descending.
 *
 * Supports up to 500 results via automatic pagination (20 per page).
 */
export async function searchPlaces(
  params: DiscoverySearchParams,
): Promise<DiscoveredLead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set')
  }

  if (params.maxResults < 1 || params.maxResults > 500) {
    throw new Error(`maxResults must be between 1 and 500, got ${params.maxResults}`)
  }

  const textQuery = `${getSectorSearchQuery(params.sector)} in ${params.location}`

  // Paginate until we have enough results or there are no more pages
  const allPlaces: PlacesApiPlace[] = []
  let pageToken: string | undefined = undefined

  while (allPlaces.length < params.maxResults) {
    const remaining = params.maxResults - allPlaces.length
    const pageSize = Math.min(remaining, PLACES_API_PAGE_SIZE)
    const { places, nextPageToken } = await fetchPlacesPage(apiKey, textQuery, pageSize, pageToken)

    allPlaces.push(...places)

    if (!nextPageToken || places.length < pageSize) break
    pageToken = nextPageToken
  }

  const places = allPlaces.slice(0, params.maxResults)

  // Run Facebook page lookups in parallel with lead construction
  const facebookPages = await Promise.all(
    places.map((place) => findFacebookPage(place.displayName?.text ?? ''))
  )

  const leads: DiscoveredLead[] = places.map((place, i) => {
    const phone = place.internationalPhoneNumber ?? ''
    const hasWebsite = !!place.websiteUri
    const isWhatsAppCapable = isSAMobile(phone)
    const facebookPageUrl = facebookPages[i] ?? ''

    const minimalLead: LeadData = {
      agentName: '',
      businessName: place.displayName?.text ?? '',
      ownerName: '',
      phone,
      location: params.location,
      sector: params.sector,
      source: 'google_maps',
      hasWebsite,
      hasGoogleProfile: true,
      facebookUrl: facebookPageUrl,
      followerCount: null,
      lastPostDate: '',
      heatScore: 0,
      heatScoreOverridden: false,
      recommendedProduct: getRecommendedProduct(params.sector),
      notes: '',
      dateGenerated: '',
    }

    const heatScore = calculateHeatScore(minimalLead)
    const heatLevel = getHeatLevel(heatScore)

    return {
      placeId: place.id ?? '',
      businessName: place.displayName?.text ?? '',
      phone,
      email: null,
      address: place.formattedAddress ?? '',
      location: params.location,
      sector: params.sector,
      source: 'google_maps',
      hasWebsite,
      websiteUrl: place.websiteUri ?? '',
      googleMapsUrl: place.googleMapsUri ?? '',
      hasGoogleProfile: true,
      heatScore,
      heatLevel,
      recommendedProduct: getRecommendedProduct(params.sector),
      isWhatsAppCapable,
      facebookPageUrl,
    }
  })

  leads.sort((a, b) => b.heatScore - a.heatScore)

  return leads
}
