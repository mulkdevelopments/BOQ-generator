'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExtractedMaterial } from '@/types'
import { groupMaterialsByType } from '@/lib/material-parser'
import { calculateArea } from '@/lib/material-parser'

const TITLE = 'SCOPE OF WORK FOR ALUMINIUM & GLASS'

interface ScopeOfWorkBillProps {
  projectName: string
  materials: ExtractedMaterial[]
  projectId?: string
  client?: string
  consultant?: string
  contractor?: string
  onSaveSuccess?: () => void
}

/** Parse dimensions string into W and H (e.g. "1200x600" or "2.5 x 1.8") */
function parseWH(dimensions: string | undefined): { w: string; h: string } {
  if (!dimensions) return { w: '', h: '' }
  const match = dimensions.match(/(\d+(?:\.\d+)?)\s*(?:x|×|X|\*)\s*(\d+(?:\.\d+)?)/i)
  if (match) return { w: match[1], h: match[2] }
  return { w: dimensions, h: '' }
}

function joinWH(w: string, h: string): string {
  if (w && h) return `${w}x${h}`
  if (w) return w
  return ''
}

function formatSectionLabel(type: string): string {
  if (type === 'acp') return 'ACP'
  if (type === 'unknown') return 'OTHER'
  return type.toUpperCase().replace(/\s+/g, ' ')
}

