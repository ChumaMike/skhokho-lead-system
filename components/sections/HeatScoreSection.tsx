'use client'

import type { LeadData } from '@/types/lead'
import { calculateHeatScore, getHeatLevel, getScoreBreakdown } from '@/lib/heatScore'

interface HeatScoreSectionProps {
  data: Partial<LeadData>
  overrideEnabled: boolean
  onOverrideToggle: (enabled: boolean) => void
  onScoreChange: (score: number) => void
}

function ScoreBreakdown({ data }: { data: Partial<LeadData> }) {
  const fullData = {
    hasWebsite: false,
    hasGoogleProfile: false,
    lastPostDate: '',
    followerCount: null,
    source: 'google_maps',
    sector: 'spaza_food',
    ...data,
  } as LeadData

  const factors = getScoreBreakdown(fullData)

  return (
    <ul className="mt-3 space-y-1 text-sm">
      {factors.map((f) => (
        <li key={f.label} className={`flex items-center gap-2 ${f.earned ? 'text-gray-800' : 'text-gray-400'}`}>
          <span className={`inline-block w-4 h-4 rounded-full flex-shrink-0 ${f.earned ? 'bg-green-500' : 'bg-gray-200'}`} />
          <span>{f.label}</span>
          {f.earned && (
            <span className="ml-auto font-medium text-green-600">+{f.points}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export default function HeatScoreSection({
  data,
  overrideEnabled,
  onOverrideToggle,
  onScoreChange,
}: HeatScoreSectionProps) {
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
  const displayScore = overrideEnabled ? (data.heatScore ?? calculatedScore) : calculatedScore
  const level = getHeatLevel(displayScore)

  const badgeColors: Record<string, string> = {
    HOT: 'bg-red-500 text-white',
    WARM: 'bg-amber-400 text-white',
    COLD: 'bg-blue-500 text-white',
  }

  function handleOverrideToggle() {
    onOverrideToggle(!overrideEnabled)
  }

  function handleOverrideChange(val: number) {
    const clamped = Math.min(10, Math.max(1, val))
    onScoreChange(clamped)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          <span className="text-green-500 font-bold mr-2">03</span>Heat Score
        </h2>
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
            value={data.heatScore ?? calculatedScore}
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
