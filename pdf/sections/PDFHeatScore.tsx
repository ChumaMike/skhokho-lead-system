import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { LeadData } from '@/types/lead'
import { getHeatLevel, getScoreBreakdown } from '@/lib/heatScore'

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
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreLarge: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#0a0a0a',
    marginRight: 12,
  },
  badgeHOT: {
    backgroundColor: '#dc2626',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeWARM: {
    backgroundColor: '#d97706',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeCOLD: {
    backgroundColor: '#2563eb',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  factorLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#374151',
    flex: 1,
  },
  earnedText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
    width: 60,
    textAlign: 'right',
  },
  notEarnedText: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#6b7280',
    width: 60,
    textAlign: 'right',
  },
})

export function PDFHeatScore({ lead }: { lead: LeadData }) {
  const level = getHeatLevel(lead.heatScore)
  const breakdown = getScoreBreakdown(lead)

  const badgeStyle =
    level === 'HOT' ? styles.badgeHOT : level === 'WARM' ? styles.badgeWARM : styles.badgeCOLD

  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>Lead Heat Score</Text>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreLarge}>{lead.heatScore} / 10</Text>
        <View style={badgeStyle}>
          <Text style={styles.badgeText}>{level}</Text>
        </View>
      </View>

      {breakdown.map((factor, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.factorLabel}>{factor.label}</Text>
          {factor.earned ? (
            <Text style={styles.earnedText}>+{factor.points} pts</Text>
          ) : (
            <Text style={styles.notEarnedText}>-</Text>
          )}
        </View>
      ))}
    </View>
  )
}
