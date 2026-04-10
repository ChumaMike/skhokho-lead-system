import { Document, Page, StyleSheet } from '@react-pdf/renderer'
import type { LeadData } from '@/types/lead'
import { PDFHeader } from '@/pdf/sections/PDFHeader'
import { PDFLeadProfile } from '@/pdf/sections/PDFLeadProfile'
import { PDFDigitalPresence } from '@/pdf/sections/PDFDigitalPresence'
import { PDFHeatScore } from '@/pdf/sections/PDFHeatScore'
import { PDFProduct } from '@/pdf/sections/PDFProduct'
import { PDFContactScripts } from '@/pdf/sections/PDFContactScripts'
import { PDFFollowUpSequence } from '@/pdf/sections/PDFFollowUpSequence'
import { PDFClosingStructure } from '@/pdf/sections/PDFClosingStructure'

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: '#ffffff', paddingBottom: 40 },
})

export function LeadPDF({ lead }: { lead: LeadData }) {
  return (
    <Document title={`Lead Dossier — ${lead.businessName}`} author="Skhokho Labs">
      <Page size="A4" style={styles.page}>
        <PDFHeader lead={lead} />
        <PDFLeadProfile lead={lead} />
        <PDFDigitalPresence lead={lead} />
        <PDFHeatScore lead={lead} />
        <PDFProduct lead={lead} />
        <PDFContactScripts lead={lead} />
        <PDFFollowUpSequence lead={lead} />
        <PDFClosingStructure lead={lead} />
      </Page>
    </Document>
  )
}
