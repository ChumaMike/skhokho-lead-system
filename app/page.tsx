'use client'

import { useState, useEffect, useRef } from 'react'
import type { LeadData } from '@/types/lead'
import LeadForm from '@/components/LeadForm'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear timer on unmount to avoid state updates on unmounted component
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
      }
    }
  }, [])

  async function handleSubmit(data: LeadData) {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

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

      // Show success banner and auto-dismiss after 4 seconds
      setSuccess(true)
      successTimerRef.current = setTimeout(() => {
        setSuccess(false)
      }, 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-black text-white py-4 px-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold leading-tight tracking-wide">
            SKHOKHO<span className="text-green-500"> LABS</span>
          </h1>
          <span className="text-xs text-gray-400 border border-gray-700 rounded-full px-3 py-1">
            Lead System v1.0
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto w-full px-4 py-8 flex-1">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
            ✓ PDF downloaded successfully! Fill in the next lead below.
          </div>
        )}
        <LeadForm onSubmit={handleSubmit} isLoading={isLoading} />
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6">
        Skhokho Labs — Lead System v1.0
      </footer>
    </div>
  )
}
