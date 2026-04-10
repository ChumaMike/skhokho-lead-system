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
 * Searches Google Places API v1 Text Search for businesses matching the
 * given discovery params and returns a list of DiscoveredLead objects
 * sorted by heatScore descending.
 */
export async function searchPlaces(
  params: DiscoverySearchParams,
): Promise<DiscoveredLead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set')
  }

  if (params.maxResults < 1 || params.maxResults > 20) {
    throw new Error(`maxResults must be between 1 and 20, got ${params.maxResults}`)
  }

  const textQuery = `${getSectorSearchQuery(params.sector)} in ${params.location}`

  // Note: params.radius is reserved for future coordinate-based locationBias.
  // Currently, location scope is handled via the text query above.
  let response: Response
  try {
    response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri',
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: params.maxResults,
        languageCode: 'en',
      }),
    })
  } catch (err) {
    throw new Error(`Google Places API network error: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Google Places API request failed (${response.status}): ${body}`,
    )
  }

  const data: PlacesApiResponse = await response.json()
  const places = data.places ?? []

  const leads: DiscoveredLead[] = places.map((place) => {
    const hasWebsite = !!place.websiteUri

    const minimalLead: LeadData = {
      agentName: '',
      businessName: place.displayName?.text ?? '',
      ownerName: '',
      phone: place.internationalPhoneNumber ?? '',
      location: params.location,
      sector: params.sector,
      source: 'google_maps',
      hasWebsite,
      hasGoogleProfile: true,
      facebookUrl: '',
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
      phone: place.internationalPhoneNumber ?? '',
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
    }
  })

  leads.sort((a, b) => b.heatScore - a.heatScore)

  return leads
}
