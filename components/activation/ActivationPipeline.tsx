'use client'

import { useState, useEffect, useCallback } from 'react'
import ActivationLeadCard from './ActivationLeadCard'
import ActivationToolbar from './ActivationToolbar'
import type { ActivationLead } from '@/types/activation'
import type { Sector } from '@/types/lead'

const COLUMNS: { key: ActivationLead['status']; label: string; color: string }[] = [
  { key: 'queued', label: 'Queue', color: 'text-gray-500' },
  { key: 'sent', label: 'Sent', color: 'text-blue-600' },
  { key: 'replied', label: '⚡ Replied', color: 'text-amber-600' },
  { key: 'booked', label: '✓ Booked', color: 'text-green-600' },
]

export default function ActivationPipeline() {
  const [leads, setLeads] = useState<ActivationLead[]>([])
  const [sectorFilter, setSectorFilter] = useState<Sector | 'all'>('all')
  const [isActivating, setIsActivating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchLeads = useCallback(async () => {
    const res = await fetch('/api/activation-queue')
    if (res.ok) {
      const data = await res.json()
      setLeads(data)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchLeads()
    const interval = setInterval(fetchLeads, 15000)
    return () => clearInterval(interval)
  }, [fetchLeads])

  const filtered = sectorFilter === 'all'
    ? leads
    : leads.filter((l) => l.sector === sectorFilter)

  const updateLeadStatus = async (id: string, status: 'booked' | 'dead') => {
    await fetch(`/api/activation-leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchLeads()
  }

  const handleTakeOver = (id: string) => {
    const lead = leads.find((l) => l.id === id)
    if (lead) {
      window.open(`https://wa.me/${lead.phone.replace('+', '')}`, '_blank')
    }
  }

  const handleActivateAllQueued = async () => {
    const queued = leads.filter((l) => l.status === 'queued')
    if (queued.length === 0) return
    setIsActivating(true)
    try {
      await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          queued.map((l) => ({
            businessName: l.businessName,
            ownerName: l.ownerName,
            phone: l.phone,
            sector: l.sector,
            recommendedProduct: l.recommendedProduct,
            heatScore: l.heatScore,
            heatLevel: l.heatLevel,
            location: l.location,
            agentName: l.agentName,
            sourceType: l.sourceType,
            hasWebsite: l.hasWebsite,
            googleMapsUrl: l.googleMapsUrl,
          })),
        ),
      })
    } finally {
      setIsActivating(false)
      fetchLeads()
    }
  }

  const repliedCount = leads.filter((l) => l.status === 'replied').length
  const queuedCount = leads.filter((l) => l.status === 'queued').length

  return (
    <div className="flex flex-col h-full">
      <ActivationToolbar
        totalLeads={leads.length}
        repliedCount={repliedCount}
        queuedCount={queuedCount}
        sectorFilter={sectorFilter}
        onSectorFilterChange={setSectorFilter}
        onActivateAllQueued={handleActivateAllQueued}
        isActivating={isActivating}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Loading pipeline…
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-4 gap-px bg-gray-200 overflow-auto">
          {COLUMNS.map(({ key, label, color }) => {
            const columnLeads = filtered.filter((l) => l.status === key)
            return (
              <div
                key={key}
                className={`p-3 min-h-96 ${
                  key === 'replied' ? 'bg-amber-50' : key === 'booked' ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <div className={`text-xs font-bold uppercase tracking-wider mb-3 ${color}`}>
                  {label} · {columnLeads.length}
                </div>
                <div className="space-y-2">
                  {columnLeads.map((lead) => (
                    <ActivationLeadCard
                      key={lead.id}
                      lead={lead}
                      onTakeOver={handleTakeOver}
                      onMarkBooked={(id) => updateLeadStatus(id, 'booked')}
                      onMarkDead={(id) => updateLeadStatus(id, 'dead')}
                    />
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-4">Empty</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
