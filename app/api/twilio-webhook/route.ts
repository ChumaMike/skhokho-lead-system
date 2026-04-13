import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { getSupabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/activation'

export async function POST(request: Request) {
  // Validate Twilio signature
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const signature = request.headers.get('x-twilio-signature') ?? ''
  const host = request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const url = `${proto}://${host}/api/twilio-webhook`

  const rawBody = await request.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody))

  const isValid = twilio.validateRequest(authToken, signature, url, params)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 })
  }

  const from: string = params.From ?? '' // e.g. "whatsapp:+27834567890"
  const body: string = params.Body ?? ''

  // Strip "whatsapp:" prefix and normalize
  const rawPhone = from.replace(/^whatsapp:/i, '')
  const phone = normalizePhone(rawPhone)

  const supabase = getSupabase()

  // Find matching active lead
  const { data: lead, error: findError } = await (supabase as any)
    .from('activation_leads')
    .select('id, status')
    .eq('phone', phone)
    .in('status', ['sent', 'queued'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (findError || !lead) {
    // No matching active lead — ignore
    return NextResponse.json({ received: true })
  }

  // Record inbound message
  await (supabase as any).from('activation_messages').insert({
    lead_id: lead.id,
    direction: 'inbound',
    body,
    sequence_day: null,
    status: 'sent',
    channel: 'whatsapp',
    sent_at: new Date().toISOString(),
    scheduled_for: null,
  })

  // Cancel all scheduled outbound messages for this lead
  await (supabase as any)
    .from('activation_messages')
    .update({ status: 'cancelled' })
    .eq('lead_id', lead.id)
    .eq('status', 'scheduled')

  // Mark lead as replied
  await (supabase as any)
    .from('activation_leads')
    .update({ status: 'replied', replied_at: new Date().toISOString() })
    .eq('id', lead.id)

  return NextResponse.json({ received: true })
}
