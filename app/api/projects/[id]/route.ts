import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const data: { name?: string; client?: string; consultant?: string; contractor?: string } = {}

    if (typeof body.name === 'string') data.name = body.name.trim() || undefined
    if (body.client !== undefined) data.client = typeof body.client === 'string' ? (body.client.trim() || null) : null
    if (body.consultant !== undefined) data.consultant = typeof body.consultant === 'string' ? (body.consultant.trim() || null) : null
    if (body.contractor !== undefined) data.contractor = typeof body.contractor === 'string' ? (body.contractor.trim() || null) : null

    const updated = await prisma.project.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      client: updated.client,
      consultant: updated.consultant,
      contractor: updated.contractor,
    })
  } catch (error) {
    console.error('Project PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to update project', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
