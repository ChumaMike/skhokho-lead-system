'use client'

import type { LeadData, Sector, Source } from '@/types/lead'
import { SECTOR_LABELS, SOURCE_LABELS } from '@/lib/productMatch'

interface LeadInfoSectionProps {
  data: Partial<LeadData>
  onChange: (fields: Partial<LeadData>) => void
}

const inputClass =
  'border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-500 text-sm'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

export default function LeadInfoSection({ data, onChange }: LeadInfoSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Lead Information</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Agent Name */}
        <div>
          <label className={labelClass} htmlFor="agentName">
            Agent Name
          </label>
          <input
            id="agentName"
            type="text"
            className={inputClass}
            value={data.agentName ?? ''}
            onChange={(e) => onChange({ agentName: e.target.value })}
            placeholder="Your name"
          />
        </div>

        {/* Business Name */}
        <div>
          <label className={labelClass} htmlFor="businessName">
            Business Name <span className="text-red-500">*</span>
          </label>
          <input
            id="businessName"
            type="text"
            className={inputClass}
            value={data.businessName ?? ''}
            onChange={(e) => onChange({ businessName: e.target.value })}
            placeholder="Business name"
            required
          />
        </div>

        {/* Owner Name */}
        <div>
          <label className={labelClass} htmlFor="ownerName">
            Owner Name
          </label>
          <input
            id="ownerName"
            type="text"
            className={inputClass}
            value={data.ownerName ?? ''}
            onChange={(e) => onChange({ ownerName: e.target.value })}
            placeholder="Owner's name"
          />
        </div>

        {/* Phone Number */}
        <div>
          <label className={labelClass} htmlFor="phone">
            Phone Number
          </label>
          <input
            id="phone"
            type="text"
            className={inputClass}
            value={data.phone ?? ''}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+27 ..."
          />
        </div>

        {/* Location */}
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="location">
            Location
          </label>
          <input
            id="location"
            type="text"
            className={inputClass}
            value={data.location ?? ''}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="Area / City e.g. Soweto, JHB"
          />
        </div>

        {/* Sector */}
        <div>
          <label className={labelClass} htmlFor="sector">
            Sector
          </label>
          <select
            id="sector"
            className={inputClass}
            value={data.sector ?? 'spaza_food'}
            onChange={(e) => onChange({ sector: e.target.value as Sector })}
          >
            {(Object.entries(SECTOR_LABELS) as [Sector, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Discovery Source */}
        <div>
          <label className={labelClass} htmlFor="source">
            Discovery Source
          </label>
          <select
            id="source"
            className={inputClass}
            value={data.source ?? 'google_maps'}
            onChange={(e) => onChange({ source: e.target.value as Source })}
          >
            {(Object.entries(SOURCE_LABELS) as [Source, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
