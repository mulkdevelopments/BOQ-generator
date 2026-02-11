import './pdf-polyfill'
import fs from 'fs/promises'
import { parseMaterialData } from './material-parser'
import { deduplicateMaterials } from './deduplicate-materials'
import { ExtractedMaterial } from '@/types'

// Import pdf-parse v2 - it exports PDFParse as a class
const pdfParseModule = require('pdf-parse')
const PDFParse = pdfParseModule.PDFParse

if (!PDFParse) {
  throw new Error('PDFParse class not found in pdf-parse module. Please check pdf-parse installation.')
}

/**
 * Extract text and metadata from PDF file
 * Uses getText with table-friendly params and getTable for structured table data
 */
export async function extractFromPDF(filePath: string): Promise<{
  text: string
  metadata: {
    pages: number
    info: Record<string, unknown>
  }
}> {
  try {
    const dataBuffer = await fs.readFile(filePath)

    if (!dataBuffer || dataBuffer.length === 0) {
      throw new Error('PDF file is empty or could not be read')
    }

    const parser = new PDFParse({ data: dataBuffer })
    const textResult = await parser.getText()
    const extractedText = (textResult.text || '').trim()

    try {
      await parser.destroy()
    } catch {
      /* ignore */
    }

    const pageCount = textResult.total ?? (textResult as { numpages?: number }).numpages ?? 0

    return {
      text: extractedText,
      metadata: {
        pages: typeof pageCount === 'number' ? pageCount : 0,
        info: (textResult as { info?: Record<string, unknown> }).info || {},
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('PDF extraction error:', {
      filePath,
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    })
    throw new Error(`Failed to extract PDF: ${errorMessage}`)
  }
}

/**
 * Process PDF file and extract material information
 */
export async function processPDF(filePath: string): Promise<ExtractedMaterial[]> {
  try {
    const { text, metadata } = await extractFromPDF(filePath)
    
    // If no text extracted, return empty array with annotation
    if (!text || text.trim().length === 0) {
      console.warn('No text extracted from PDF:', filePath)
      return [{
        annotations: 'PDF file processed but no text content found. This may be a scanned image PDF.',
        rawData: {
          source: 'pdf',
          pages: metadata.pages,
          hasText: false,
        }
      }]
    }
    
    // Parse the extracted text for material information
    const materials = parseMaterialData(text, {
      source: 'pdf',
      pages: metadata.pages,
      info: metadata.info,
    })
    for (const m of materials) {
      if (m.rawData) {
        m.rawData.sourceTrace = { entityType: 'pdf', pageNumber: metadata.pages }
      }
    }
    return deduplicateMaterials(materials)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('PDF processing error:', {
      filePath,
      error: errorMessage,
    })
    throw new Error(`Failed to process PDF: ${errorMessage}`)
  }
}

/**
 * Extract annotations and comments from PDF (if available)
 */
export async function extractPDFAnnotations(filePath: string): Promise<string[]> {
  try {
    const dataBuffer = await fs.readFile(filePath)
    const parser = new PDFParse({ data: dataBuffer })
    const result = await parser.getText()
    try {
      await parser.destroy()
    } catch {
      /* ignore */
    }
    
    // pdf-parse extracts text, but annotations might be in the text itself
    // For more advanced annotation extraction, we'd need pdf.js or similar
    const annotations: string[] = []
    
    // Look for common annotation patterns in the text
    const text = result.text || ''
    const lines = text.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      // Look for lines that might be annotations (short, contain keywords)
      if (trimmed.length > 0 && trimmed.length < 200) {
        if (
          trimmed.toLowerCase().includes('note') ||
          trimmed.toLowerCase().includes('remark') ||
          trimmed.toLowerCase().includes('comment') ||
          trimmed.match(/^[A-Z][a-z]+:/) // Looks like a label
        ) {
          annotations.push(trimmed)
        }
      }
    }
    
    return annotations
  } catch (error) {
    console.error('Error extracting PDF annotations:', error)
    return []
  }
}
