import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { LeadData } from '@/types/lead'
import { PRODUCT_DETAILS } from '@/lib/productMatch'

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
    flexDirection: 'row',
    marginBottom: 10,
  },
  number: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
    width: 20,
  },
  content: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0a0a0a',
    marginBottom: 2,
  },
  stepBody: {
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#374151',
    lineHeight: 1.5,
  },
})

export function PDFClosingStructure({ lead }: { lead: LeadData }) {
  const product = PRODUCT_DETAILS[lead.recommendedProduct]
  if (!product) return null

  const steps = [
    {
      title: 'Open with their world (2 min)',
      body: `Ask ${lead.ownerName} about ${lead.businessName}'s current situation and challenges.`,
    },
    {
      title: 'Identify the pain (3 min)',
      body: `Explore what's not working right now. Listen more than you talk.`,
    },
    {
      title: `Show the solution (3 min)`,
      body: `Introduce ${product.name}: explain how it solves the pain.`,
    },
    {
      title: 'Name the price clearly (1 min)',
      body: `Setup: ${product.setupFee}, Monthly: ${product.monthly}`,
    },
    {
      title: 'The close (2 min)',
      body: `"Are you ready to get started today? I can have your setup going within 48 hours."`,
    },
  ]

  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>Closing Call Structure (11 Minutes)</Text>

      {steps.map((step, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.number}>{i + 1}.</Text>
          <View style={styles.content}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepBody}>{step.body}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
