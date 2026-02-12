'use client'

import { useEffect, useState } from 'react'

interface ProjectRatesProps {
  projectId: string
}

interface MaterialRate {
  id: string
  materialType: string
  unit: string | null
  rate: number | null
  currency: string | null
  source: string | null
  updatedAt: string
}

export default function ProjectRates({ projectId }: ProjectRatesProps) {
  const [rates, setRates] = useState<MaterialRate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/rates?projectId=${encodeURIComponent(projectId)}`)
        const data = await res.json()
        setRates((data.rates || []) as MaterialRate[])
      } catch (err) {
        setError('Failed to load rates')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  const updateLocal = (id: string, patch: Partial<MaterialRate>) => {
    setRates((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const saveRate = async (id: string) => {
    const row = rates.find((r) => r.id === id)
    if (!row) return
    setSavingId(id)
    try {
      await fetch(`/api/rates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate: row.rate,
          unit: row.unit,
          currency: row.currency,
          source: row.source || 'manual',
        }),
      })
    } catch {
      // ignore; local state already updated
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="text-xs text-gray-600">
        Live rates are stored per material type and are fully editable. Defaults are seeded
        from a simple internal table; you can override them to match your supply prices.
      </div>

      <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-500">
            Loading rates…
          </div>
        ) : rates.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-gray-400 px-4 text-center">
            No material types found for this project yet. Once you extract quantities, the
            types will appear here for pricing.
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">Unit</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-700">Rate</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">Currency</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-700">Source</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-700">Updated</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-1 font-medium text-gray-900 capitalize">
                      {r.materialType || 'other'}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-20 px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={r.unit ?? ''}
                        onChange={(e) =>
                          updateLocal(r.id, { unit: e.target.value || null })
                        }
                        onBlur={() => saveRate(r.id)}
                        placeholder="sqm / lm"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        className="w-24 px-1 py-0.5 border border-gray-200 rounded text-xs text-right focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={r.rate ?? ''}
                        onChange={(e) =>
                          updateLocal(r.id, {
                            rate:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        onBlur={() => saveRate(r.id)}
                        placeholder="0.00"
                        step="0.01"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-16 px-1 py-0.5 border border-gray-200 rounded text-xs uppercase focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={r.currency ?? ''}
                        onChange={(e) =>
                          updateLocal(r.id, {
                            currency: e.target.value.toUpperCase() || null,
                          })
                        }
                        onBlur={() => saveRate(r.id)}
                        placeholder="USD"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-28 px-1 py-0.5 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={r.source ?? ''}
                        onChange={(e) =>
                          updateLocal(r.id, { source: e.target.value || null })
                        }
                        onBlur={() => saveRate(r.id)}
                        placeholder="manual / default-table"
                      />
                    </td>
                    <td className="px-2 py-1 text-right text-[10px] text-gray-400">
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {savingId === r.id && (
                        <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="text-[11px] text-red-600 mt-1">{error}</div>
      )}
    </div>
  )
}

