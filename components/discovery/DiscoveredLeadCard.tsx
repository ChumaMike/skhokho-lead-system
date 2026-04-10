'use client'

import type { DiscoveredLead } from '@/types/discovery'
import { PRODUCT_DETAILS } from '@/lib/productMatch'

interface DiscoveredLeadCardProps {
  lead: DiscoveredLead
  selected: boolean
  onToggle: (placeId: string) => void
}

const HEAT_BADGE: Record<DiscoveredLead['heatLevel'], string> = {
  HOT: 'bg-red-100 text-red-700',
  WARM: 'bg-amber-100 text-amber-700',
  COLD: 'bg-blue-100 text-blue-700',
}

export default function DiscoveredLeadCard({ lead, selected, onToggle }: DiscoveredLeadCardProps) {
  const productName = PRODUCT_DETAILS[lead.recommendedProduct]?.name ?? lead.recommendedProduct

  return (
    <div
      className={`bg-white rounded-xl p-4 flex gap-3 cursor-pointer transition-colors ${
        selected ? 'border-2 border-green-500' : 'border border-gray-200'
      }`}
      onClick={() => onToggle(lead.placeId)}
    >
      {/* Checkbox */}
      <div className="pt-0.5 flex-shrink-0">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            selected ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'
          }`}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Business name + heat badge */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="font-semibold text-gray-900 text-sm leading-snug">
            {lead.googleMapsUrl ? (
              <a
                href={lead.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green-700 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {lead.businessName}
              </a>
            ) : (
              lead.businessName
            )}
          </div>
          <span
            className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${HEAT_BADGE[lead.heatLevel]}`}
          >
            {lead.heatLevel}
          </span>
        </div>

        {/* Row 2: Phone + address */}
        <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mb-1.5">
          <span>
            {lead.phone ? (
              <>&#128222; {lead.phone}</>
            ) : (
              <span className="text-gray-400">Phone not listed</span>
            )}
          </span>
          {lead.address && (
            <span>&#128205; {lead.address}</span>
          )}
        </div>

        {/* Row 3: Website chip */}
        <div className="flex flex-wrap items-center gap-2">
          {lead.hasWebsite ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              &#127760; Has website
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              No website
            </span>
          )}

          {/* Row 4: Recommended product */}
          <span className="text-xs text-gray-500">
            Recommended: <span className="font-medium text-gray-700">{productName}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
