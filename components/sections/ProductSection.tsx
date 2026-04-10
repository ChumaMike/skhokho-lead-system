'use client'

import type { LeadData, Product } from '@/types/lead'
import { PRODUCT_DETAILS, getRecommendedProduct } from '@/lib/productMatch'

interface ProductSectionProps {
  data: Partial<LeadData>
  onChange: (fields: Partial<LeadData>) => void
}

const inputClass =
  'border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-500 text-sm'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

const ALL_PRODUCTS = Object.keys(PRODUCT_DETAILS) as Product[]

export default function ProductSection({ data, onChange }: ProductSectionProps) {
  const autoProduct = data.sector ? getRecommendedProduct(data.sector) : 'starter_website'
  const selectedProduct: Product = data.recommendedProduct ?? autoProduct
  const details = PRODUCT_DETAILS[selectedProduct]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        <span className="text-green-500 font-bold mr-2">04</span>Recommended Product
      </h2>

      {/* Auto-recommendation callout */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <p className="text-xs text-green-700 font-medium uppercase tracking-wide mb-1">
          Auto-recommended for sector
        </p>
        <p className="text-sm font-semibold text-green-900">{PRODUCT_DETAILS[autoProduct].name}</p>
        <p className="text-sm text-green-700 italic mt-1">"{PRODUCT_DETAILS[autoProduct].pitch}"</p>
      </div>

      {/* Override dropdown */}
      <div className="mb-5">
        <label className={labelClass} htmlFor="productOverride">
          Selected Product (override if needed)
        </label>
        <select
          id="productOverride"
          className={inputClass}
          value={selectedProduct}
          onChange={(e) => onChange({ recommendedProduct: e.target.value as Product })}
        >
          {ALL_PRODUCTS.map((p) => (
            <option key={p} value={p}>
              {PRODUCT_DETAILS[p].name}
            </option>
          ))}
        </select>
      </div>

      {/* Product details card */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-2">
        <p className="text-base font-semibold text-gray-900">{details.name}</p>
        <p className="text-sm text-gray-500 italic">"{details.pitch}"</p>
        <div className="flex gap-6 text-sm text-gray-700 pt-1">
          <span>
            <span className="font-medium">Setup:</span> {details.setupFee}
          </span>
          <span>
            <span className="font-medium">Monthly:</span> {details.monthly}
          </span>
        </div>
      </div>
    </div>
  )
}
