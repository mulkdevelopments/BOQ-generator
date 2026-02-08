/**
 * Data quality validation for extracted materials
 * Inspired by DDC BIM validation: rules-based checks, fill rates, quality metrics
 */

import { ExtractedMaterial } from '@/types'

export interface ValidationRule {
  id: string
  name: string
  check: (m: ExtractedMaterial) => boolean
  severity: 'error' | 'warning' | 'info'
}

export interface ValidationResult {
  materialIndex: number
  ruleId: string
  ruleName: string
  severity: 'error' | 'warning' | 'info'
  message: string
}

export interface DataQualityMetrics {
  total: number
  withMaterialType: number
  withDimensions: number
  withQuantity: number
  withSourceTrace: number
  confirmed: number
  estimated: number
  missing: number
  fillRateMaterialType: number
  fillRateDimensions: number
  fillRateQuantity: number
  fillRateComplete: number
}

const DEFAULT_RULES: ValidationRule[] = [
  {
    id: 'has-material-type',
    name: 'Material type identified',
    check: (m) => !!m.materialType?.trim(),
    severity: 'warning',
  },
  {
    id: 'has-dimensions',
    name: 'Dimensions specified',
    check: (m) => !!m.dimensions?.trim(),
    severity: 'info',
  },
  {
    id: 'has-quantity',
    name: 'Quantity present',
    check: (m) => m.quantity != null && m.quantity > 0,
    severity: 'warning',
  },
  {
    id: 'has-source-trace',
    name: 'Source traceability',
    check: (m) => !!m.rawData?.sourceTrace,
    severity: 'info',
  },
  {
    id: 'has-annotations',
    name: 'Raw text/annotations',
    check: (m) => !!m.annotations?.trim(),
    severity: 'info',
  },
]

/**
 * Validate materials against rules (DDC-style validation)
 */
export function validateMaterials(materials: ExtractedMaterial[]): ValidationResult[] {
  const results: ValidationResult[] = []
  for (let i = 0; i < materials.length; i++) {
    const m = materials[i]
    for (const rule of DEFAULT_RULES) {
      const passed = rule.check(m)
      if (!passed) {
        results.push({
          materialIndex: i,
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: `Missing: ${rule.name}`,
        })
      }
    }
  }
  return results
}

/**
 * Compute data quality metrics (DDC fill-rate style)
 */
export function computeDataQualityMetrics(materials: ExtractedMaterial[]): DataQualityMetrics {
  const total = materials.length
  if (total === 0) {
    return {
      total: 0,
      withMaterialType: 0,
      withDimensions: 0,
      withQuantity: 0,
      withSourceTrace: 0,
      confirmed: 0,
      estimated: 0,
      missing: 0,
      fillRateMaterialType: 0,
      fillRateDimensions: 0,
      fillRateQuantity: 0,
      fillRateComplete: 0,
    }
  }

  let withMaterialType = 0
  let withDimensions = 0
  let withQuantity = 0
  let withSourceTrace = 0
  let confirmed = 0
  let estimated = 0
  let missing = 0

  for (const m of materials) {
    if (m.materialType?.trim()) withMaterialType++
    if (m.dimensions?.trim()) withDimensions++
    if (m.quantity != null && m.quantity > 0) withQuantity++
    if (m.rawData?.sourceTrace) withSourceTrace++
    const c = m.confidence ?? 'missing'
    if (c === 'confirmed') confirmed++
    else if (c === 'estimated') estimated++
    else missing++
  }

  const fillRateMaterialType = (withMaterialType / total) * 100
  const fillRateDimensions = (withDimensions / total) * 100
  const fillRateQuantity = (withQuantity / total) * 100
  const complete = materials.filter(
    (m) => m.materialType?.trim() && m.dimensions?.trim() && (m.quantity ?? 0) > 0
  ).length
  const fillRateComplete = (complete / total) * 100

  return {
    total,
    withMaterialType,
    withDimensions,
    withQuantity,
    withSourceTrace,
    confirmed,
    estimated,
    missing,
    fillRateMaterialType,
    fillRateDimensions,
    fillRateQuantity,
    fillRateComplete,
  }
}
