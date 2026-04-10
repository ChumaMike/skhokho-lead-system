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
  productName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#16a34a',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  priceItem: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#374151',
    marginRight: 20,
  },
  pitch: {
    fontSize: 11,
    fontFamily: 'Helvetica-Oblique',
    color: '#6b7280',
  },
})

export function PDFProduct({ lead }: { lead: LeadData }) {
  const product = PRODUCT_DETAILS[lead.recommendedProduct]
  if (!product) return null

  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>Recommended Product</Text>
      <Text style={styles.productName}>{product.name}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.priceItem}>Setup: {product.setupFee}</Text>
        <Text style={styles.priceItem}>Monthly: {product.monthly}</Text>
      </View>
      <Text style={styles.pitch}>{product.pitch}</Text>
    </View>
  )
}
