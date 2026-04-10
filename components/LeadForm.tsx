'use client'

import { useState, useEffect, useCallback } from 'react'
import type { LeadData } from '@/types/lead'
import { calculateHeatScore } from '@/lib/heatScore'
import { getRecommendedProduct } from '@/lib/productMatch'
import LeadInfoSection from './sections/LeadInfoSection'
import DigitalPresenceSection from './sections/DigitalPresenceSection'
import HeatScoreSection from './sections/HeatScoreSection'
import ProductSection from './sections/ProductSection'
import NotesSection from './sections/NotesSection'

interface LeadFormProps {
  onSubmit: (data: LeadData) => Promise<void>
  isLoading: boolean
}

function buildInitialState(): LeadData {
  return {
    agentName: '',
    businessName: '',
    ownerName: '',
    phone: '',
    location: '',
    sector: 'spaza_food',
    source: 'google_maps',
    hasWebsite: false,
    hasGoogleProfile: false,
    facebookUrl: '',
    followerCount: null,
    lastPostDate: '',
    heatScore: 1,
    heatScoreOverridden: false,
    recommendedProduct: getRecommendedProduct('spaza_food'),
    notes: '',
    dateGenerated: '',
  }
}

export default function LeadForm({ onSubmit, isLoading }: LeadFormProps) {
  const [formData, setFormData] = useState<LeadData>(buildInitialState)
  const [productManuallyOverridden, setProductManuallyOverridden] = useState(false)

  // Load agentName from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('agentName')
      if (saved) {
        setFormData((prev) => ({ ...prev, agentName: saved }))
      }
    } catch {
      // localStorage not available (SSR / private browsing)
    }
  }, [])

  // Save agentName to localStorage whenever it changes
  useEffect(() => {
    try {
      if (formData.agentName) {
        localStorage.setItem('agentName', formData.agentName)
      } else {
        localStorage.removeItem('agentName')
      }
    } catch { /* ignore quota/security errors */ }
  }, [formData.agentName])

  // Auto-update heatScore whenever relevant fields change (unless overridden)
  useEffect(() => {
    if (!formData.heatScoreOverridden) {
      const score = calculateHeatScore(formData)
      setFormData((prev) => ({ ...prev, heatScore: score }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.hasWebsite,
    formData.hasGoogleProfile,
    formData.lastPostDate,
    formData.followerCount,
    formData.source,
    formData.sector,
    formData.heatScoreOverridden,
  ])

  // Auto-update recommendedProduct when sector changes (unless manually overridden)
  useEffect(() => {
    if (!productManuallyOverridden) {
      setFormData((prev) => ({
        ...prev,
        recommendedProduct: getRecommendedProduct(prev.sector),
      }))
    }
  }, [formData.sector, productManuallyOverridden])

  const handleChange = useCallback((fields: Partial<LeadData>) => {
    setFormData((prev) => {
      // Detect if the user is changing recommendedProduct directly
      if ('recommendedProduct' in fields) {
        setProductManuallyOverridden(true)
      }
      return { ...prev, ...fields }
    })
  }, [])

  const handleHeatOverrideToggle = useCallback((enabled: boolean) => {
    setFormData((prev) => {
      const autoScore = calculateHeatScore(prev)
      return {
        ...prev,
        heatScoreOverridden: enabled,
        // Seed heatScore from the auto score so enabling override never silently no-ops
        heatScore: autoScore,
      }
    })
  }, [])

  const handleHeatScoreChange = useCallback((score: number) => {
    setFormData((prev) => ({ ...prev, heatScore: score }))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalData: LeadData = {
      ...formData,
      dateGenerated: new Date().toISOString(),
    }
    await onSubmit(finalData)
  }

  const canSubmit = formData.businessName.trim().length > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Lead Info */}
      <LeadInfoSection data={formData} onChange={handleChange} />

      {/* Digital Presence */}
      <DigitalPresenceSection data={formData} onChange={handleChange} />

      {/* Two-column layout for Heat Score + Product on larger screens */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HeatScoreSection
          data={formData}
          overrideEnabled={formData.heatScoreOverridden}
          onOverrideToggle={handleHeatOverrideToggle}
          onScoreChange={handleHeatScoreChange}
        />
        <ProductSection data={formData} onChange={handleChange} />
      </div>

      {/* Notes */}
      <NotesSection
        value={formData.notes}
        onChange={(notes) => handleChange({ notes })}
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit || isLoading}
        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-xl w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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
            Generating PDF...
          </>
        ) : (
          'Generate & Download PDF'
        )}
      </button>
    </form>
  )
}
