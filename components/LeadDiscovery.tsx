'use client'

import { useState } from 'react'
import type { DiscoveryResult, DiscoverySearchParams } from '@/types/discovery'
import DiscoverySearchForm from '@/components/discovery/DiscoverySearchForm'
import DiscoveredLeadCard from '@/components/discovery/DiscoveredLeadCard'

export default function LeadDiscovery() {
  const [isSearching, setIsSearching] = useState(false)
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [lastSearchParams, setLastSearchParams] = useState<DiscoverySearchParams | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPdfLoading, setIsPdfLoading] = useState(false)

  async function handleSearch(params: DiscoverySearchParams) {
    setIsSearching(true)
    setError(null)
    setResult(null)
    setSelectedIds(new Set())
    setLastSearchParams(params)

    try {
      const response = await fetch('/api/discover-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Server error: ${response.status}`)
      }

      const data: DiscoveryResult = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsSearching(false)
    }
  }

  function handleToggle(placeId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(placeId)) {
        next.delete(placeId)
      } else {
        next.add(placeId)
      }
      return next
    })
  }

  function handleSelectAll() {
    if (!result) return
    const allIds = result.leads.map((l) => l.placeId)
    const allSelected = allIds.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  function handleDownloadJSON() {
    if (!result) return
    const selectedLeads = result.leads.filter((l) => selectedIds.has(l.placeId))
    const blob = new Blob([JSON.stringify(selectedLeads, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${result.leads[0]?.location ?? 'results'}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleDownloadPDF() {
    if (!result) return
    setIsPdfLoading(true)

    const selectedLeads = result.leads.filter((l) => selectedIds.has(l.placeId))

    try {
      const response = await fetch('/api/discovery-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: selectedLeads,
          searchedAt: result.searchedAt,
          searchParams: lastSearchParams,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Server error: ${response.status}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `discovery-leads-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setIsPdfLoading(false)
    }
  }

  const allSelected =
    result !== null &&
    result.leads.length > 0 &&
    result.leads.every((l) => selectedIds.has(l.placeId))

  return (
    <div className="space-y-6">
      <DiscoverySearchForm onSearch={handleSearch} isLoading={isSearching} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{result.totalFound}</span>{' '}
              lead{result.totalFound !== 1 ? 's' : ''} found for &ldquo;{result.searchQuery}&rdquo;
            </p>
            <button
              onClick={handleSelectAll}
              className="text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="space-y-3">
            {result.leads.map((lead) => (
              <DiscoveredLeadCard
                key={lead.placeId}
                lead={lead}
                selected={selectedIds.has(lead.placeId)}
                onToggle={handleToggle}
              />
            ))}
          </div>

          {selectedIds.size > 0 && (
            <div className="sticky bottom-4 mt-6 bg-white border border-gray-200 rounded-xl shadow-lg p-4 flex gap-3">
              <button
                onClick={handleDownloadJSON}
                className="flex-1 bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
              >
                Download JSON ({selectedIds.size})
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={isPdfLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPdfLoading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Generating PDF...
                  </>
                ) : (
                  `Download PDF (${selectedIds.size})`
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {!result && !isSearching && (
        <div className="text-center text-gray-400 py-16">
          <p className="text-lg">Search for leads above to get started</p>
          <p className="text-sm mt-1">Enter a sector and location to find businesses near you</p>
        </div>
      )}
    </div>
  )
}
