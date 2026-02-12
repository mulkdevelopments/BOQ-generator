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
      rate?: number | null
      unit?: string | null
      currency?: string | null
      source?: string | null
    } = {}

    if (body.rate !== undefined) {
      data.rate =
        typeof body.rate === 'number'
          ? body.rate
          : typeof body.rate === 'string'
          ? parseFloat(body.rate) || null
          : null
    }
    if (body.unit !== undefined) {
      data.unit =
        typeof body.unit === 'string' ? body.unit.trim() || null : null
    }
    if (body.currency !== undefined) {
      data.currency =
        typeof body.currency === 'string'
          ? body.currency.trim().toUpperCase() || null
          : null
    }
    if (body.source !== undefined) {
      data.source =
        typeof body.source === 'string' ? body.source.trim() || null : null
    }

    const updated = await prisma.materialRate.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ rate: updated })
  } catch (error) {
    console.error('Rates PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to update rate' },
      { status: 500 }
    )
  }
}

