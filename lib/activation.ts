import Anthropic from '@anthropic-ai/sdk'
import twilio from 'twilio'
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
- Day 1: warm opener, name the gap (no website, no bookings, etc.), specific product offer, soft CTA
- Day 4: social proof follow-up, SA business example, ask for a call
- Day 7: low-pressure final message, leave door open
- Each message under 150 words
- Max one emoji per message
- SA-local greetings (Sawubona, Howzit, Sho) where natural
- Never pushy — ask permission, not demand

Return ONLY a valid JSON object with keys "day1", "day4", "day7". No markdown, no explanation.`
}

const SYSTEM_PROMPT = `You are a friendly sales agent for Skhokho Labs, South Africa's leading AI automation studio for small businesses. You write WhatsApp messages that are warm, conversational, and SA-local. You never use corporate jargon. You always write as if texting a friend who runs a business.`

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

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  return JSON.parse(text) as { day1: string; day4: string; day7: string }
}

/**
 * Sends a WhatsApp message via Twilio.
 * Returns the Twilio message SID.
 */
export async function sendWhatsApp(toE164: string, body: string): Promise<string> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  const message = await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM!,
    to: `whatsapp:${toE164}`,
    body,
  })
  return message.sid
}
