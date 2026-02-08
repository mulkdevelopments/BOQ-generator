import { join } from 'path'
import { parseMaterialData } from './material-parser'
import { deduplicateMaterials } from './deduplicate-materials'
import { ExtractedMaterial } from '@/types'

/**
 * Configuration for DWG processing
 */
interface DWGProcessorConfig {
  forgeApiKey?: string
  forgeApiSecret?: string
  pythonServiceUrl?: string
}

let config: DWGProcessorConfig = {
  forgeApiKey: process.env.FORGE_API_KEY,
  forgeApiSecret: process.env.FORGE_API_SECRET,
  pythonServiceUrl: process.env.DWG_PYTHON_SERVICE_URL
}

/**
 * Set DWG processor configuration
 */
export function setDWGConfig(newConfig: Partial<DWGProcessorConfig>) {
  config = { ...config, ...newConfig }
}

// Type for entities with text content (from libredwg DwgDatabase)
interface EntityWithText {
  type: string
  layer?: string
  text?: string
  measurement?: number
  cells?: { text?: string }[]
  tag?: string
  prompt?: string
  name?: string
}

/**
 * Build flat text from all entities (simple flatten, original behavior)
 */
function extractAllTextFromDatabase(db: {
  entities?: EntityWithText[]
  tables?: { BLOCK_RECORD?: { entries?: { name: string; entities?: EntityWithText[] }[] } }
}): string {
  const texts: string[] = []

  function getText(entity: EntityWithText): string | undefined {
    const t = entity.text
    if (typeof t === 'string' && t.trim()) return t.trim()
    if (t && typeof t === 'object' && typeof (t as { text?: string }).text === 'string') {
      const s = (t as { text: string }).text.trim()
      if (s) return s
    }
    return undefined
  }

  function collectFromEntity(entity: EntityWithText) {
    switch (String(entity.type).toUpperCase()) {
      case 'TEXT':
      case 'MTEXT': {
        const txt = getText(entity)
        if (txt) texts.push(txt)
        break
      }
      case 'DIMENSION': {
        const txt = getText(entity)
        if (txt && txt !== '<>') texts.push(txt)
        else if (entity.measurement != null) texts.push(String(entity.measurement))
        break
      }
      case 'ATTRIB':
      case 'ATTDEF': {
        const txt = getText(entity)
        if (txt) texts.push(txt)
        if (entity.tag?.trim()) texts.push(entity.tag.trim())
        if (entity.prompt?.trim()) texts.push(entity.prompt.trim())
        break
      }
      case 'ACAD_TABLE':
        if (entity.cells && Array.isArray(entity.cells)) {
          for (const cell of entity.cells) {
            const cellText = cell?.text ?? (cell as { text_value?: string })?.text_value
            if (typeof cellText === 'string' && cellText.trim()) texts.push(cellText.trim())
          }
        }
        break
      case 'LEADER': {
        const leaderEntity = entity as EntityWithText & { annotation?: string }
        if (leaderEntity.annotation?.trim()) texts.push(leaderEntity.annotation.trim())
        break
      }
      default:
        break
    }
  }

  if (Array.isArray(db.entities)) {
    for (const entity of db.entities) {
      if (entity && typeof entity === 'object') collectFromEntity(entity as EntityWithText)
    }
  }
  const tables = db.tables as Record<string, { entries?: Array<{ entities?: EntityWithText[] }> }> | undefined
  const blockEntries = tables?.BLOCK_RECORD?.entries ?? tables?.block_record?.entries
  if (Array.isArray(blockEntries)) {
    for (const block of blockEntries) {
      const ents = block?.entities
      if (Array.isArray(ents)) {
        for (const entity of ents) {
          if (entity && typeof entity === 'object') collectFromEntity(entity as EntityWithText)
        }
      }
    }
  }
  return texts.filter(Boolean).join('\n')
}

/**
 * Process DWG using LibreDWG (free, open-source parser)
 * Simple flatten of all text entities + parseMaterialData (original behavior)
 */
