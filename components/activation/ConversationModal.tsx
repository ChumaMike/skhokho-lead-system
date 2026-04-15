'use client'

import { useEffect, useRef } from 'react'
import type { ActivationLead, ActivationMessage } from '@/types/activation'

interface Props {
  lead: ActivationLead
  onClose: () => void
}

function dayLabel(msg: ActivationMessage): string {
  if (msg.direction === 'inbound') return 'Their reply'
  if (msg.sequenceDay === 1) return 'Day 1 — Opening message'
  if (msg.sequenceDay === 4) return 'Day 4 — Follow-up'
  if (msg.sequenceDay === 7) return 'Day 7 — Final message'
  return 'AI reply'
}

function statusBadge(msg: ActivationMessage) {
  if (msg.status === 'scheduled') {
    const when = msg.scheduledFor
      ? new Date(msg.scheduledFor).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'scheduled'
    return <span className="text-xs text-gray-400 ml-1">· sends {when}</span>
  }
  if (msg.status === 'cancelled') return <span className="text-xs text-gray-400 ml-1">· cancelled</span>
  if (msg.status === 'failed') return <span className="text-xs text-red-400 ml-1">· failed</span>
  return null
}

export default function ConversationModal({ lead, onClose }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lead.messages])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const sorted = [...(lead.messages ?? [])].sort((a, b) => {
    const ta = a.sentAt ?? a.scheduledFor ?? ''
    const tb = b.sentAt ?? b.scheduledFor ?? ''
    return ta.localeCompare(tb)
  })

  const whatsappUrl = `https://wa.me/${lead.phone.replace('+', '')}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-900">{lead.businessName}</div>
            <div className="text-xs text-gray-500 mt-0.5">{lead.phone} · {lead.location}</div>
            <div className="flex gap-2 mt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-full font-medium transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.524 5.849L.057 23.012a.5.5 0 0 0 .61.637l5.354-1.404A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.518-5.166-1.418l-.371-.217-3.838 1.007 1.03-3.75-.237-.386A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                WhatsApp
              </a>
              {lead.facebookPageUrl && (
                <a
                  href={lead.facebookPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-full font-medium transition-colors"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
                  Facebook
                </a>
              )}
              {lead.instagramUrl && (
                <a
                  href={lead.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-2.5 py-1 rounded-full font-medium transition-colors"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                  Instagram
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 ml-3 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {sorted.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-8">No messages yet</div>
          )}
          {sorted.map((msg) => {
            const isOutbound = msg.direction === 'outbound'
            const isCancelled = msg.status === 'cancelled'
            const isScheduled = msg.status === 'scheduled'

            return (
              <div key={msg.id} className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}>
                <div className="text-xs text-gray-400 mb-1">
                  {dayLabel(msg)}
                  {statusBadge(msg)}
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    isCancelled || isScheduled
                      ? 'bg-gray-100 text-gray-400 border border-dashed border-gray-200'
                      : isOutbound
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {msg.body}
                </div>
                {(msg.sentAt || msg.scheduledFor) && (
                  <div className="text-xs text-gray-400 mt-1">
                    {msg.sentAt
                      ? new Date(msg.sentAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : msg.scheduledFor
                      ? `Scheduled: ${new Date(msg.scheduledFor).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </div>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-400 text-center">
            {sorted.filter((m) => m.status === 'scheduled').length > 0
              ? `${sorted.filter((m) => m.status === 'scheduled').length} message(s) still scheduled · `
              : ''}
            To reply directly, use the WhatsApp button above
          </p>
        </div>
      </div>
    </div>
  )
}
