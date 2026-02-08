import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { processPDF } from '@/lib/pdf-extractor'
import { processDWG } from '@/lib/dwg-processor'
import { ExtractedMaterial } from '@/types'

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
    const drawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
    })

    if (!drawing) {
      return NextResponse.json(
        { error: 'Drawing not found' },
        { status: 404 }
      )
    }

    // Update status to processing
    await prisma.drawing.update({
      where: { id: drawingId },
      data: { status: 'processing' },
    })

    try {
      let materials: ExtractedMaterial[] = []

      // Check if file exists
      const fs = await import('fs/promises')
      try {
        await fs.access(drawing.filePath)
      } catch (accessError) {
        throw new Error(`File not found at path: ${drawing.filePath}`)
      }

      // Process based on file type
      if (drawing.fileType === 'pdf') {
        console.log(`Processing PDF: ${drawing.filePath}`)
        materials = await processPDF(drawing.filePath)
        console.log(`Extracted ${materials.length} materials from PDF`)
      } else if (drawing.fileType === 'dwg') {
        console.log(`Processing DWG: ${drawing.filePath}`)
        materials = await processDWG(drawing.filePath)
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
