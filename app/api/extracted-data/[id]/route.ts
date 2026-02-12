import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const data: {
      materialType?: string
      dimensions?: string
      quantity?: number
      annotations?: string
      rawData?: string
    } = {}

    if (typeof body.materialType === 'string') data.materialType = body.materialType
    if (typeof body.dimensions === 'string') data.dimensions = body.dimensions
    if (typeof body.quantity === 'number') data.quantity = body.quantity
    if (typeof body.annotations === 'string') data.annotations = body.annotations
    if (body.rawData !== undefined) {
      data.rawData = typeof body.rawData === 'string' ? body.rawData : JSON.stringify(body.rawData ?? {})
    }

    const updated = await prisma.extractedData.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      id: updated.id,
      materialType: updated.materialType,
      dimensions: updated.dimensions,
      quantity: updated.quantity,
      annotations: updated.annotations,
      rawData: updated.rawData,
    })
  } catch (error) {
    console.error('ExtractedData PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to update row', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
