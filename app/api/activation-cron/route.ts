import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { sendWhatsApp } from '@/lib/activation'
import { sendEmail } from '@/lib/email'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

function isCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !authHeader) return false
  const expected = `Bearer ${secret}`
  try {
    const a = Buffer.from(authHeader)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: due, error } = await sb
    .from('activation_messages')
    .select('id, lead_id, body, subject, channel, activation_leads(phone, email, email_status, business_name, status)')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const msg of due ?? []) {
    const lead = msg.activation_leads as {
      phone: string
      email: string | null
      email_status: string | null
      business_name: string
      status: string
    } | null

    // Skip leads that already replied/booked/dead
    if (lead && ['replied', 'booked', 'dead'].includes(lead.status)) {
      await sb.from('activation_messages').update({ status: 'cancelled' }).eq('id', msg.id)
      skipped++
      continue
    }

    if (!lead) continue

    try {
      let providerId: string
      if (msg.channel === 'email') {
        // Skip if email is invalid/unsubscribed (or missing)
        if (!lead.email || (lead.email_status && ['bounced', 'unsubscribed'].includes(lead.email_status))) {
          await sb.from('activation_messages').update({ status: 'cancelled' }).eq('id', msg.id)
          skipped++
          continue
        }
        providerId = await sendEmail({
          to: lead.email,
          subject: msg.subject ?? '(no subject)',
          body: msg.body,
          leadId: msg.lead_id,
          businessName: lead.business_name,
        })
      } else {
        // whatsapp (default)
        if (!lead.phone) continue
        providerId = await sendWhatsApp(lead.phone, msg.body)
      }

      await sb
        .from('activation_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: providerId })
        .eq('id', msg.id)
      sent++
    } catch (err) {
      console.error('Failed to send scheduled message:', msg.id, err)
      await sb.from('activation_messages').update({ status: 'failed' }).eq('id', msg.id)
      failed++
    }
  }

  return NextResponse.json({ sent, failed, skipped })
}
