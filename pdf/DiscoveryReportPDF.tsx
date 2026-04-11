import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { DiscoveredLead, DiscoverySearchParams } from '@/types/discovery'
import { SECTOR_LABELS, PRODUCT_DETAILS, getAllProductsWithOffer, discoveredLeadToLeadData } from '@/lib/productMatch'
import { getHeatLevel } from '@/lib/heatScore'
import { PDFHeader } from '@/pdf/sections/PDFHeader'
import { PDFLeadProfile } from '@/pdf/sections/PDFLeadProfile'
import { PDFDigitalPresence } from '@/pdf/sections/PDFDigitalPresence'
import { PDFHeatScore } from '@/pdf/sections/PDFHeatScore'
import { PDFAllProducts } from '@/pdf/sections/PDFAllProducts'
import { PDFContactScripts } from '@/pdf/sections/PDFContactScripts'
import { PDFFollowUpSequence } from '@/pdf/sections/PDFFollowUpSequence'
import { PDFClosingStructure } from '@/pdf/sections/PDFClosingStructure'

// ---------------------------------------------------------------------------
// Cover page styles (preserved from original)
// ---------------------------------------------------------------------------
const coverStyles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    paddingBottom: 48,
  },
  topBar: {
    backgroundColor: '#0a0a0a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 10,
  },
  topBarLeft: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  topBarRight: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
  },
  headerBody: {
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  heading: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#0a0a0a',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#6b7280',
    marginBottom: 2,
  },
  summaryRow: {
    paddingHorizontal: 32,
    marginTop: 12,
  },
  summaryText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0a0a0a',
  },
  summarySubtext: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#6b7280',
    marginTop: 4,
  },
  leadList: {
    paddingHorizontal: 32,
    marginTop: 8,
  },
  leadCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
  },
  colLeft: { flex: 3, paddingRight: 8 },
  businessName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0a0a0a',
    marginBottom: 3,
  },
  addressText: { fontSize: 9, fontFamily: 'Helvetica', color: '#6b7280', marginBottom: 2 },
  phoneText: { fontSize: 9, fontFamily: 'Helvetica', color: '#374151' },
  phoneTextItalic: { fontSize: 9, fontFamily: 'Helvetica', color: '#9ca3af' },
  colMiddle: { flex: 2, paddingRight: 8 },
  websiteYes: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#16a34a', marginBottom: 3 },
  websiteNo: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#9ca3af', marginBottom: 3 },
  mapsText: { fontSize: 8, fontFamily: 'Helvetica', color: '#6b7280' },
  colRight: { flex: 1, alignItems: 'flex-end' },
  badgeHot: { backgroundColor: '#dc2626', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 3 },
  badgeWarm: { backgroundColor: '#d97706', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 3 },
  badgeCold: { backgroundColor: '#2563eb', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 3 },
  badgeText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  productText: { fontSize: 8, fontFamily: 'Helvetica', color: '#6b7280', textAlign: 'right' },
  footer: { position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center' },
  footerText: { fontSize: 8, fontFamily: 'Helvetica', color: '#9ca3af', textAlign: 'center' },
})

