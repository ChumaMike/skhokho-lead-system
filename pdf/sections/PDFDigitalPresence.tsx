import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { LeadData } from '@/types/lead'

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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#6b7280',
    width: 160,
  },
  valueYes: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
  },
  valueNo: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#6b7280',
  },
  valueBody: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#374151',
  },
})

function formatLastPost(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function PDFDigitalPresence({ lead }: { lead: LeadData }) {
  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>Digital Presence</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Website</Text>
        {lead.hasWebsite ? (
          <Text style={styles.valueYes}>Yes</Text>
        ) : (
          <Text style={styles.valueNo}>No</Text>
        )}
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Google Business Profile</Text>
        {lead.hasGoogleProfile ? (
          <Text style={styles.valueYes}>Yes</Text>
        ) : (
          <Text style={styles.valueNo}>No</Text>
        )}
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Facebook URL</Text>
        <Text style={styles.valueBody}>{lead.facebookUrl || '-'}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Follower Count</Text>
        <Text style={styles.valueBody}>
          {lead.followerCount != null ? String(lead.followerCount) : '-'}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Last Post Date</Text>
        <Text style={styles.valueBody}>{formatLastPost(lead.lastPostDate)}</Text>
      </View>
    </View>
  )
}
