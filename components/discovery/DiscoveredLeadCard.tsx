'use client'

import { useState } from 'react'
import type { DiscoveredLead } from '@/types/discovery'
import { PRODUCT_DETAILS, getAllProductsWithOffer } from '@/lib/productMatch'

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
  const [expanded, setExpanded] = useState(false)
  const productName = PRODUCT_DETAILS[lead.recommendedProduct]?.name ?? lead.recommendedProduct
  const allOffers = getAllProductsWithOffer(lead)
  const sortedOffers = [...allOffers].sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0))

  return (
    <div
      className={`bg-white rounded-xl transition-colors ${
        selected ? 'border-2 border-green-500' : 'border border-gray-200'
      }`}
    >
      {/* Clickable compact row */}
      <div
        className="p-4 flex gap-3 cursor-pointer"
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

          {/* Row 3: Website chip + recommended product */}
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
            <span className="text-xs text-gray-500">
              Recommended: <span className="font-medium text-gray-700">{productName}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Expand toggle */}
      <div className="px-4 pb-3 -mt-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
          className="text-xs text-green-700 font-medium hover:text-green-800 flex items-center gap-1 transition-colors"
        >
          {expanded ? (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              Hide details
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              View all products &amp; digital audit
            </>
          )}
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-5">
          {/* Section A: Digital Audit */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Digital Audit</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-semibold ${lead.hasWebsite ? 'text-green-700' : 'text-gray-400'}`}>
                  {lead.hasWebsite ? '✓' : '✗'} Website
                </span>
                {lead.hasWebsite && lead.websiteUrl ? (
                  <a
                    href={lead.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-green-700 hover:underline truncate max-w-[200px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lead.websiteUrl}
                  </a>
                ) : !lead.hasWebsite ? (
                  <span className="text-gray-400">Not found</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-green-700">✓ Google Profile</span>
                <span className="text-gray-500">Listed</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-gray-400">— Facebook</span>
                <span className="text-gray-400">Not checked</span>
              </div>
            </div>
          </div>

          {/* Section B: All Products */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">All Products We Can Build</p>
            <div className="space-y-2">
              {sortedOffers.map((offer) => (
                <div
                  key={offer.product}
                  className={`rounded-lg p-3 border ${
                    offer.isRecommended
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      {offer.isRecommended && (
                        <span className="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                          ★ RECOMMENDED
                        </span>
                      )}
                      <span className="text-sm font-semibold text-gray-900">{offer.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                      {offer.setupFee} setup · {offer.monthly}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 italic mb-1">{offer.pitch}</p>
                  <p className="text-xs text-gray-700">
                    <span className="font-medium">Why it fits: </span>{offer.whyItFits}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
