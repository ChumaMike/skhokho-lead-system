import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { LeadData } from '@/types/lead'
import { getFollowUpSequence } from '@/lib/scripts'

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
  item: {
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dayLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
    marginRight: 8,
  },
  angleBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  angleBadgeText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
  },
  messageBox: {
    backgroundColor: '#f9fafb',
    border: '1pt solid #e5e7eb',
    borderRadius: 4,
    padding: 10,
  },
  messageText: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#374151',
    lineHeight: 1.5,
  },
})

export function PDFFollowUpSequence({ lead }: { lead: LeadData }) {
  const sequence = getFollowUpSequence(lead)

  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>Follow-Up Sequence</Text>

      {sequence.map((item, i) => (
        <View key={i} style={styles.item}>
          <View style={styles.headerRow}>
            <Text style={styles.dayLabel}>Day {item.day}</Text>
            <View style={styles.angleBadge}>
              <Text style={styles.angleBadgeText}>{item.angle}</Text>
            </View>
          </View>
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{item.message}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
