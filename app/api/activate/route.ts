import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { normalizePhone, generateMessages, sendWhatsApp } from '@/lib/activation'
import { generateEmailMessages, sendEmail } from '@/lib/email'
import { isSAMobile } from '@/lib/placesApi'
import { getAllProductsWithOffer, getSupportingProducts } from '@/lib/productMatch'
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

      if (!isSAMobile(phone)) {
        console.warn(`Skipping ${lead.businessName} — ${phone} is a landline, not WhatsApp-capable`)
        failed++
        continue
      }

      const pseudoLead: DiscoveredLead = {
        placeId: '',
        businessName: lead.businessName,
        phone,
        email: null,
        address: lead.location,
        location: lead.location,
        sector: lead.sector,
        source: 'google_maps',
        hasWebsite: lead.hasWebsite ?? false,
        websiteUrl: '',
        googleMapsUrl: lead.googleMapsUrl ?? '',
        hasGoogleProfile: true,
        isWhatsAppCapable: true,
        facebookPageUrl: '',
        heatScore: lead.heatScore,
        heatLevel: lead.heatLevel,
        recommendedProduct: lead.recommendedProduct,
      }

      const products = getAllProductsWithOffer(pseudoLead)
      const offer = products.find((p) => p.product === lead.recommendedProduct)
      const pitch = offer?.pitch ?? ''
      const whyItFits = offer?.whyItFits ?? ''
      const supportingProducts = getSupportingProducts(lead.sector, lead.recommendedProduct)

      // Generate WhatsApp + (optionally) email IN PARALLEL.
      // If email is present and email gen fails, the whole activation fails — atomic.
      const hasEmail = typeof lead.email === 'string' && lead.email.trim() !== ''
      const [waMessages, emailMessages] = await Promise.all([
        generateMessages({ ...lead, phone }, pitch, whyItFits, supportingProducts),
        hasEmail
          ? generateEmailMessages({ ...lead, phone }, pitch, whyItFits, supportingProducts)
          : Promise.resolve(null),
      ])

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

      // Send Day 1 WhatsApp immediately (existing behaviour)
      const wamid = await sendWhatsApp(phone, waMessages.day1)

      await sb
        .from('activation_leads')
        .update({ status: 'sent', activated_at: new Date().toISOString() })
        .eq('id', activationLead.id)

      // Persist WhatsApp rows immediately so a downstream email failure cannot leave the WA send
      // without a DB record (which would cause double-sends on retry).
      const waRows: Record<string, unknown>[] = [
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: waMessages.day1,
          subject: null,
          sequence_day: 1,
          status: 'sent',
          channel: 'whatsapp',
          sent_at: now.toISOString(),
          scheduled_for: null,
          provider_message_id: wamid,
        },
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: waMessages.day4,
          subject: null,
          sequence_day: 4,
          status: 'scheduled',
          channel: 'whatsapp',
          sent_at: null,
          scheduled_for: day4Date.toISOString(),
        },
        {
          lead_id: activationLead.id,
          direction: 'outbound',
          body: waMessages.day7,
          subject: null,
          sequence_day: 7,
          status: 'scheduled',
          channel: 'whatsapp',
          sent_at: null,
          scheduled_for: day7Date.toISOString(),
        },
      ]
      await sb.from('activation_messages').insert(waRows)

      if (emailMessages && lead.email) {
        try {
          const trimmedEmail = lead.email.trim()
          const emailDay1Id = await sendEmail({
            to: trimmedEmail,
            subject: emailMessages.day1.subject,
            body: emailMessages.day1.body,
            leadId: activationLead.id as string,
            businessName: lead.businessName,
          })
          const emailRows: Record<string, unknown>[] = [
            {
              lead_id: activationLead.id,
              direction: 'outbound',
              body: emailMessages.day1.body,
              subject: emailMessages.day1.subject,
              sequence_day: 1,
              status: 'sent',
              channel: 'email',
              sent_at: new Date().toISOString(),
              scheduled_for: null,
              provider_message_id: emailDay1Id,
            },
            {
              lead_id: activationLead.id,
              direction: 'outbound',
              body: emailMessages.day4.body,
              subject: emailMessages.day4.subject,
              sequence_day: 4,
              status: 'scheduled',
              channel: 'email',
              sent_at: null,
              scheduled_for: day4Date.toISOString(),
            },
            {
              lead_id: activationLead.id,
              direction: 'outbound',
              body: emailMessages.day7.body,
              subject: emailMessages.day7.subject,
              sequence_day: 7,
              status: 'scheduled',
              channel: 'email',
              sent_at: null,
              scheduled_for: day7Date.toISOString(),
            },
          ]
          await sb.from('activation_messages').insert(emailRows)
        } catch (emailErr) {
          // WhatsApp side already persisted; log and continue. Lead is still considered activated.
          console.error('Email channel failed for lead (WhatsApp persisted):', lead.businessName, emailErr)
        }
      }

      activated++
    } catch (err) {
      console.error('Failed to activate lead:', (lead as ActivationLeadInput).businessName, err)
      failed++
    }
  }

  return NextResponse.json({ activated, failed })
}
