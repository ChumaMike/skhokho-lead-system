import { renderToBuffer } from '@react-pdf/renderer'
import { DiscoveryReportPDF } from '@/pdf/DiscoveryReportPDF'
import type { DiscoveredLead, DiscoverySearchParams } from '@/types/discovery'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  if (!Array.isArray(b.leads) || b.leads.length === 0) {
    return NextResponse.json({ error: 'leads array is required and must not be empty' }, { status: 400 })
  }

  try {
    const leads = b.leads as DiscoveredLead[]
    const searchedAt = typeof b.searchedAt === 'string' ? b.searchedAt : new Date().toISOString()
    const searchParams = (b.searchParams as DiscoverySearchParams | null) ?? null
    const agentName = typeof b.agentName === 'string' ? b.agentName.trim() : ''

    const buffer = await renderToBuffer(
      <DiscoveryReportPDF leads={leads} searchedAt={searchedAt} searchParams={searchParams} agentName={agentName} />
    )
    const pdfBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="lead-discovery-report-${Date.now()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Discovery PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
