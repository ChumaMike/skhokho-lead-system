'use client'

interface NotesSectionProps {
  value: string
  onChange: (notes: string) => void
}

export default function NotesSection({ value, onChange }: NotesSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
      <textarea
        rows={4}
        className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add any additional notes about this lead..."
      />
    </div>
  )
}
