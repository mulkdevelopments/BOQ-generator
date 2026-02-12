import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''
    const drawingIds: string[] = Array.isArray(body.drawingIds)
      ? body.drawingIds.filter((x: unknown): x is string => typeof x === 'string')
      : []
    const question = typeof body.question === 'string' ? body.question.trim() : ''

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    const drawings = await prisma.drawing.findMany({
      where: {
        projectId,
        ...(drawingIds.length > 0 && { id: { in: drawingIds } }),
      },
      include: {
        extractedData: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!drawings.length) {
      return NextResponse.json({
        reply: 'No drawings with extracted data were found for this project.',
      })
    }

    const totalDrawings = drawings.length
    const totalMaterials = drawings.reduce(
      (sum, d) => sum + d.extractedData.length,
      0
    )

    const missingDims = drawings.flatMap((d) =>
      d.extractedData.filter((row) => !row.dimensions || row.dimensions.trim() === '')
    ).length
    const missingQty = drawings.flatMap((d) =>
      d.extractedData.filter(
        (row) => row.quantity === null || row.quantity === undefined
      )
    ).length

    const typesCount: Record<string, number> = {}
    for (const d of drawings) {
      for (const row of d.extractedData) {
        const key = row.materialType || 'other'
        typesCount[key] = (typesCount[key] || 0) + 1
      }
    }

    const topTypes = Object.entries(typesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => `${type || 'other'} (${count})`)
      .join(', ')

    const summaryLines = [
      `I inspected ${totalDrawings} drawing(s) with a total of ${totalMaterials} extracted rows.`,
      topTypes
        ? `Most common material types: ${topTypes}.`
        : 'No clear material types were detected.',
      missingDims || missingQty
        ? `Missing data: ${missingDims} row(s) without dimensions, ${missingQty} row(s) without quantity.`
        : 'All rows appear to have both dimensions and quantity filled.',
    ]

    const replyBase = summaryLines.join(' ')

    let replyDetail = ''
    if (question) {
      replyDetail =
        '\n\n(I am a project-local assistant using existing extracted data. ' +
        'For now I summarise and highlight issues; more advanced AI answers can be wired in later.)'
    }

    return NextResponse.json({
      reply: `${replyBase}${replyDetail}`,
      billUpdated: false,
    })
  } catch (error) {
    console.error('Assistant error:', error)
    return NextResponse.json(
      { error: 'Assistant failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

