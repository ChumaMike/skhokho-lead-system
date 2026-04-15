import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { sendWhatsApp } from '@/lib/activation'
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
  const { data: due, error } = await (supabase as any)
    .from('activation_messages')
    .select('id, lead_id, body, activation_leads(phone, status)')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let failed = 0

  for (const msg of due ?? []) {
    const leadStatus = (msg.activation_leads as { status: string } | null)?.status
    // Skip leads that already replied, booked, or dead
    if (leadStatus && ['replied', 'booked', 'dead'].includes(leadStatus)) {
      await (supabase as any)
        .from('activation_messages')
        .update({ status: 'cancelled' })
        .eq('id', msg.id)
      continue
    }

    const phone = (msg.activation_leads as { phone: string } | null)?.phone
    if (!phone) continue

    try {
      const wamid = await sendWhatsApp(phone, msg.body)
      await (supabase as any)
        .from('activation_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString(), meta_message_id: wamid })
        .eq('id', msg.id)
      sent++
    } catch (err) {
      console.error('Failed to send scheduled message:', msg.id, err)
      await (supabase as any)
        .from('activation_messages')
        .update({ status: 'failed' })
        .eq('id', msg.id)
      failed++
    }
  }

  return NextResponse.json({ sent, failed })
}
