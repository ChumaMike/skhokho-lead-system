'use client'

import type { LeadData } from '@/types/lead'

interface DigitalPresenceSectionProps {
  data: Partial<LeadData>
  onChange: (fields: Partial<LeadData>) => void
}

const inputClass =
  'border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-500 text-sm'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
          value
            ? 'bg-green-600 text-white border-green-600'
            : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
          !value
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
        }`}
      >
        No
      </button>
    </div>
  )
}

export default function DigitalPresenceSection({ data, onChange }: DigitalPresenceSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        <span className="text-green-500 font-bold mr-2">02</span>Digital Presence
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Has Website */}
        <div>
          <p className={labelClass}>Has Website?</p>
          <YesNoToggle
            value={data.hasWebsite ?? false}
            onChange={(v) => onChange({ hasWebsite: v })}
          />
        </div>

        {/* Has Google Business Profile */}
        <div>
          <p className={labelClass}>Has Google Business Profile?</p>
          <YesNoToggle
            value={data.hasGoogleProfile ?? false}
            onChange={(v) => onChange({ hasGoogleProfile: v })}
          />
        </div>

        {/* Facebook URL */}
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="facebookUrl">
            Facebook URL <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="facebookUrl"
            type="text"
            className={inputClass}
            value={data.facebookUrl ?? ''}
            onChange={(e) => onChange({ facebookUrl: e.target.value })}
            placeholder="https://facebook.com/..."
          />
        </div>

        {/* Follower Count */}
        <div>
          <label className={labelClass} htmlFor="followerCount">
            Follower Count <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="followerCount"
            type="number"
            min={0}
            className={inputClass}
            value={data.followerCount ?? ''}
            onChange={(e) =>
              onChange({
                followerCount: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder="e.g. 350"
          />
        </div>

        {/* Last Post Date */}
        <div>
          <label className={labelClass} htmlFor="lastPostDate">
            Last Post Date <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="lastPostDate"
            type="date"
            className={inputClass}
            value={data.lastPostDate ?? ''}
            onChange={(e) => onChange({ lastPostDate: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
