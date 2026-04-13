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

  // Top line: badge + name (left) and pricing (right)
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  recommendedBadge: {
    backgroundColor: '#16a34a',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: 6,
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

  // Pitch line
  pitch: {
    fontSize: 9,
    fontFamily: 'Helvetica-Oblique',
    color: '#6b7280',
    marginBottom: 4,
  },

  // Why it fits block
  whyBlock: {
    backgroundColor: '#ffffff',
    borderRadius: 2,
    padding: 5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  whyBlockRecommended: {
    backgroundColor: '#ffffff',
    borderRadius: 2,
    padding: 5,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  whyLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 2,
  },
  whyText: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#374151',
  },
})

interface PDFAllProductsProps {
  offers: ProductOffer[]
}

export function PDFAllProducts({ offers }: PDFAllProductsProps) {
  const sorted = [...offers].sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0))

  return (
    <View style={sectionStyles.section}>
      <Text style={sectionStyles.sectionTitle}>All Products We Can Build For Them</Text>
      {sorted.map((offer) => (
        <View
          key={offer.product}
          style={[styles.row, offer.isRecommended ? styles.rowRecommended : styles.rowOther]}
        >
          {/* Product name + pricing */}
          <View style={styles.topRow}>
            <View style={styles.topLeft}>
              {offer.isRecommended && (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedBadgeText}>★ RECOMMENDED</Text>
                </View>
              )}
              <Text style={styles.productName}>{offer.name}</Text>
            </View>
            <Text style={styles.pricing}>{offer.setupFee} setup · {offer.monthly}</Text>
          </View>

          {/* Pitch */}
          <Text style={styles.pitch}>{offer.pitch}</Text>

          {/* Why it fits — in its own block so text wraps properly */}
          <View style={offer.isRecommended ? styles.whyBlockRecommended : styles.whyBlock}>
            <Text style={styles.whyLabel}>WHY IT FITS THIS BUSINESS:</Text>
            <Text style={styles.whyText}>{offer.whyItFits}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
