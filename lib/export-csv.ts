/**
 * Export materials to CSV (DataFrame / open format)
 * DDC principle: Elements as rows, properties as columns
 */

import { ExtractedMaterial } from '@/types'

const CSV_HEADERS = [
  'ElementId',
  'Category',
  'Type',
  'Dimensions',
  'Quantity',
  'Unit',
  'Confidence',
  'Source',
  'Annotations',
]

function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert materials to CSV (DataFrame-style: elements as rows, properties as columns)
 */
export function materialsToCsv(materials: ExtractedMaterial[]): string {
  const rows: string[] = [CSV_HEADERS.join(',')]

  for (let i = 0; i < materials.length; i++) {
    const m = materials[i]
    const source = m.rawData?.sourceTrace
      ? typeof m.rawData.sourceTrace === 'object'
        ? JSON.stringify(m.rawData.sourceTrace).replace(/"/g, "'")
        : String(m.rawData.sourceTrace)
      : m.rawData?.source ?? ''

    const row = [
      `E${i + 1}`,
      escapeCsvCell(m.materialType ?? ''),
      m.materialType ?? 'unknown',
      escapeCsvCell(m.dimensions ?? ''),
      m.quantity ?? '',
      'm²',
      m.confidence ?? 'missing',
      escapeCsvCell(source),
      escapeCsvCell(m.annotations ?? ''),
    ]
    rows.push(row.join(','))
  }

  return rows.join('\n')
}
