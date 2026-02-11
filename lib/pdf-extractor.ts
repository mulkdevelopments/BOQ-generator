import fs from 'fs/promises'
import { extractText } from 'unpdf'
import { parseMaterialData } from './material-parser'
import { deduplicateMaterials } from './deduplicate-materials'
import { ExtractedMaterial } from '@/types'

/**
 * Extract text and metadata from PDF file using unpdf (serverless-friendly).
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

    const { totalPages, text } = await extractText(new Uint8Array(dataBuffer), {
      mergePages: true,
    })

    const extractedText = (text ?? '').trim()

    return {
      text: extractedText,
      metadata: {
        pages: totalPages ?? 0,
        info: {},
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
      return [
        {
          annotations:
            'PDF file processed but no text content found. This may be a scanned image PDF.',
          rawData: {
            source: 'pdf',
            pages: metadata.pages,
            hasText: false,
          },
        },
      ]
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
    const { text } = await extractText(new Uint8Array(dataBuffer), {
      mergePages: true,
    })

    const annotations: string[] = []
    const lines = (text ?? '').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length > 0 && trimmed.length < 200) {
        if (
          trimmed.toLowerCase().includes('note') ||
          trimmed.toLowerCase().includes('remark') ||
          trimmed.toLowerCase().includes('comment') ||
          trimmed.match(/^[A-Z][a-z]+:/)
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
