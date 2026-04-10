import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { LeadData } from '@/types/lead'

const styles = StyleSheet.create({
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
    paddingTop: 24,
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

export function PDFHeader({ lead }: { lead: LeadData }) {
  return (
    <View>
      <View style={styles.topBar}>
        <Text style={styles.topBarLeft}>SKHOKHO LABS</Text>
        <Text style={styles.topBarRight}>LEAD DOSSIER</Text>
      </View>
      <View style={styles.headerBody}>
        <Text style={styles.heading}>Lead Dossier</Text>
        <Text style={styles.metaText}>Generated: {formatDate(lead.dateGenerated)}</Text>
        <Text style={styles.metaText}>Agent: {lead.agentName}</Text>
      </View>
    </View>
  )
}
