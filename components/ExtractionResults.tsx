'use client'

import { ExtractedMaterial } from '@/types'
import MaterialTable from './MaterialTable'
import { groupMaterialsByType } from '@/lib/material-parser'
import { computeDataQualityMetrics } from '@/lib/extraction-validation'

interface ExtractionResultsProps {
  materials: ExtractedMaterial[]
  drawingId?: string
  projectId?: string
  status?: 'pending' | 'processing' | 'completed' | 'error'
}

export default function ExtractionResults({
  materials,
  drawingId,
  projectId,
  status = 'completed',
}: ExtractionResultsProps) {
  const groupedMaterials = groupMaterialsByType(materials)
  const metrics = computeDataQualityMetrics(materials)

  const handleExportCsv = () => {
    const params = new URLSearchParams()
    if (drawingId) params.set('drawingId', drawingId)
    else if (projectId) params.set('projectId', projectId)
    if (params.toString()) {
      window.open(`/api/export?${params.toString()}`, '_blank')
    }
  }

  if (status === 'pending' || status === 'processing') {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">
          {status === 'pending' ? 'Waiting to process...' : 'Processing drawing...'}
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-gray-600">Error processing drawing</p>
      </div>
    )
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No materials extracted from this drawing</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-600 mb-1">Total Materials</div>
          <div className="text-2xl font-bold text-blue-900">{materials.length}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm font-medium text-green-600 mb-1">Material Types</div>
          <div className="text-2xl font-bold text-green-900">
            {Object.keys(groupedMaterials).length}
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-sm font-medium text-purple-600 mb-1">Total Quantity</div>
          <div className="text-2xl font-bold text-purple-900">
            {materials
              .reduce((sum, m) => sum + (m.quantity || 0), 0)
              .toFixed(2)}
          </div>
        </div>
      </div>

      {/* Data quality & traceability (DDC-inspired) */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Confidence:</span>{' '}
          <span className="text-green-700">{metrics.confirmed} confirmed</span>
          {' • '}
          <span className="text-amber-700">{metrics.estimated} estimated</span>
          {' • '}
          <span className="text-gray-500">{metrics.missing} missing</span>
        </div>
        <div className="text-sm text-gray-500">
            <span className="font-medium">Data fill:</span>{' '}
            {metrics.fillRateMaterialType.toFixed(0)}% type • {metrics.fillRateDimensions.toFixed(0)}% dims • {metrics.fillRateQuantity.toFixed(0)}% qty
          </div>
        {(drawingId || projectId) && (
          <button
            onClick={handleExportCsv}
            className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* QTO-style summary by type (DDC: group by attributes, aggregate) */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h2 className="text-lg font-medium text-gray-800 mb-3">Quantity by Type (QTO)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-600">Type</th>
                <th className="text-right py-2 font-medium text-gray-600">Count</th>
                <th className="text-right py-2 font-medium text-gray-600">Total Qty</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedMaterials).map(([type, items]) => (
                <tr key={type} className="border-b border-gray-100">
                  <td className="py-2 capitalize">{type === 'acp' ? 'ACP' : type === 'unknown' ? 'Unspecified' : type}</td>
                  <td className="text-right py-2">{items.length}</td>
                  <td className="text-right py-2">
                    {items.reduce((s, m) => s + (m.quantity ?? 0), 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grouped View */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Materials by Type</h2>
        {Object.entries(groupedMaterials).map(([type, typeMaterials]) => (
          <div key={type} className="border border-gray-200 rounded-lg p-4">
            <h3 className={`text-lg font-medium text-gray-800 mb-3 ${type !== 'acp' ? 'capitalize' : ''}`}>
              {type === 'unknown' ? 'Unspecified Materials' : type === 'acp' ? 'ACP' : type}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({typeMaterials.length} items)
              </span>
            </h3>
            <MaterialTable materials={typeMaterials} />
          </div>
        ))}
      </div>

      {/* Full Table View */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">All Materials</h2>
        <MaterialTable materials={materials} />
      </div>
    </div>
  )
}