// ---------------------------------------------------------------------------
// Dossier page styles
// ---------------------------------------------------------------------------
const dossierStyles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    paddingBottom: 48,
  },
  footer: { position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center' },
  footerText: { fontSize: 8, fontFamily: 'Helvetica', color: '#9ca3af', textAlign: 'center' },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string): string {
  const d = iso ? new Date(iso) : new Date()
  const valid = !isNaN(d.getTime())
  return (valid ? d : new Date()).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function truncateMapsUrl(url: string, max = 40): string {
  if (!url) return ''
  return url.length > max ? url.slice(0, max) + '...' : url
}

// ---------------------------------------------------------------------------
// Cover page lead card
// ---------------------------------------------------------------------------
function CoverLeadCard({ lead }: { lead: DiscoveredLead }) {
  const heatLevel = lead.heatLevel ?? getHeatLevel(lead.heatScore)
  const productName = PRODUCT_DETAILS[lead.recommendedProduct]?.name ?? lead.recommendedProduct

  const badgeStyle =
    heatLevel === 'HOT' ? coverStyles.badgeHot
    : heatLevel === 'WARM' ? coverStyles.badgeWarm
    : coverStyles.badgeCold

  return (
    <View style={coverStyles.leadCard}>
      <View style={coverStyles.colLeft}>
        <Text style={coverStyles.businessName}>{lead.businessName}</Text>
        <Text style={coverStyles.addressText}>{lead.address}</Text>
        {lead.phone ? (
          <Text style={coverStyles.phoneText}>{lead.phone}</Text>
        ) : (
          <Text style={coverStyles.phoneTextItalic}>Phone not listed</Text>
        )}
      </View>
      <View style={coverStyles.colMiddle}>
        {lead.hasWebsite ? (
          <Text style={coverStyles.websiteYes}>{'\u2713'} Has website</Text>
        ) : (
          <Text style={coverStyles.websiteNo}>{'\u2717'} No website</Text>
        )}
        {lead.googleMapsUrl ? (
          <Text style={coverStyles.mapsText}>{truncateMapsUrl(lead.googleMapsUrl)}</Text>
        ) : null}
      </View>
      <View style={coverStyles.colRight}>
        <View style={badgeStyle}>
          <Text style={coverStyles.badgeText}>{heatLevel}</Text>
        </View>
        <Text style={coverStyles.productText}>{productName}</Text>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
interface DiscoveryReportPDFProps {
  leads: DiscoveredLead[]
  searchedAt: string
  searchParams: DiscoverySearchParams | null
  agentName?: string
}

export function DiscoveryReportPDF({ leads, searchedAt, searchParams, agentName = '' }: DiscoveryReportPDFProps) {
  const plural = leads.length === 1 ? '' : 's'

  return (
    <Document title="Lead Discovery Dossier" author="Skhokho Labs">
      {/* ------------------------------------------------------------------ */}
      {/* Page 1 — Cover / Quick-scan overview                               */}
      {/* ------------------------------------------------------------------ */}
      <Page size="A4" style={coverStyles.page}>
        <View style={coverStyles.topBar}>
          <Text style={coverStyles.topBarLeft}>SKHOKHO LABS</Text>
          <Text style={coverStyles.topBarRight}>DISCOVERY DOSSIER</Text>
        </View>

        <View style={coverStyles.headerBody}>
          <Text style={coverStyles.heading}>Lead Discovery Dossier</Text>
          <Text style={coverStyles.metaText}>Date: {formatDate(searchedAt)}</Text>
          {agentName ? (
            <Text style={coverStyles.metaText}>Agent: {agentName}</Text>
          ) : null}
          {searchParams ? (
            <Text style={coverStyles.metaText}>
              {'Sector: '}
              {SECTOR_LABELS[searchParams.sector]}
              {' \u00b7 Location: '}
              {searchParams.location}
              {' \u00b7 Max: '}
              {searchParams.maxResults}
              {' results'}
            </Text>
          ) : null}
        </View>

        <View style={coverStyles.summaryRow}>
          <Text style={coverStyles.summaryText}>
            {'Found '}
            {leads.length}
            {' lead'}
            {plural}
          </Text>
          <Text style={coverStyles.summarySubtext}>
            Full sales dossier for each lead follows on the next pages.
          </Text>
        </View>

        <View style={coverStyles.leadList}>
          {leads.map((lead) => (
            <CoverLeadCard key={lead.placeId} lead={lead} />
          ))}
        </View>

        <View style={coverStyles.footer} fixed>
          <Text style={coverStyles.footerText}>
            Generated by Skhokho Lead System · skhokho.co.za
          </Text>
        </View>
      </Page>

      {/* ------------------------------------------------------------------ */}
      {/* Pages 2..N — Full dossier per lead                                 */}
      {/* ------------------------------------------------------------------ */}
      {leads.map((lead) => {
        const leadData = discoveredLeadToLeadData(lead, agentName)
        // Use the search timestamp for a consistent date across all dossier pages
        leadData.dateGenerated = searchedAt
        const offers = getAllProductsWithOffer(lead)

        return (
          <Page key={`dossier-${lead.placeId}`} size="A4" style={dossierStyles.page}>
            <PDFHeader lead={leadData} />
            <PDFLeadProfile lead={leadData} />
            <PDFDigitalPresence lead={leadData} />
            <PDFHeatScore lead={leadData} />
            <PDFAllProducts offers={offers} />
            <PDFContactScripts lead={leadData} />
            <PDFFollowUpSequence lead={leadData} />
            <PDFClosingStructure lead={leadData} />

            <View style={dossierStyles.footer} fixed>
              <Text style={dossierStyles.footerText}>
                Generated by Skhokho Lead System · skhokho.co.za
              </Text>
            </View>
          </Page>
        )
      })}
    </Document>
  )
}
