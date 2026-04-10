import { renderToBuffer } from '@react-pdf/renderer'
import { LeadPDF } from '@/pdf/LeadPDF'
import type { LeadData } from '@/types/lead'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).businessName !== 'string' ||
    typeof (body as Record<string, unknown>).recommendedProduct !== 'string'
  ) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const lead = body as LeadData

  try {
    // Set dateGenerated to now if not provided
    const leadWithDate: LeadData = {
      ...lead,
      dateGenerated: lead.dateGenerated || new Date().toISOString(),
    }

    const buffer = await renderToBuffer(<LeadPDF lead={leadWithDate} />)
    // Convert Node Buffer to ArrayBuffer so it satisfies NextResponse's BodyInit (BufferSource)
    const pdfBuffer: ArrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

    const filename = `lead-${leadWithDate.businessName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
