import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { LeadData } from '@/types/lead'
import { getPhoneScript, getFacebookDMScript, getWalkInScript } from '@/lib/scripts'

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
  subsection: {
    marginBottom: 14,
  },
  subsectionLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0a0a0a',
    marginBottom: 6,
  },
  scriptBox: {
    backgroundColor: '#f9fafb',
    border: '1pt solid #e5e7eb',
    borderRadius: 4,
    padding: 10,
  },
  scriptText: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#374151',
    lineHeight: 1.5,
  },
})

export function PDFContactScripts({ lead }: { lead: LeadData }) {
  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>Contact Scripts</Text>

      <View style={styles.subsection}>
        <Text style={styles.subsectionLabel}>Phone / WhatsApp Call</Text>
        <View style={styles.scriptBox}>
          <Text style={styles.scriptText}>{getPhoneScript(lead)}</Text>
        </View>
      </View>

      <View style={styles.subsection}>
        <Text style={styles.subsectionLabel}>Facebook / Instagram DM</Text>
        <View style={styles.scriptBox}>
          <Text style={styles.scriptText}>{getFacebookDMScript(lead)}</Text>
        </View>
      </View>

      <View style={styles.subsection}>
        <Text style={styles.subsectionLabel}>Walk-in Approach</Text>
        <View style={styles.scriptBox}>
          <Text style={styles.scriptText}>{getWalkInScript(lead)}</Text>
        </View>
      </View>
    </View>
  )
}
