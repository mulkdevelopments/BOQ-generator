import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeFile, unlink } from 'fs/promises'
import { prisma } from '@/lib/db'
import { processPDF } from '@/lib/pdf-extractor'
import { processDWG } from '@/lib/dwg-processor'
import { ExtractedMaterial } from '@/types'

/** Resolve file path: if URL, download to temp dir and return local path. */
async function resolveFilePath(filePath: string, drawingId: string, fileType: string): Promise<string> {
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    const res = await fetch(filePath)
    if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const ext = fileType === 'pdf' ? '.pdf' : '.dwg'
    const tmpPath = join(tmpdir(), `drawing-${drawingId}${ext}`)
    await writeFile(tmpPath, buffer)
    return tmpPath
  }
  return filePath
}

export async function POST(request: NextRequest) {
  try {
    const { drawingId } = await request.json()

    if (!drawingId) {
      return NextResponse.json(
        { error: 'Drawing ID is required' },
        { status: 400 }
      )
    }

    // Get drawing from database
    let drawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
    })

    if (!drawing) {
      return NextResponse.json(
        { error: 'Drawing not found' },
        { status: 404 }
      )
    }

    // Client upload: onUploadCompleted may run after the client gets the response. Wait for blob URL.
    if (drawing.filePath === 'pending-client-upload') {
      const maxWaitMs = 20000
      const pollIntervalMs = 500
      const deadline = Date.now() + maxWaitMs
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, pollIntervalMs))
        const updated = await prisma.drawing.findUnique({ where: { id: drawingId } })
        if (updated && updated.filePath !== 'pending-client-upload' && updated.filePath.startsWith('http')) {
          drawing = updated
          break
        }
      }
      if (drawing.filePath === 'pending-client-upload') {
        return NextResponse.json(
          { error: 'Upload still processing. Please try extraction again in a few seconds.' },
          { status: 503 }
        )
      }
    }

    // Update status to processing
    await prisma.drawing.update({
      where: { id: drawingId },
      data: { status: 'processing' },
    })

    let localPath: string | null = null

    try {
      let materials: ExtractedMaterial[] = []

      const filePath = await resolveFilePath(drawing.filePath, drawing.id, drawing.fileType)
      localPath = (drawing.filePath.startsWith('http://') || drawing.filePath.startsWith('https://')) ? filePath : null

      const fs = await import('fs/promises')
      try {
        await fs.access(filePath)
      } catch (accessError) {
        throw new Error(`File not found at path: ${drawing.filePath}`)
      }

      // Process based on file type
      if (drawing.fileType === 'pdf') {
        console.log(`Processing PDF: ${filePath}`)
        materials = await processPDF(filePath)
        console.log(`Extracted ${materials.length} materials from PDF`)
      } else if (drawing.fileType === 'dwg') {
        console.log(`Processing DWG: ${filePath}`)
        materials = await processDWG(filePath)
        console.log(`Extracted ${materials.length} materials from DWG`)
      } else {
        throw new Error(`Unsupported file type: ${drawing.fileType}`)
      }

      // Ensure we have at least an empty array
      if (!materials || !Array.isArray(materials)) {
        console.warn('No materials extracted, creating empty result')
        materials = []
      }

      // Save extracted data to database (materials already deduplicated by processor)
      if (materials.length > 0) {
        for (const material of materials) {
          try {
            await prisma.extractedData.create({
              data: {
                drawingId: drawing.id,
                materialType: material.materialType || null,
                dimensions: material.dimensions || null,
                quantity: material.quantity ?? null,
                annotations: material.annotations || null,
                confidence: material.confidence || null,
                rawData: JSON.stringify(material.rawData || {}),
              },
            })
          } catch (dbError) {
            console.error('Error saving material to database:', dbError)
            // Continue with other materials even if one fails
          }
        }
      } else {
        // Create a placeholder entry if no materials found
        await prisma.extractedData.create({
          data: {
            drawingId: drawing.id,
            annotations: 'No materials extracted from this drawing',
            rawData: JSON.stringify({ source: drawing.fileType, extracted: false }),
          },
        })
      }

      // Update drawing status to completed
      await prisma.drawing.update({
        where: { id: drawingId },
        data: { status: 'completed' },
      })

      return NextResponse.json({
        success: true,
        materials: materials,
        count: materials.length,
      })
    } catch (error) {
      // Update status to error
      await prisma.drawing.update({
        where: { id: drawingId },
        data: { status: 'error' },
      })

      // Log detailed error for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined
      console.error('Extraction error details:', {
        drawingId,
        filePath: drawing.filePath,
        fileType: drawing.fileType,
        error: errorMessage,
        stack: errorStack,
      })

      throw error
    } finally {
      if (localPath) {
        try {
          await unlink(localPath)
        } catch (e) {
          console.warn('Failed to clean up temp file:', localPath, e)
        }
      }
    }
  } catch (error) {
    console.error('Extraction error:', error)
    return NextResponse.json(
      {
        error: 'Failed to extract materials',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