export default function ScopeOfWorkBill({
  projectName,
  materials,
  projectId,
  client = '',
  consultant = '',
  contractor = '',
  onSaveSuccess,
}: ScopeOfWorkBillProps) {
  const [localMaterials, setLocalMaterials] = useState<ExtractedMaterial[]>(materials)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingProject, setSavingProject] = useState(false)
  const [header, setHeader] = useState({
    projectName: projectName || '',
    client: client || '',
    consultant: consultant || '',
    contractor: contractor || '',
  })

  useEffect(() => {
    setLocalMaterials(materials)
  }, [materials])

  useEffect(() => {
    setHeader({
      projectName: projectName || '',
      client: client || '',
      consultant: consultant || '',
      contractor: contractor || '',
    })
  }, [projectName, client, consultant, contractor])

  const grouped = groupMaterialsByType(localMaterials)
  const sectionKeys = Object.keys(grouped).sort((a, b) => {
    // 'unknown' (OTHER) always last
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    return a.localeCompare(b)
  })

  const updateLocal = useCallback((id: string | undefined, patch: Partial<ExtractedMaterial>) => {
    if (!id) return
    setLocalMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    )
  }, [])

  const saveRow = useCallback(
    async (id: string | undefined, payload: { materialType?: string; dimensions?: string; quantity?: number; annotations?: string; rawData?: Record<string, unknown> }) => {
      if (!id) return
      setSavingId(id)
      try {
        const res = await fetch(`/api/extracted-data/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            ...(payload.rawData !== undefined && { rawData: JSON.stringify(payload.rawData) }),
          }),
        })
        if (res.ok) onSaveSuccess?.()
      } catch {
        // keep local state on error
      } finally {
        setSavingId(null)
      }
    },
    [onSaveSuccess]
  )

  const getFloor = (m: ExtractedMaterial) => (m.rawData && typeof m.rawData.floor === 'string' ? m.rawData.floor : '')

  const saveProjectHeader = useCallback(async () => {
    if (!projectId) return
    setSavingProject(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: header.projectName.trim() || undefined,
          client: header.client.trim() || null,
          consultant: header.consultant.trim() || null,
          contractor: header.contractor.trim() || null,
        }),
      })
      if (res.ok) onSaveSuccess?.()
    } catch {
      // keep local state
    } finally {
      setSavingProject(false)
    }
  }, [projectId, header, onSaveSuccess])

  if (materials.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        <p>No materials extracted yet.</p>
        <p className="text-sm mt-1">Process drawings to see the bill here.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-300 overflow-hidden shadow-sm">
      {/* Header block */}
      <div className="border-b border-gray-300 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {TITLE}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Edit header and table cells; use Save to store header changes. Table cells save when you leave the field.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {projectId && (
              <>
                <button
                  type="button"
                  onClick={saveProjectHeader}
                  disabled={savingProject}
                  className="text-sm px-4 py-2 bg-blue-600 text-white rounded border border-blue-700 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingProject ? 'Saving…' : 'Save'}
                </button>
                <a
                  href={`/api/export?projectId=${encodeURIComponent(projectId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
                >
                  Export CSV
                </a>
              </>
            )}
          </div>
        </div>
        <table className="text-sm w-full max-w-xl border-b border-gray-200">
          <tbody>
            <tr>
              <td className="font-semibold text-gray-700 align-top w-40 py-1">PROJECT NAME:</td>
              <td className="py-1">
                <input
                  className="w-full px-2 py-1 text-gray-900 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={header.projectName}
                  onChange={(e) => setHeader((h) => ({ ...h, projectName: e.target.value }))}
                  placeholder="Project name"
                />
              </td>
            </tr>
            <tr>
              <td className="font-semibold text-gray-700 align-top py-1">CLIENT:</td>
              <td className="py-1">
                <input
                  className="w-full px-2 py-1 text-gray-900 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={header.client}
                  onChange={(e) => setHeader((h) => ({ ...h, client: e.target.value }))}
                  placeholder="Client"
                />
              </td>
            </tr>
            <tr>
              <td className="font-semibold text-gray-700 align-top py-1">CONSULTANT:</td>
              <td className="py-1">
                <input
                  className="w-full px-2 py-1 text-gray-900 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={header.consultant}
                  onChange={(e) => setHeader((h) => ({ ...h, consultant: e.target.value }))}
                  placeholder="Consultant"
                />
              </td>
            </tr>
            <tr>
              <td className="font-semibold text-gray-700 align-top py-1">ALUMINIUM CONTRACTOR:</td>
              <td className="py-1">
                <input
                  className="w-full px-2 py-1 text-gray-900 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  value={header.contractor}
                  onChange={(e) => setHeader((h) => ({ ...h, contractor: e.target.value }))}
                  placeholder="Aluminium contractor"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* All sections stacked */}
      {sectionKeys.map((sectionKey) => {
        const sectionMaterials = grouped[sectionKey] ?? []
        const totalQty = sectionMaterials.reduce((sum, m) => sum + (m.quantity ?? 0), 0)
        const totalArea = sectionMaterials.reduce((sum, m) => {
          const area = m.dimensions ? calculateArea(m.dimensions) : undefined
          const qty = m.quantity ?? 1
          return sum + (area != null ? area * qty : 0)
        }, 0)

        return (
          <div key={sectionKey} id={`section-${sectionKey}`} className="border-b border-gray-300 last:border-b-0">
            <div className="bg-amber-200 border-y border-amber-300 px-4 py-2">
              <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                {formatSectionLabel(sectionKey)}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">SL.No</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">Code</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">Floor</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800">Location</th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-800">W</th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-800">H</th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-800">Qty/floor</th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-800">No of Floors.</th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-800">T. Qty</th>
                    <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-800">T. Area Sqm</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionMaterials.map((m, i) => {
                    const { w, h } = parseWH(m.dimensions)
                    const qty = m.quantity ?? 1
                    const area = m.dimensions ? calculateArea(m.dimensions) : undefined
                    const tArea = area != null ? (area * qty) : undefined
                    const isSaving = m.id === savingId
                    const canEdit = Boolean(m.id)
                    const floor = getFloor(m)
                    return (
                      <tr key={m.id ?? i} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="border border-gray-300 px-3 py-2 text-gray-700 w-12">{i + 1}</td>
                        <td className="border border-gray-300 px-1 py-1">
                          {canEdit ? (
                            <input
                              className="w-full min-w-[4rem] px-2 py-1 text-sm font-medium border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={m.materialType ?? ''}
                              onChange={(e) => updateLocal(m.id!, { materialType: e.target.value })}
                              onBlur={(e) => {
                                const v = e.target.value.trim()
                                if (v !== (m.materialType ?? '')) saveRow(m.id, { ...m, materialType: v || undefined })
                              }}
                              placeholder="Code"
                            />
                          ) : (
                            <span className="px-2 py-1 text-gray-900">{m.materialType ? formatSectionLabel(m.materialType).replace(/\s+/g, '') : '—'}</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-1 py-1">
                          {canEdit ? (
                            <input
                              className="w-full min-w-[4rem] px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={floor}
                              onChange={(e) => updateLocal(m.id!, { rawData: { ...m.rawData, floor: e.target.value } })}
                              onBlur={(e) => {
                                const v = e.target.value.trim()
                                const next = { ...m.rawData, floor: v || undefined }
                                if (v !== floor) saveRow(m.id, { ...m, rawData: next })
                              }}
                              placeholder="Floor"
                            />
                          ) : (
                            <span className="px-2 py-1 text-gray-700">—</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-1 py-1 max-w-[120px]">
                          {canEdit ? (
                            <input
                              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 truncate"
                              value={m.annotations ?? ''}
                              onChange={(e) => updateLocal(m.id!, { annotations: e.target.value })}
                              onBlur={(e) => {
                                const v = e.target.value.trim()
                                if (v !== (m.annotations ?? '')) saveRow(m.id, { ...m, annotations: v || undefined })
                              }}
                              placeholder="Location"
                            />
                          ) : (
                            <span className="px-2 py-1 text-gray-700 truncate block" title={m.annotations}>{m.annotations || '—'}</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-right">
                          {canEdit ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-16 px-2 py-1 text-sm text-right border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={w}
                              onChange={(e) => {
                                const nw = e.target.value
                                updateLocal(m.id!, { dimensions: joinWH(nw, parseWH(m.dimensions).h) || undefined })
                              }}
                              onBlur={(e) => {
                                const nw = e.target.value.trim()
                                const { h: nh } = parseWH(m.dimensions)
                                const dim = joinWH(nw, nh)
                                if (dim !== (m.dimensions ?? '')) saveRow(m.id, { ...m, dimensions: dim || undefined })
                              }}
                              placeholder="W"
                            />
                          ) : (
                            <span className="px-2 py-1 text-gray-700">{w || '—'}</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-right">
                          {canEdit ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-16 px-2 py-1 text-sm text-right border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={h}
                              onChange={(e) => {
                                const nh = e.target.value
                                updateLocal(m.id!, { dimensions: joinWH(parseWH(m.dimensions).w, nh) || undefined })
                              }}
                              onBlur={(e) => {
                                const nh = e.target.value.trim()
                                const { w: nw } = parseWH(m.dimensions)
                                const dim = joinWH(nw, nh)
                                if (dim !== (m.dimensions ?? '')) saveRow(m.id, { ...m, dimensions: dim || undefined })
                              }}
                              placeholder="H"
                            />
                          ) : (
                            <span className="px-2 py-1 text-gray-700">{h || '—'}</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-right">
                          {canEdit ? (
                            <input
                              type="number"
                              min={0}
                              step={1}
                              className="w-14 px-2 py-1 text-sm text-right border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              value={qty}
                              onChange={(e) => {
                                const v = e.target.value === '' ? undefined : Number(e.target.value)
                                updateLocal(m.id!, { quantity: v })
                              }}
                              onBlur={(e) => {
                                const v = e.target.value === '' ? undefined : Number(e.target.value)
                                if (v !== (m.quantity ?? 1)) saveRow(m.id, { ...m, quantity: v ?? undefined })
                              }}
                            />
                          ) : (
                            <span className="px-2 py-1 text-gray-700">{qty}</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-gray-700">1</td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-gray-700">{qty}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right text-gray-700">
                          {tArea != null ? tArea.toFixed(2) : '—'}
                          {isSaving && (
                            <span className="ml-1 inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin align-middle" title="Saving..." />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-semibold border-t-2 border-gray-400">
                    <td colSpan={8} className="border border-gray-300 px-3 py-2 text-right text-gray-800">
                      TOTAL
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-gray-900">{totalQty}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-gray-900">
                      {totalArea > 0 ? totalArea.toFixed(2) : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={9} className="border border-gray-300 px-3 py-1.5 text-right">
                      <span className="font-bold text-red-600">TOTAL SQM</span>
                    </td>
                    <td className="border border-gray-300 px-3 py-1.5 text-right font-bold text-red-600">
                      {totalArea > 0 ? totalArea.toFixed(2) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })}

      {sectionKeys.length > 1 && (
        <div className="flex items-center gap-1 border-t border-gray-300 bg-gray-100 px-2 py-2 overflow-x-auto flex-wrap">
          <span className="text-xs text-gray-500 mr-2 shrink-0">Jump to:</span>
          {sectionKeys.map((key) => (
            <a
              key={key}
              href={`#section-${key}`}
              className="shrink-0 px-3 py-1.5 rounded text-sm font-medium bg-green-100 text-green-800 hover:bg-green-200 border border-gray-300"
            >
              {formatSectionLabel(key)}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
