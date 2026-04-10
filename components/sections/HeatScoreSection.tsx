'use client'

import { useState } from 'react'
import type { LeadData } from '@/types/lead'
import { calculateHeatScore, getHeatLevel } from '@/lib/heatScore'

interface HeatScoreSectionProps {
  data: Partial<LeadData>
  onOverride: (score: number) => void
}

function ScoreBreakdown({ data }: { data: Partial<LeadData> }) {
  const factors: { label: string; active: boolean; points: number }[] = [
    {
      label: 'No website',
      active: data.hasWebsite === false,
      points: 3,
    },
    {
      label: 'No Google Business Profile',
      active: data.hasGoogleProfile === false,
      points: 2,
    },
    {
      label: 'High-value sector',
      active:
        data.sector === 'spaza_food' ||
        data.sector === 'salon_hair' ||
        data.sector === 'auto_mechanic' ||
        data.sector === 'clinic_medical',
      points: 2,
    },
    {
      label: 'Source is Google Maps or Walk-in',
      active: data.source === 'google_maps' || data.source === 'walk_in',
      points: 1,
    },
    {
      label: 'Facebook active (post within 30 days)',
      active: (() => {
        if (!data.lastPostDate) return false
        const d = new Date(data.lastPostDate)
        if (isNaN(d.getTime())) return false
        return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) <= 30
      })(),
      points: 1,
    },
    {
      label: 'Followers > 100',
      active: data.followerCount != null && data.followerCount > 100,
      points: 1,
    },
  ]

  return (
    <ul className="mt-3 space-y-1 text-sm">
      {factors.map((f) => (
        <li key={f.label} className={`flex items-center gap-2 ${f.active ? 'text-gray-800' : 'text-gray-400'}`}>
          <span className={`inline-block w-4 h-4 rounded-full flex-shrink-0 ${f.active ? 'bg-green-500' : 'bg-gray-200'}`} />
          <span>{f.label}</span>
          {f.active && (
            <span className="ml-auto font-medium text-green-600">+{f.points}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export default function HeatScoreSection({ data, onOverride }: HeatScoreSectionProps) {
  const [overrideEnabled, setOverrideEnabled] = useState(false)
  const [overrideValue, setOverrideValue] = useState<number>(5)

  // Cast to full LeadData for the score calculation — missing fields default gracefully
  const fullData = {
    hasWebsite: false,
    hasGoogleProfile: false,
    lastPostDate: '',
    followerCount: null,
    source: 'google_maps',
    sector: 'spaza_food',
    ...data,
  } as LeadData

  const calculatedScore = calculateHeatScore(fullData)
  const displayScore = overrideEnabled ? overrideValue : calculatedScore
  const level = getHeatLevel(displayScore)

  const badgeColors: Record<string, string> = {
    HOT: 'bg-red-500 text-white',
    WARM: 'bg-amber-400 text-white',
    COLD: 'bg-blue-500 text-white',
  }

  function handleOverrideToggle() {
    const next = !overrideEnabled
    setOverrideEnabled(next)
    if (next) {
      onOverride(overrideValue)
    } else {
      onOverride(calculatedScore)
    }
  }

  function handleOverrideChange(val: number) {
    const clamped = Math.min(10, Math.max(1, val))
    setOverrideValue(clamped)
    onOverride(clamped)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Heat Score</h2>
        <button
          type="button"
          onClick={handleOverrideToggle}
          className={`text-sm px-3 py-1 rounded-full border transition-colors ${
            overrideEnabled
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
          }`}
        >
          {overrideEnabled ? 'Override ON' : 'Override OFF'}
        </button>
      </div>

      {/* Score Badge */}
      <div className="flex items-center gap-4 mb-4">
        <span
          className={`text-4xl font-bold w-16 h-16 rounded-full flex items-center justify-center ${badgeColors[level]}`}
        >
          {displayScore}
        </span>
        <div>
          <p className="text-2xl font-bold text-gray-900">{level}</p>
          <p className="text-sm text-gray-500">out of 10</p>
        </div>
      </div>

      {/* Override input */}
      {overrideEnabled && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Manual Score (1–10)
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={overrideValue}
            onChange={(e) => handleOverrideChange(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
      )}

      {/* Breakdown */}
      <div>
        <p className="text-sm font-medium text-gray-700">Score breakdown:</p>
        <ScoreBreakdown data={data} />
      </div>
    </div>
  )
}
