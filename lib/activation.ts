import Anthropic from '@anthropic-ai/sdk'
import type { ActivationLeadInput } from '@/types/activation'

/**
 * Normalizes a South African phone number to E.164 format (+27XXXXXXXXX).
 * Handles: "083 456 7890", "+27 83 456 7890", "27834567890", "+27834567890"
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('27') && digits.length === 11) {
    return `+${digits}`
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+27${digits.slice(1)}`
  }
  // Fallback: prefix + if not already there
  return phone.startsWith('+') ? `+${digits}` : `+${digits}`
}

/**
 * Builds the Claude prompt for generating 3 WhatsApp messages.
 * Exported for testing without making real API calls.
 */
export function buildMessagePrompt(
  lead: ActivationLeadInput,
  productPitch: string,
  whyItFits: string,
): string {
  return `Write a 3-message WhatsApp outreach sequence for this lead:

Business: ${lead.businessName}
Owner: ${lead.ownerName ?? 'Business Owner'}
Sector: ${lead.sector}
Location: ${lead.location}
Has Website: ${lead.hasWebsite ?? false}
Recommended Product: ${lead.recommendedProduct}
Product Pitch: ${productPitch}
Why It Fits: ${whyItFits}
Agent Name: ${lead.agentName}
Heat Level: ${lead.heatLevel}

Rules:
- Day 1: warm opener, name the gap (no website, no bookings, etc.), specific product offer, mention skhokholabs.xyz, soft CTA
- Day 4: social proof follow-up, SA business example, ask for a call
- Day 7: low-pressure final message, reference skhokholabs.xyz, leave door open
- Each message under 150 words
- Max one emoji per message
- SA-local greetings (Sawubona, Howzit, Sho) where natural
- Never pushy — ask permission, not demand

Return ONLY a valid JSON object with keys "day1", "day4", "day7". No markdown, no explanation.`
}

/** Strips markdown code fences from Claude output before JSON.parse */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

const SYSTEM_PROMPT = `You are a friendly sales agent for Skhokho Labs (skhokholabs.xyz), South Africa's leading AI automation studio for small businesses. You write WhatsApp messages that are warm, conversational, and SA-local. You never use corporate jargon. You always write as if texting a friend who runs a business.`

/**
 * Calls Claude Haiku to generate a 3-message WhatsApp sequence.
 * Returns { day1, day4, day7 }.
 */
export async function generateMessages(
  lead: ActivationLeadInput,
  productPitch: string,
  whyItFits: string,
): Promise<{ day1: string; day4: string; day7: string }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildMessagePrompt(lead, productPitch, whyItFits),
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  const parsed = JSON.parse(stripCodeFences(raw)) as { day1?: string; day4?: string; day7?: string }
  if (
    typeof parsed.day1 !== 'string' || parsed.day1.trim() === '' ||
    typeof parsed.day4 !== 'string' || parsed.day4.trim() === '' ||
    typeof parsed.day7 !== 'string' || parsed.day7.trim() === ''
  ) {
    throw new Error(
      `generateMessages: Claude returned an invalid response — expected non-empty "day1", "day4", and "day7" string keys. Got: ${JSON.stringify(parsed)}`
    )
  }
  return parsed as { day1: string; day4: string; day7: string }
}

/**
 * Generates an AI reply for an ongoing WhatsApp conversation with a lead.
 * Returns the reply text and a conversation outcome signal.
 */
export async function generateConversationReply(
  lead: {
    businessName: string
    ownerName: string | null
    sector: string
    recommendedProduct: string
    heatLevel: string
    agentName: string
  },
  conversationHistory: Array<{ direction: 'inbound' | 'outbound'; body: string }>,
): Promise<{ reply: string; outcome: 'continue' | 'qualified' | 'dead' }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const historyText = conversationHistory
    .map((m) => `[${m.direction === 'outbound' ? lead.agentName : lead.businessName}]: ${m.body}`)
    .join('\n')

  const prompt = `You are ${lead.agentName}, a friendly sales agent for Skhokho Labs — South Africa's leading AI automation studio for small businesses. Skhokho Labs offers 6 products: AI Receptionist, Smart Booking System, WhatsApp Chatbot, Social Media Automator, Invoice & Quote Assistant, and Lead Nurture Bot.

You are chatting on WhatsApp with the owner of ${lead.businessName} (${lead.sector} sector). They are a ${lead.heatLevel}-heat lead interested in the ${lead.recommendedProduct}. Write in a warm, SA-local WhatsApp tone — conversational, like texting a friend. Use SA greetings (Sawubona, Howzit, Sho) where natural. Keep it under 100 words. Never be pushy.

Conversation so far:
${historyText}

Now reply as ${lead.agentName}. Also decide the outcome:
- "qualified" — the lead has agreed to a demo, call, or meeting
- "dead" — the lead has clearly declined, asked to stop, or gone cold
- "continue" — conversation is still in progress

Return ONLY a valid JSON object: { "reply": "...", "outcome": "continue" | "qualified" | "dead" }. No markdown, no explanation.`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  const parsed = JSON.parse(stripCodeFences(raw)) as { reply?: string; outcome?: string }

  if (typeof parsed.reply !== 'string' || parsed.reply.trim() === '') {
    throw new Error(`generateConversationReply: invalid reply in response: ${JSON.stringify(parsed)}`)
  }
  const outcome = parsed.outcome === 'qualified' || parsed.outcome === 'dead' ? parsed.outcome : 'continue'
  return { reply: parsed.reply.trim(), outcome }
}

/**
 * Sends a WhatsApp message via Meta Cloud API.
 * Returns the Meta message ID (wamid).
 */
export async function sendWhatsApp(toE164: string, body: string): Promise<string> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN!
  // Meta expects E.164 without the leading +
  const to = toE164.replace(/^\+/, '')

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta WhatsApp API error: ${JSON.stringify(err)}`)
  }

  const data = await res.json() as { messages?: Array<{ id: string }> }
  return data.messages?.[0]?.id ?? 'unknown'
}
