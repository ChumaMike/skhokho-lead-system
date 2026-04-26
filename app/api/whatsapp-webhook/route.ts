import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { normalizePhone, generateConversationReply, sendWhatsApp } from '@/lib/activation'
import { fromDbRow, msgFromDbRow } from '@/types/activation'

// GET — Meta webhook verification handshake
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// POST — incoming WhatsApp messages + delivery/read status from Meta
export async function POST(request: Request) {
  const payload = await request.json() as Record<string, unknown>

  // Meta wraps everything in entry[].changes[].value
  const entry = (payload.entry as Array<Record<string, unknown>>)?.[0]
  const change = (entry?.changes as Array<Record<string, unknown>>)?.[0]
  const value = change?.value as Record<string, unknown> | undefined

  // ── Handle delivery/read status updates ──────────────────────────────────
  const statuses = value?.statuses as Array<Record<string, unknown>> | undefined
  if (statuses?.length) {
    const supabase = getSupabase()
    for (const s of statuses) {
      const wamid = s.id as string
      const status = s.status as string  // 'sent' | 'delivered' | 'read' | 'failed'
      if (!wamid || !['delivered', 'read', 'failed'].includes(status)) continue
      await (supabase as any)
        .from('activation_messages')
        .update({ status })
        .eq('provider_message_id', wamid)
    }
    return NextResponse.json({ received: true })
  }

  const messages = value?.messages as Array<Record<string, unknown>> | undefined
  const message = messages?.[0]

  // Only handle inbound text messages
  if (!message || message.type !== 'text') {
    return NextResponse.json({ received: true })
  }

  const from = message.from as string        // e.g. "27834567890" (no +)
  const body = (message.text as Record<string, string>)?.body ?? ''
  const phone = normalizePhone(`+${from}`)   // normalise to +27XXXXXXXXX

  const supabase = getSupabase()

  // Find the most recent active lead for this phone
  const { data: leadRow, error: findError } = await (supabase as any)
    .from('activation_leads')
    .select('*')
    .eq('phone', phone)
    .in('status', ['sent', 'queued'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (findError || !leadRow) {
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

  // AI conversation agent
  try {
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
      const replyWamid = await sendWhatsApp(lead.phone, reply)

      await (supabase as any).from('activation_messages').insert({
        lead_id: lead.id,
        direction: 'outbound',
        body: reply,
        sequence_day: null,
        status: 'sent',
        channel: 'whatsapp',
        sent_at: new Date().toISOString(),
        scheduled_for: null,
        provider_message_id: replyWamid,
      })

      if (lead.status === 'sent') {
        await (supabase as any)
          .from('activation_leads')
          .update({ status: 'replied', replied_at: new Date().toISOString() })
          .eq('id', lead.id)
      }
    }
  } catch (err) {
    console.error('[whatsapp-webhook] AI agent error, falling back to manual handoff:', err)

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
