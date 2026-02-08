import { ExtractedMaterial } from '@/types'

const CONFIDENCE_ORDER: Record<string, number> = {
  confirmed: 3,
  estimated: 2,
  missing: 1,
}

function normalizeKey(m: ExtractedMaterial): string {
  const type = (m.materialType ?? '').toLowerCase().trim()
  const dims = (m.dimensions ?? '').trim()
  const qty = m.quantity != null ? String(m.quantity) : ''
  return `${type}|${dims}|${qty}`
}

/**
 * Merge duplicates by (materialType, dimensions, quantity).
 * Preserves highest confidence and concatenates annotations/sourceTrace.
 */
export function deduplicateMaterials(materials: ExtractedMaterial[]): ExtractedMaterial[] {
  const byKey = new Map<string, ExtractedMaterial[]>()

  for (const m of materials) {
    const key = normalizeKey(m)
    const list = byKey.get(key) ?? []
    list.push(m)
    byKey.set(key, list)
  }

  const result: ExtractedMaterial[] = []
  for (const group of byKey.values()) {
    if (group.length === 0) continue
    const best = group.reduce((a, b) =>
      (CONFIDENCE_ORDER[a.confidence ?? ''] ?? 0) >= (CONFIDENCE_ORDER[b.confidence ?? ''] ?? 0)
        ? a
        : b
    )
    const annotations = [...new Set(group.map((g) => g.annotations).filter(Boolean))].join('; ')
    const merged: ExtractedMaterial = {
      ...best,
      annotations: annotations || best.annotations,
    }
    const traces = group
      .map((g) => g.rawData?.sourceTrace)
      .filter(Boolean) as Record<string, unknown>[]
    if (traces.length > 0) {
      merged.rawData = { ...merged.rawData, sourceTrace: traces[0], sourceTraceCount: traces.length }
    }
    result.push(merged)
  }
  return result
}
