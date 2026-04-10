import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { DiscoveredLead, DiscoverySearchParams } from '@/types/discovery'
import { SECTOR_LABELS, PRODUCT_DETAILS } from '@/lib/productMatch'
import { getHeatLevel } from '@/lib/heatScore'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    paddingBottom: 48,
  },

  // Header bar
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

  // Header body
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

  // Summary row
  summaryRow: {
    paddingHorizontal: 32,
    marginTop: 12,
  },
  summaryText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0a0a0a',
  },

  // Lead list
  leadList: {
    paddingHorizontal: 32,
    marginTop: 8,
  },

  // Lead card
  leadCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
  },

  // Left column
  colLeft: {
    flex: 3,
    paddingRight: 8,
  },
  businessName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0a0a0a',
    marginBottom: 3,
  },
  addressText: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#6b7280',
    marginBottom: 2,
  },
  phoneText: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#374151',
  },
  phoneTextItalic: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#9ca3af',
  },

  // Middle column
  colMiddle: {
    flex: 2,
    paddingRight: 8,
  },
  websiteYes: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
    marginBottom: 3,
  },
  websiteNo: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#9ca3af',
    marginBottom: 3,
  },
  mapsText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#6b7280',
  },

  // Right column
  colRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  badgeHot: {
    backgroundColor: '#dc2626',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 3,
  },
  badgeWarm: {
    backgroundColor: '#d97706',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 3,
  },
  badgeCold: {
    backgroundColor: '#2563eb',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 3,
  },
  badgeText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  productText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#6b7280',
    textAlign: 'right',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#9ca3af',
    textAlign: 'center',
  },
})

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

interface LeadCardProps {
  lead: DiscoveredLead
}

function LeadCard({ lead }: LeadCardProps) {
  const heatLevel = lead.heatLevel ?? getHeatLevel(lead.heatScore)
  const productName = PRODUCT_DETAILS[lead.recommendedProduct]?.name ?? lead.recommendedProduct

  const badgeStyle =
    heatLevel === 'HOT'
      ? styles.badgeHot
      : heatLevel === 'WARM'
      ? styles.badgeWarm
      : styles.badgeCold

  return (
    <View style={styles.leadCard}>
      {/* Left column */}
      <View style={styles.colLeft}>
        <Text style={styles.businessName}>{lead.businessName}</Text>
        <Text style={styles.addressText}>{lead.address}</Text>
        {lead.phone ? (
          <Text style={styles.phoneText}>{lead.phone}</Text>
        ) : (
          <Text style={styles.phoneTextItalic}>Phone not listed</Text>
        )}
      </View>

      {/* Middle column */}
      <View style={styles.colMiddle}>
        {lead.hasWebsite ? (
          <Text style={styles.websiteYes}>{'\u2713'} Has website</Text>
        ) : (
          <Text style={styles.websiteNo}>{'\u2717'} No website</Text>
        )}
        {lead.googleMapsUrl ? (
          <Text style={styles.mapsText}>{truncateMapsUrl(lead.googleMapsUrl)}</Text>
        ) : null}
      </View>

      {/* Right column */}
      <View style={styles.colRight}>
        <View style={badgeStyle}>
          <Text style={styles.badgeText}>{heatLevel}</Text>
        </View>
        <Text style={styles.productText}>{productName}</Text>
      </View>
    </View>
  )
}

interface DiscoveryReportPDFProps {
  leads: DiscoveredLead[]
  searchedAt: string
  searchParams: DiscoverySearchParams | null
}

export function DiscoveryReportPDF({ leads, searchedAt, searchParams }: DiscoveryReportPDFProps) {
  const plural = leads.length === 1 ? '' : 's'

  return (
    <Document title="Lead Discovery Report" author="Skhokho Labs">
      <Page size="A4" style={styles.page}>
        {/* Header bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarLeft}>SKHOKHO LABS</Text>
          <Text style={styles.topBarRight}>DISCOVERY REPORT</Text>
        </View>

        {/* Header body */}
        <View style={styles.headerBody}>
          <Text style={styles.heading}>Lead Discovery Report</Text>
          <Text style={styles.metaText}>Date: {formatDate(searchedAt)}</Text>
          {searchParams ? (
            <Text style={styles.metaText}>
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

        {/* Summary row */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {'Found '}
            {leads.length}
            {' lead'}
            {plural}
          </Text>
        </View>

        {/* Lead rows */}
        <View style={styles.leadList}>
          {leads.map((lead) => (
            <LeadCard key={lead.placeId} lead={lead} />
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by Skhokho Lead System · skhokho.co.za
          </Text>
        </View>
      </Page>
    </Document>
  )
}
