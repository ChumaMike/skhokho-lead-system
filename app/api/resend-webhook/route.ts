import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { verifySvixSignature } from '@/lib/svixVerify'

// Resend event names → our DB MessageStatus mapping
const STATUS_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'read',
  'email.bounced': 'failed',
  'email.complained': 'failed',
}

const EVENT_TYPE_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const id = request.headers.get('svix-id') ?? ''
  const timestamp = request.headers.get('svix-timestamp') ?? ''
  const signature = request.headers.get('svix-signature') ?? ''
  const body = await request.text()

  if (!verifySvixSignature({ id, timestamp, signature, body, secret })) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { type?: string; data?: { email_id?: string; to?: string[] | string } }
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = payload.type ?? ''
  const providerId = payload.data?.email_id
  if (!providerId) {
    return NextResponse.json({ received: true })
  }

  const supabase = getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Find the message
  const { data: msg } = await sb
    .from('activation_messages')
    .select('id, lead_id')
    .eq('provider_message_id', providerId)
    .single()

  if (!msg) {
    // Webhook for a message we don't know about — log and ignore
    console.warn('[resend-webhook] unknown provider_message_id', providerId)
    return NextResponse.json({ received: true })
  }

  // Append to email_events
  const dbEventType = EVENT_TYPE_MAP[eventType]
  if (dbEventType) {
    await sb.from('email_events').insert({
      message_id: msg.id,
      event_type: dbEventType,
      payload,
    })
  }

  // Update message status
  const newStatus = STATUS_MAP[eventType]
  if (newStatus) {
    await sb.from('activation_messages').update({ status: newStatus }).eq('id', msg.id)
  }

  // Update lead email_status on bounce/complaint
  if (eventType === 'email.bounced') {
    await sb.from('activation_leads').update({ email_status: 'bounced' }).eq('id', msg.lead_id)
  } else if (eventType === 'email.complained') {
    await sb.from('activation_leads').update({ email_status: 'unsubscribed' }).eq('id', msg.lead_id)
  }

  return NextResponse.json({ received: true })
}
