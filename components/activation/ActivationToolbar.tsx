'use client'

import { SECTOR_LABELS } from '@/lib/productMatch'
import type { Sector } from '@/types/lead'

interface Props {
  totalLeads: number
  repliedCount: number
  queuedCount: number
  sectorFilter: Sector | 'all'
  onSectorFilterChange: (sector: Sector | 'all') => void
  onActivateAllQueued: () => void
  onAddLead: () => void
  isActivating: boolean
}

export default function ActivationToolbar({
  totalLeads,
  repliedCount,
  queuedCount,
  sectorFilter,
  onSectorFilterChange,
  onActivateAllQueued,
  onAddLead,
  isActivating,
}: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <div className="text-sm text-gray-500">
        {totalLeads} leads
        {repliedCount > 0 && (
          <span className="ml-2 text-amber-600 font-semibold">
            · {repliedCount} need{repliedCount === 1 ? 's' : ''} attention
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={sectorFilter}
          onChange={(e) => onSectorFilterChange(e.target.value as Sector | 'all')}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
        >
          <option value="all">All sectors</option>
          {(Object.keys(SECTOR_LABELS) as Sector[]).map((s) => (
            <option key={s} value={s}>
              {SECTOR_LABELS[s]}
            </option>
          ))}
        </select>

        <button
          onClick={onAddLead}
          className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          + Add Lead
        </button>

        <button
          onClick={onActivateAllQueued}
          disabled={isActivating || queuedCount === 0}
          className="bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
        >
          {isActivating ? 'Activating…' : `⚡ Activate All Queued (${queuedCount})`}
        </button>
      </div>
    </div>
  )
}
