'use client'

import { useState } from 'react'
import type { LeadData } from '@/types/lead'
import LeadForm from '@/components/LeadForm'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(data: LeadData) {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Server error: ${response.status}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      const safeName = data.businessName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      a.download = `lead_${safeName}_${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black text-white py-4 px-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <span className="text-green-500 text-2xl font-bold">S</span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Skhokho Lead System</h1>
            <p className="text-gray-400 text-xs">Sales Agent Intake Tool</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
        <LeadForm onSubmit={handleSubmit} isLoading={isLoading} />
      </main>
    </div>
  )
}
