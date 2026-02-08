'use client'

import { useState } from 'react'
import { ExtractedMaterial, Confidence } from '@/types'

interface MaterialTableProps {
  materials: ExtractedMaterial[]
}

function formatMaterialType(type: string): string {
  return type === 'acp' ? 'ACP' : type
}

function ConfidenceBadge({ confidence }: { confidence?: Confidence }) {
  if (!confidence) return <span className="text-gray-400">-</span>
  const styles: Record<Confidence, string> = {
    confirmed: 'bg-green-100 text-green-800',
    estimated: 'bg-amber-100 text-amber-800',
    missing: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[confidence]}`}>
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
    </span>
  )
}

function SourceTooltip({ rawData }: { rawData?: Record<string, unknown> }) {
  const trace = rawData?.sourceTrace as { entityType?: string; layer?: string; blockName?: string; tableName?: string; rowIndex?: number; pageNumber?: number } | undefined
  if (!trace) return null
  const parts: string[] = []
  if (trace.entityType) parts.push(trace.entityType)
  if (trace.layer) parts.push(`Layer: ${trace.layer}`)
  if (trace.blockName) parts.push(`Block: ${trace.blockName}`)
  if (trace.tableName) parts.push(`Table: ${trace.tableName}`)
  if (trace.rowIndex != null) parts.push(`Row: ${trace.rowIndex}`)
  if (trace.pageNumber != null) parts.push(`Page: ${trace.pageNumber}`)
  if (parts.length === 0) return null
  return (
    <span
      className="ml-1 cursor-help inline-flex items-center text-gray-400 hover:text-gray-600"
      title={`Source: ${parts.join(' • ')}`}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
  )
}

export default function MaterialTable({ materials }: MaterialTableProps) {
  const [sortBy, setSortBy] = useState<keyof ExtractedMaterial | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterType, setFilterType] = useState<string>('all')

  // Get unique material types
  const materialTypes = ['all', ...new Set(materials.map(m => m.materialType).filter(Boolean))]

  // Filter materials
  const filteredMaterials = materials.filter(m => {
    if (filterType === 'all') return true
    return m.materialType === filterType
  })

  // Sort materials
  const sortedMaterials = [...filteredMaterials].sort((a, b) => {
    if (!sortBy) return 0

    const aValue = a[sortBy]
    const bValue = b[sortBy]

    if (aValue === undefined || aValue === null) return 1
    if (bValue === undefined || bValue === null) return -1

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    }

    return 0
  })

  const handleSort = (column: keyof ExtractedMaterial) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Calculate totals
  const totalQuantity = filteredMaterials.reduce((sum, m) => sum + (m.quantity || 0), 0)
  const typeCounts = filteredMaterials.reduce((acc, m) => {
    const type = m.materialType || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (materials.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No materials extracted yet
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Filters and Summary */}
      <div className="mb-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="filter-type" className="text-sm font-medium text-gray-700">
            Filter by type:
          </label>
          <select
            id="filter-type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {materialTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : formatMaterialType(type ?? 'other')}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-gray-600">
          <span className="font-medium">Total Items:</span> {filteredMaterials.length} |{' '}
          <span className="font-medium">Total Quantity:</span> {totalQuantity.toFixed(2)}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                onClick={() => handleSort('materialType')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                Material Type
                {sortBy === 'materialType' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                onClick={() => handleSort('dimensions')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                Dimensions
                {sortBy === 'dimensions' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                onClick={() => handleSort('quantity')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                Quantity
                {sortBy === 'quantity' && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Annotations
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedMaterials.map((material, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {material.materialType ? (
                    formatMaterialType(material.materialType)
                  ) : (
                    <span className="text-gray-400 italic">Not specified</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {material.dimensions || (
                    <span className="text-gray-400 italic">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {material.quantity !== undefined ? (
                    material.quantity.toFixed(2)
                  ) : (
                    <span className="text-gray-400 italic">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <ConfidenceBadge confidence={material.confidence} />
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-md">
                  <div className="flex items-start gap-1">
                    <span className="truncate flex-1" title={material.annotations}>
                      {material.annotations || (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </span>
                    <SourceTooltip rawData={material.rawData} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Type Summary */}
      {Object.keys(typeCounts).length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Summary by Type</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(typeCounts).map(([type, count]) => (
              <span
                key={type}
                className="px-3 py-1 bg-white border border-gray-200 rounded-md text-sm"
              >
                {formatMaterialType(type)}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
