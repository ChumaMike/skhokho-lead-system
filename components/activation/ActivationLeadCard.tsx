'use client'

import { PRODUCT_DETAILS } from '@/lib/productMatch'
import type { ActivationLead } from '@/types/activation'

interface Props {
  lead: ActivationLead
  onViewThread: (id: string) => void
  onTakeOver: (id: string) => void
  onMarkBooked: (id: string) => void
  onMarkDead: (id: string) => void
}

export default function ActivationLeadCard({ lead, onViewThread, onTakeOver, onMarkBooked, onMarkDead }: Props) {
  const lastMessage = lead.messages
    ?.filter((m) => m.status !== 'cancelled')
    .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))[0]

  const messageCount = (lead.messages ?? []).filter((m) => m.status !== 'cancelled').length

  const heatColors: Record<string, string> = {
    HOT: 'bg-red-100 text-red-700',
    WARM: 'bg-yellow-100 text-yellow-700',
    COLD: 'bg-blue-100 text-blue-600',
  }

  const productName = PRODUCT_DETAILS[lead.recommendedProduct]?.name ?? lead.recommendedProduct
  const setupFee = PRODUCT_DETAILS[lead.recommendedProduct]?.setupFee ?? ''

  return (
    <div
      className={`bg-white rounded-xl p-4 border ${
        lead.status === 'replied'
          ? 'border-amber-400 shadow-md'
          : 'border-gray-200'
      }`}
    >
      <div className="font-semibold text-sm text-gray-900">{lead.businessName}</div>
      <div className="text-xs text-gray-500 mt-0.5">{lead.phone} · {lead.location}</div>

      {/* Social links */}
      {(lead.facebookPageUrl || lead.instagramUrl) && (
        <div className="flex gap-1.5 mt-1.5">
          {lead.facebookPageUrl && (
            <a
              href={lead.facebookPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded-full font-medium transition-colors"
            >
              Facebook
            </a>
          )}
          {lead.instagramUrl && (
            <a
              href={lead.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-pink-50 text-pink-600 hover:bg-pink-100 px-2 py-0.5 rounded-full font-medium transition-colors"
            >
              Instagram
            </a>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${heatColors[lead.heatLevel]}`}>
          {lead.heatLevel} {lead.heatScore}
        </span>
        <span className="text-xs text-gray-400">{productName}</span>
      </div>

      {/* Last message preview — click to view full thread */}
      {lastMessage && (
        <button
          onClick={() => onViewThread(lead.id)}
          className="mt-2 w-full text-left bg-gray-50 hover:bg-gray-100 rounded-lg p-2 transition-colors group"
        >
          <div className="text-xs text-gray-600 italic line-clamp-2">
            &quot;{lastMessage.body.slice(0, 100)}{lastMessage.body.length > 100 ? '…' : ''}&quot;
          </div>
          <div className="text-xs text-green-600 group-hover:text-green-700 mt-1 font-medium">
            View thread ({messageCount} message{messageCount !== 1 ? 's' : ''}) →
          </div>
        </button>
      )}

      {/* No messages yet — still allow viewing (empty state in modal) */}
      {!lastMessage && (
        <button
          onClick={() => onViewThread(lead.id)}
          className="mt-2 w-full text-left text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          View thread →
        </button>
      )}

      {lead.status === 'replied' && (
        <div className="mt-3 space-y-1.5">
          <div className="text-xs font-semibold text-amber-600">
            🔔 Replied{lead.repliedAt ? ` · ${new Date(lead.repliedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
          <button
            onClick={() => onTakeOver(lead.id)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
          >
            Take Over Conversation
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => onMarkBooked(lead.id)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
            >
              Mark Booked
            </button>
            <button
              onClick={() => onMarkDead(lead.id)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold py-1.5 rounded-lg transition-colors"
            >
              Mark Dead
            </button>
          </div>
        </div>
      )}

      {lead.status === 'booked' && (
        <div className="mt-2 bg-green-50 rounded-lg p-2 text-center">
          <div className="text-base font-bold text-green-700">{setupFee}</div>
          <div className="text-xs text-green-600">setup fee expected</div>
        </div>
      )}
    </div>
  )
}
