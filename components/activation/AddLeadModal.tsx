'use client'

import { useState, useEffect } from 'react'
import type { Sector, Product, HeatLevel } from '@/types/lead'
import { SECTOR_LABELS, PRODUCT_DETAILS, getRecommendedProduct } from '@/lib/productMatch'

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function AddLeadModal({ onClose, onAdded }: Props) {
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [sector, setSector] = useState<Sector>('salon_hair')
  const [location, setLocation] = useState('')
  const [agentName, setAgentName] = useState('')
  const [heatScore, setHeatScore] = useState(6)
  const [recommendedProduct, setRecommendedProduct] = useState<Product>('pro_website_bookings')
  const [hasWebsite, setHasWebsite] = useState(false)
  const [facebookPageUrl, setFacebookPageUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Auto-set recommended product when sector changes
  useEffect(() => {
    setRecommendedProduct(getRecommendedProduct(sector))
  }, [sector])

  // Pre-fill agent name from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('agentName')
      if (saved) setAgentName(saved)
    } catch { /* ignore */ }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const heatLevel: HeatLevel = heatScore >= 8 ? 'HOT' : heatScore >= 5 ? 'WARM' : 'COLD'

  const heatColor = heatScore >= 8
    ? 'text-red-600 bg-red-50 border-red-200'
    : heatScore >= 5
    ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
    : 'text-blue-600 bg-blue-50 border-blue-200'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          businessName: businessName.trim(),
          ownerName: ownerName.trim() || undefined,
          phone: phone.trim(),
          sector,
          recommendedProduct,
          heatScore,
          heatLevel,
          location: location.trim(),
          agentName: agentName.trim(),
          sourceType: 'entered' as const,
          hasWebsite,
          facebookPageUrl: facebookPageUrl.trim() || undefined,
          instagramUrl: instagramUrl.trim() || undefined,
        }]),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Server error ${res.status}`)
      }
      if (data.activated === 0) {
        throw new Error(data.failed > 0
          ? 'Lead could not be activated — phone may not be a WhatsApp-capable SA mobile number (06x/07x/08x)'
          : 'No leads were activated')
      }
      setSuccess(true)
      setTimeout(() => {
        onAdded()
        onClose()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = businessName.trim() && phone.trim() && location.trim() && agentName.trim() && !isSubmitting

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Add & Activate Lead</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Business + Owner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Business Name *</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Mama T's Salon"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Owner Name</label>
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone * <span className="font-normal text-gray-400">(SA mobile)</span></label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="083 456 7890"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Sector + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sector *</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value as Sector)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {(Object.entries(SECTOR_LABELS) as [Sector, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location *</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Soweto"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Agent + Product */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Your Name *</label>
              <input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. Thabo"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Recommended Product</label>
              <select
                value={recommendedProduct}
                onChange={(e) => setRecommendedProduct(e.target.value as Product)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {(Object.entries(PRODUCT_DETAILS) as [Product, { name: string }][]).map(([v, p]) => (
                  <option key={v} value={v}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Heat score */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Heat Score</label>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${heatColor}`}>
                {heatLevel} · {heatScore}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={heatScore}
              onChange={(e) => setHeatScore(Number(e.target.value))}
              className="w-full accent-green-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>1 — Cold</span>
              <span>10 — Hot</span>
            </div>
          </div>

          {/* Has website */}
          <div className="flex items-center gap-2">
            <input
              id="has-website"
              type="checkbox"
              checked={hasWebsite}
              onChange={(e) => setHasWebsite(e.target.checked)}
              className="accent-green-600"
            />
            <label htmlFor="has-website" className="text-sm text-gray-700">Has a website</label>
          </div>

          {/* Social links */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Facebook Page URL <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={facebookPageUrl}
                onChange={(e) => setFacebookPageUrl(e.target.value)}
                placeholder="https://facebook.com/theirbusiness"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Instagram URL <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/theirhandle"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm font-medium text-center">
              Lead activated — WhatsApp message sent!
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Activating…
              </>
            ) : (
              '⚡ Add & Activate Now'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
