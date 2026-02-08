import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { materialsToCsv } from '@/lib/export-csv'

/**
 * Export project/drawing materials as CSV (DataFrame / open format)
 * DDC principle: Elements as rows, properties as columns
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const drawingId = searchParams.get('drawingId')

    if (!projectId && !drawingId) {
      return NextResponse.json(
        { error: 'Provide projectId or drawingId' },
        { status: 400 }
      )
    }

    const extractedData = await prisma.extractedData.findMany({
      where: drawingId
        ? { drawingId }
        : { drawing: { projectId: projectId! } },
      include: { drawing: true },
      orderBy: { createdAt: 'asc' },
    })

    const materials = extractedData.map((d) => ({
      materialType: d.materialType ?? undefined,
      dimensions: d.dimensions ?? undefined,
      quantity: d.quantity ?? undefined,
      annotations: d.annotations ?? undefined,
      confidence: d.confidence as 'confirmed' | 'estimated' | 'missing' | undefined,
      rawData: d.rawData ? JSON.parse(d.rawData) : {},
    }))

    const csv = materialsToCsv(materials)
    const filename = drawingId
      ? `drawing-materials-${drawingId.slice(0, 8)}.csv`
      : `project-materials-${projectId!.slice(0, 8)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
