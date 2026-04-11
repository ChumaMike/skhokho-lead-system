import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ProductOffer } from '@/lib/productMatch'

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
    borderRadius: 4,
    padding: 8,
    marginBottom: 5,
    borderWidth: 1,
  },
  rowRecommended: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
  },
  rowOther: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 4,
  },
  recommendedBadge: {
    backgroundColor: '#16a34a',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 5,
  },
  recommendedBadgeText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  productName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0a0a0a',
  },
  pricing: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#6b7280',
  },
  pitch: {
    fontSize: 9,
    fontFamily: 'Helvetica-Oblique',
    color: '#6b7280',
    marginBottom: 2,
  },
  whyRow: {
    flexDirection: 'row',
  },
  whyLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
  },
  whyText: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#374151',
    flex: 1,
  },
})

interface PDFAllProductsProps {
  offers: ProductOffer[]
}

export function PDFAllProducts({ offers }: PDFAllProductsProps) {
  const sorted = [...offers].sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0))

  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>All Product Options</Text>
      {sorted.map((offer) => (
        <View
          key={offer.product}
          style={[styles.row, offer.isRecommended ? styles.rowRecommended : styles.rowOther]}
        >
          <View style={styles.rowHeader}>
            <View style={styles.rowLeft}>
              {offer.isRecommended && (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedBadgeText}>★ RECOMMENDED</Text>
                </View>
              )}
              <Text style={styles.productName}>{offer.name}</Text>
            </View>
            <Text style={styles.pricing}>
              {offer.setupFee} setup · {offer.monthly}
            </Text>
          </View>
          <Text style={styles.pitch}>{offer.pitch}</Text>
          <View style={styles.whyRow}>
            <Text style={styles.whyLabel}>Why it fits: </Text>
            <Text style={styles.whyText}>{offer.whyItFits}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
