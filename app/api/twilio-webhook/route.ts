import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { getSupabase } from '@/lib/supabase'
import { normalizePhone, generateConversationReply, sendWhatsApp } from '@/lib/activation'
import { fromDbRow, msgFromDbRow } from '@/types/activation'

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
  const { data: leadRow, error: findError } = await (supabase as any)
    .from('activation_leads')
    .select('*')
    .eq('phone', phone)
    .in('status', ['sent', 'queued'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (findError || !leadRow) {
    // No matching active lead — ignore
    return NextResponse.json({ received: true })
  }

  const lead = fromDbRow(leadRow as Record<string, unknown>)

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

  // AI conversation agent: fetch history, generate reply, act on outcome
  try {
    // Fetch full conversation history (non-cancelled), ordered oldest first
    const { data: msgRows } = await (supabase as any)
      .from('activation_messages')
      .select('*')
      .eq('lead_id', lead.id)
      .neq('status', 'cancelled')
      .order('sent_at', { ascending: true })

    const history = ((msgRows ?? []) as Record<string, unknown>[]).map((r) => {
      const m = msgFromDbRow(r)
      return { direction: m.direction, body: m.body }
    })

    const { reply, outcome } = await generateConversationReply(
      {
        businessName: lead.businessName,
        ownerName: lead.ownerName,
        sector: lead.sector,
        recommendedProduct: lead.recommendedProduct,
        heatLevel: lead.heatLevel,
        agentName: lead.agentName,
      },
      history,
    )

    if (outcome === 'qualified') {
      // Agent needs to take over — mark replied, cancel scheduled messages, no AI reply
      await (supabase as any)
        .from('activation_messages')
        .update({ status: 'cancelled' })
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled')

      await (supabase as any)
        .from('activation_leads')
        .update({ status: 'replied', replied_at: new Date().toISOString() })
        .eq('id', lead.id)
    } else if (outcome === 'dead') {
      // Lead is dead — cancel scheduled messages, mark dead, no reply
      await (supabase as any)
        .from('activation_messages')
        .update({ status: 'cancelled' })
        .eq('lead_id', lead.id)
        .eq('status', 'scheduled')

      await (supabase as any)
        .from('activation_leads')
        .update({ status: 'dead' })
        .eq('id', lead.id)
    } else {
      // outcome === 'continue' — send AI reply
      await sendWhatsApp(lead.phone, reply)

      await (supabase as any).from('activation_messages').insert({
        lead_id: lead.id,
        direction: 'outbound',
        body: reply,
        sequence_day: null,
        status: 'sent',
        channel: 'whatsapp',
        sent_at: new Date().toISOString(),
        scheduled_for: null,
      })

      // If lead was in 'sent' state, bump to 'replied' so it's visible in the dashboard
      if (lead.status === 'sent') {
        await (supabase as any)
          .from('activation_leads')
          .update({ status: 'replied', replied_at: new Date().toISOString() })
          .eq('id', lead.id)
      }
    }
  } catch (err) {
    // Fallback: original behavior — cancel scheduled messages, mark replied, let agent take over
    console.error('[twilio-webhook] AI agent error, falling back to manual handoff:', err)

    await (supabase as any)
      .from('activation_messages')
      .update({ status: 'cancelled' })
      .eq('lead_id', lead.id)
      .eq('status', 'scheduled')

    await (supabase as any)
      .from('activation_leads')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('id', lead.id)
  }

  return NextResponse.json({ received: true })
}
