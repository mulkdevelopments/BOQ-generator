import { ExtractedMaterial, Confidence } from '@/types'
import type { TableRow } from '@/types/extraction'

/**
 * Material keywords for identification
 * Order matters: more specific facade materials (ACP, aluminum) are checked first
 * before generic terms like 'panel' or 'window' that appear in many contexts
 */
const MATERIAL_KEYWORDS: Record<string, string[]> = {
  acp: ['acp', 'aluminum composite', 'alucobond', 'acm', 'aluminium composite', 'composite panel', 'acp panel', 'metal composite', 'acp cladding', 'composite cladding'],
  aluminum: ['aluminum panel', 'aluminum cladding', 'aluminum sheet', 'aluminium panel', 'aluminium cladding', 'aluminum', 'aluminium', 'aluminum mullion', 'aluminum framing', 'al frame'],
  steel: ['steel', 'stainless steel', 'carbon steel', 'ss ', ' ss'],
  composite: ['composite'],
  glass: ['double glaz', 'triple glaz', 'glazing unit', 'glazed unit', 'glass', 'glazing', 'glazed', 'insulated glass', 'window', 'pane', 'vision panel'],
  concrete: ['concrete', 'reinforced concrete', ' rc '],
  stone: ['stone', 'marble', 'granite', 'limestone', 'natural stone'],
  brick: ['brick', 'masonry'],
  other: ['facade', 'curtain wall', 'cladding', 'panel']
}

/**
 * Dimension patterns for extraction
 * CAD drawings often omit units (assume mm for architectural)
 */
const DIMENSION_PATTERNS = [
  // 1200x600mm, 1200 x 600 mm, 1200×600
  /(\d+(?:\.\d+)?)\s*(?:x|×|X|\*)\s*(\d+(?:\.\d+)?)\s*(?:x|×|X|\*)?\s*(\d+(?:\.\d+)?)?\s*(mm|cm|m|ft|in)?/gi,
  // 1200mm x 600mm
  /(\d+(?:\.\d+)?)\s*(mm|cm|m|ft|in)\s*(?:x|×|X)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|ft|in)/gi,
  // 1200mm wide, 4mm thick
  /(\d+(?:\.\d+)?)\s*(?:mm|cm|m|ft|in)\s*(?:wide|long|high|thick|deep)/gi,
  // width: 1200mm
  /(?:width|length|height|depth|thickness|thk):\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|ft|in)?/gi,
]

/**
 * Quantity patterns - schedule tables use various formats
 */
const QUANTITY_PATTERNS = [
  /(?:qty|quantity|count|no\.?|number|qty\.):\s*(\d+(?:\.\d+)?)/gi,
  /(\d+(?:\.\d+)?)\s*(?:pcs|pieces|units|items|panels|sheets|nos?\.?|nr|ea|each)/gi,
  /(?:total|sum|all):\s*(\d+(?:\.\d+)?)/gi,
  /\b(\d{1,4})\s*(?:nr|no\.?|nos?\.?|ea|each|num)\b/gi,
  // Table cells with just a number (1-999) - likely quantity; avoid 4+ digit numbers (often dimensions)
  /^\s*(\d{1,3})\s*$/gm,
]

/**
 * Extract material type from text
 */
export function extractMaterialType(text: string): string | undefined {
  const lowerText = text.toLowerCase()
  
  for (const [materialType, keywords] of Object.entries(MATERIAL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return materialType
      }
    }
  }
  
  return undefined
}

/**
 * Extract dimensions from text
 */
export function extractDimensions(text: string): string[] {
  const dimensions: string[] = []
  
  for (const pattern of DIMENSION_PATTERNS) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match[0]) {
        dimensions.push(match[0].trim())
      }
    }
  }
  
  return [...new Set(dimensions)] // Remove duplicates
}

/**
 * Extract quantities from text
 */
export function extractQuantities(text: string): number[] {
  const quantities: number[] = []
  
  for (const pattern of QUANTITY_PATTERNS) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        const qty = parseFloat(match[1])
        if (!isNaN(qty)) {
          quantities.push(qty)
        }
      }
    }
  }
  
  return quantities
}

/**
 * Calculate area from dimensions string
 * Assumes mm when no unit specified (standard in architectural CAD)
 */
export function calculateArea(dimensions: string): number | undefined {
  // Try to extract two dimensions (length x width), unit optional
  const match = dimensions.match(/(\d+(?:\.\d+)?)\s*(?:x|×|X|\*)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|ft|in)?/i)
  
  if (match) {
    const length = parseFloat(match[1])
    const width = parseFloat(match[2])
    const unit = (match[3] || 'mm').toLowerCase() // Default mm for CAD
    
    let lengthM = length
    let widthM = width
    
    if (unit === 'mm') {
      lengthM = length / 1000
      widthM = width / 1000
    } else if (unit === 'cm') {
      lengthM = length / 100
      widthM = width / 100
    } else if (unit === 'ft') {
      lengthM = length * 0.3048
      widthM = width * 0.3048
    } else if (unit === 'in') {
      lengthM = length * 0.0254
      widthM = width * 0.0254
    }
    
    return lengthM * widthM // Area in square meters
  }
  
  return undefined
}