async function processWithLibreDWG(filePath: string): Promise<ExtractedMaterial[]> {
  const { LibreDwg, Dwg_File_Type } = await import('@mlightcad/libredwg-web')
  const fs = await import('fs/promises')

  const buffer = await fs.readFile(filePath)
  if (!buffer || buffer.length === 0) {
    throw new Error('DWG file is empty or could not be read')
  }

  const wasmPath = join(process.cwd(), 'node_modules', '@mlightcad', 'libredwg-web', 'wasm')
  const libredwg = await LibreDwg.create(wasmPath)

  const fileContent = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer

  const dwgData = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DWG)

  if (!dwgData) {
    throw new Error('Failed to parse DWG file. The file may be corrupted or use an unsupported DWG version.')
  }

  let db: { entities?: EntityWithText[]; tables?: { BLOCK_RECORD?: { entries?: { name: string; entities?: EntityWithText[] }[] } } }
  try {
    db = libredwg.convert(dwgData) as typeof db

    const flatText = extractAllTextFromDatabase(db)

    if (!flatText.trim()) {
      return [
        {
          annotations:
            'DWG file parsed successfully but no text entities found. The drawing may contain only geometry.',
          rawData: {
            source: 'dwg',
            method: 'libredwg',
            extracted: false,
            entityCount: db.entities?.length ?? 0,
          },
        },
      ]
    }

    const materials = parseMaterialData(flatText, {
      source: 'dwg',
      method: 'libredwg',
      entityCount: db.entities?.length ?? 0,
    })

    for (const m of materials) {
      if (m.rawData && !m.rawData.sourceTrace) {
        m.rawData.sourceTrace = {
          entityType: 'dwg',
          method: 'libredwg',
          entityCount: db.entities?.length ?? 0,
        }
      }
    }

    const deduped = deduplicateMaterials(materials)

    return deduped.length > 0
      ? deduped
      : [
          {
            annotations: flatText.slice(0, 500) + (flatText.length > 500 ? '...' : ''),
            rawData: {
              source: 'dwg',
              method: 'libredwg',
              extracted: true,
              fullTextLength: flatText.length,
            },
          },
        ]
  } finally {
    libredwg.dwg_free(dwgData)
  }
}

/**
 * Process DWG using Autodesk Forge API
 */
async function processWithForgeAPI(filePath: string): Promise<ExtractedMaterial[]> {
  if (!config.forgeApiKey || !config.forgeApiSecret) {
    throw new Error('Autodesk Forge API credentials not configured')
  }
  throw new Error('Autodesk Forge API integration not fully implemented. Using LibreDWG parser instead.')
}

/**
 * Process DWG using Python service with ezdxf
 */
async function processWithPythonService(filePath: string): Promise<ExtractedMaterial[]> {
  if (!config.pythonServiceUrl) {
    throw new Error('Python DWG service URL not configured')
  }
  try {
    const fs = await import('fs/promises')
    const fileBuffer = await fs.readFile(filePath)
    const formData = new FormData()
    const blob = new Blob([fileBuffer])
    formData.append('file', blob, filePath.split('/').pop())

    const response = await fetch(`${config.pythonServiceUrl}/extract`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error(`Python service error: ${response.statusText}`)

    const data = await response.json()
    const text =
      data.text || data.entities?.map((e: { text?: string }) => e.text || '').join('\n') || ''
    return parseMaterialData(text, {
      source: 'dwg',
      entities: data.entities,
      blocks: data.blocks,
      dimensions: data.dimensions,
    })
  } catch (error) {
    throw new Error(
      `Failed to process DWG with Python service: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Basic DWG text extraction (fallback)
 */
async function processBasicDWG(filePath: string): Promise<ExtractedMaterial[]> {
  try {
    const fs = await import('fs/promises')
    const buffer = await fs.readFile(filePath)
    if (!buffer || buffer.length === 0) throw new Error('DWG file is empty or could not be read')

    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000))
    const readableText = text.match(/[A-Za-z0-9\s.,;:()\-]{10,}/g)?.join(' ') || ''
    if (readableText.length < 20) {
      return [
        {
          annotations: 'DWG file could not be parsed. Please ensure the file is a valid DWG format.',
          rawData: { source: 'dwg', method: 'basic', extracted: false, message: 'Basic extraction failed' },
        },
      ]
    }
    const materials = parseMaterialData(readableText, { source: 'dwg', method: 'basic' })
    return materials.length > 0 ? materials : [{ annotations: 'DWG file processed but no material information could be extracted.', rawData: { source: 'dwg', method: 'basic', extracted: false } }]
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return [{ annotations: `DWG file could not be processed: ${msg}`, rawData: { source: 'dwg', method: 'basic', error: msg } }]
  }
}

/**
 * Main function to process DWG files
 */
export async function processDWG(filePath: string): Promise<ExtractedMaterial[]> {
  try {
    return await processWithLibreDWG(filePath)
  } catch (error) {
    console.warn('LibreDWG processing failed:', error instanceof Error ? error.message : error)
  }
  if (config.forgeApiKey && config.forgeApiSecret) {
    try {
      return await processWithForgeAPI(filePath)
    } catch {
      /* noop */
    }
  }
  if (config.pythonServiceUrl) {
    try {
      return await processWithPythonService(filePath)
    } catch {
      /* noop */
    }
  }
  const materials = await processBasicDWG(filePath)
  if (materials.length === 0) {
    return [
      {
        annotations: 'DWG file could not be processed. LibreDWG failed and no alternative is configured.',
        rawData: { source: 'dwg', message: 'DWG processing requires LibreDWG (included) or configure Forge API / Python service' },
      },
    ]
  }
  return materials
}

export function isDWGProcessingAvailable(): boolean {
  return true
}
