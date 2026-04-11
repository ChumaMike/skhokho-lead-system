'use client'

import { useState, useEffect } from 'react'
import type { DiscoverySearchParams } from '@/types/discovery'
import type { Sector } from '@/types/lead'
import { SECTOR_LABELS } from '@/lib/productMatch'

interface DiscoverySearchFormProps {
  onSearch: (params: DiscoverySearchParams, agentName: string) => void
  isLoading: boolean
}

export default function DiscoverySearchForm({ onSearch, isLoading }: DiscoverySearchFormProps) {
  const [sector, setSector] = useState<Sector>('spaza_food')
  const [location, setLocation] = useState('')
  const [radius, setRadius] = useState(5000)
  const [maxResults, setMaxResults] = useState(10)
  const [agentName, setAgentName] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('agentName')
      if (saved) setAgentName(saved)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      if (agentName) localStorage.setItem('agentName', agentName)
      else localStorage.removeItem('agentName')
    } catch { /* ignore */ }
  }, [agentName])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSearch({ sector, location, radius, maxResults }, agentName)
  }

  const canSearch = location.trim().length > 0 && !isLoading

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-5">Find Leads</h2>
      <form onSubmit={handleSubmit}>
        {/* Agent name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Name <span className="text-gray-400 font-normal">(optional — appears on PDF)</span>
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="e.g. Thabo Nkosi"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-5">
          {/* Sector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sector
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value as Sector)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {(Object.entries(SECTOR_LABELS) as [Sector, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Soweto, Johannesburg"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Radius
            </label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value={1000}>1 km</option>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
              <option value={25000}>25 km</option>
              <option value={50000}>50 km</option>
            </select>
          </div>

          {/* Max Results */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Results
            </label>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSearch}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
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
              Searching...
            </>
          ) : (
            'Find Leads'
          )}
        </button>
      </form>
    </div>
  )
}