/**
 * Parse a table row into a material using column roles
 */
export function parseTableRow(row: TableRow): ExtractedMaterial | null {
  const roles = row.columnRoles ?? []
  let descCell = ''
  let qtyCell = ''
  let sizeCell = ''
  for (let col = 0; col < row.cells.length; col++) {
    const role = roles[col] ?? ''
    const val = row.cells[col]?.trim() ?? ''
    if (role === 'desc') descCell = val
    else if (role === 'qty') qtyCell = val
    else if (role === 'size') sizeCell = val
    else if (roles.length === 0) {
      if (extractMaterialType(val)) descCell = val
      else if (/^\d{1,3}$/.test(val)) qtyCell = val
      else if (/\d+\s*[x×X*]\s*\d+/.test(val)) sizeCell = val
    }
  }
  const materialType = extractMaterialType(descCell || row.cells.join(' '))
  const dimensions = sizeCell ? extractDimensions(sizeCell) : []
  const dimStr = dimensions.length > 0 ? dimensions.join(', ') : undefined
  const qtyNum = qtyCell ? parseInt(qtyCell, 10) : NaN
  const hasQty = !isNaN(qtyNum) && qtyNum >= 0
  const hasDims = !!dimStr
  if (!materialType && !descCell && !hasQty && !hasDims) return null
  let quantity: number | undefined
  let confidence: Confidence = 'missing'

  if (hasQty && !isNaN(qtyNum)) {
    quantity = qtyNum
    confidence = 'confirmed'
  } else if (dimStr) {
    const area = calculateArea(dimStr)
    if (area != null) {
      quantity = area
      confidence = 'estimated'
    }
  }

  return {
    materialType: materialType ?? undefined,
    dimensions: dimStr,
    quantity,
    annotations: descCell || row.cells.join(' | '),
    confidence,
    rawData: {
      source: 'dwg',
      method: 'table',
      sourceTrace: { entityType: 'ACAD_TABLE', tableName: row.tableName, rowIndex: row.rowIndex },
    },
  }
}

/**
 * Parse extracted text/data into structured material information
 */
export function parseMaterialData(text: string, additionalData?: Record<string, any>): ExtractedMaterial[] {
  const materials: ExtractedMaterial[] = []

  // Split by double newlines (paragraphs) first, then by single newlines (lines)
  const paragraphs = text.split(/\n\n|\r\n\r\n/).filter(s => s.trim().length > 0)
  const textSections: string[] = []
  for (const para of paragraphs.length > 0 ? paragraphs : [text]) {
    const lines = para.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
    for (const line of lines) {
      if (line.length >= 2) textSections.push(line)
    }
  }
  if (textSections.length === 0 && text.trim().length > 0) textSections.push(text.trim())
  
  for (const section of textSections) {
    const materialType = extractMaterialType(section)
    const dimensions = extractDimensions(section)
    const quantities = extractQuantities(section)
    
    let quantity: number | undefined
    let confidence: Confidence = 'missing'
    if (quantities.length > 0) {
      quantity = quantities.reduce((a, b) => a + b, 0)
      confidence = 'confirmed'
    } else if (dimensions.length > 0) {
      const area = calculateArea(dimensions[0])
      if (area) {
        quantity = area
        confidence = 'estimated'
      }
    } else if (materialType) {
      confidence = 'missing'
    }

    if (materialType || dimensions.length > 0 || quantities.length > 0) {
      const rawData: Record<string, unknown> = { ...(additionalData || {}) }
      if (additionalData?.source && !rawData.sourceTrace) {
        rawData.sourceTrace = {
          source: additionalData.source,
          method: additionalData.method ?? additionalData.source,
          ...(additionalData.pages != null && { pageNumber: additionalData.pages }),
        }
      }
      const material: ExtractedMaterial = {
        materialType: materialType || undefined,
        dimensions: dimensions.length > 0 ? dimensions.join(', ') : undefined,
        quantity,
        annotations: section.trim(),
        confidence,
        rawData,
      }
      
      if (material.dimensions && !material.quantity) {
        const area = calculateArea(material.dimensions)
        if (area) {
          material.quantity = area
          material.confidence = 'estimated'
          material.rawData = { ...material.rawData, area: area, areaUnit: 'm²' }
        }
      }
      
      materials.push(material)
    }
  }
  
  // If no materials found, create a general entry with all annotations
  if (materials.length === 0 && text.trim().length > 0) {
    materials.push({
      annotations: text.trim(),
      rawData: additionalData || {}
    })
  }
  
  return materials
}

/**
 * Group materials by type
 */
export function groupMaterialsByType(materials: ExtractedMaterial[]): Record<string, ExtractedMaterial[]> {
  const grouped: Record<string, ExtractedMaterial[]> = {}
  
  for (const material of materials) {
    const type = material.materialType || 'unknown'
    if (!grouped[type]) {
      grouped[type] = []
    }
    grouped[type].push(material)
  }
  
  return grouped
}
