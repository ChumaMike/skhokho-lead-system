import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { LeadData } from '@/types/lead'
import { SECTOR_LABELS, SOURCE_LABELS } from '@/lib/productMatch'

const sectionStyles = StyleSheet.create({
  section: { marginHorizontal: 32, marginTop: 20 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#0a0a0a',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '1pt solid #e5e7eb',
  },
})

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    marginBottom: 10,
  },
  label: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#6b7280',
    marginBottom: 2,
  },
  value: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#374151',
  },
})

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

export function PDFLeadProfile({ lead }: { lead: LeadData }) {
  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>Lead Profile</Text>
      <View style={styles.grid}>
        <LabelValue label="Business Name" value={lead.businessName} />
        <LabelValue label="Owner Name" value={lead.ownerName} />
        <LabelValue label="Phone" value={lead.phone} />
        <LabelValue label="Location" value={lead.location} />
        <LabelValue label="Sector" value={SECTOR_LABELS[lead.sector]} />
        <LabelValue label="Source" value={SOURCE_LABELS[lead.source]} />
      </View>
    </View>
  )
}
