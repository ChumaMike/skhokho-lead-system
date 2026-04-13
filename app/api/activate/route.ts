import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { normalizePhone, generateMessages, sendWhatsApp } from '@/lib/activation'
import { getAllProductsWithOffer } from '@/lib/productMatch'
import { toDbRow } from '@/types/activation'
import type { ActivationLeadInput } from '@/types/activation'
import type { DiscoveredLead } from '@/types/discovery'

export async function POST(request: Request) {
  let leads: ActivationLeadInput[]
  try {
    leads = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: 'Provide a non-empty array of leads' }, { status: 400 })
  }

  const supabase = getSupabase()
  let activated = 0
  let failed = 0

  for (const lead of leads) {
    try {
      const phone = normalizePhone(lead.phone)

      // Build a minimal DiscoveredLead shape for getAllProductsWithOffer
      const pseudoLead: DiscoveredLead = {
        placeId: '',
        businessName: lead.businessName,
        phone,
        address: lead.location,
        location: lead.location,
        sector: lead.sector,
        source: 'google_maps',
        hasWebsite: lead.hasWebsite ?? false,
        websiteUrl: '',
        googleMapsUrl: lead.googleMapsUrl ?? '',
        hasGoogleProfile: true,
        heatScore: lead.heatScore,
        heatLevel: lead.heatLevel,
        recommendedProduct: lead.recommendedProduct,
      }

      const products = getAllProductsWithOffer(pseudoLead)
      const offer = products.find((p) => p.product === lead.recommendedProduct)
      const pitch = offer?.pitch ?? ''
      const whyItFits = offer?.whyItFits ?? ''

      const messages = await generateMessages({ ...lead, phone }, pitch, whyItFits)

      const now = new Date()
      const day4Date = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      const day7Date = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any

      const { data: activationLead, error: leadError } = await sb
        .from('activation_leads')
        .insert(toDbRow({ ...lead, phone, status: 'queued' }))
        .select()
        .single()

      if (leadError) throw leadError

      await sendWhatsApp(phone, messages.day1)

      await sb
        .from('activation_leads')
        .update({ status: 'sent', activated_at: new Date().toISOString() })
        .eq('id', activationLead.id)

      await sb.from('activation_messages').insert([
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: messages.day1,
          sequence_day: 1,
          status: 'sent',
          channel: 'whatsapp',
          sent_at: now.toISOString(),
          scheduled_for: null,
        },
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: messages.day4,
          sequence_day: 4,
          status: 'scheduled',
          channel: 'whatsapp',
          sent_at: null,
          scheduled_for: day4Date.toISOString(),
        },
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: messages.day7,
          sequence_day: 7,
          status: 'scheduled',
          channel: 'whatsapp',
          sent_at: null,
          scheduled_for: day7Date.toISOString(),
        },
      ])

      activated++
    } catch (err) {
      console.error('Failed to activate lead:', (lead as ActivationLeadInput).businessName, err)
      failed++
    }
  }

  return NextResponse.json({ activated, failed })
}
