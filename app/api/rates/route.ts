import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    // Find distinct material types used in this project
    const types = await prisma.extractedData.findMany({
      where: { drawing: { projectId } },
      select: { materialType: true },
      distinct: ['materialType'],
    })

    const materialTypes = Array.from(
      new Set(
        types
          .map((t) => (t.materialType || '').trim().toLowerCase())
          .filter(Boolean)
      )
    )

    if (!materialTypes.length) {
      return NextResponse.json({ rates: [] })
    }

    // Load or lazily create rate records for these types
    const existing = await prisma.materialRate.findMany({
      where: { materialType: { in: materialTypes } },
    })

    const existingMap = new Map(
      existing.map((r) => [r.materialType.toLowerCase(), r])
    )

    const toCreate = materialTypes.filter(
      (t) => !existingMap.has(t.toLowerCase())
    )

    if (toCreate.length) {
      const defaults = toCreate.map((mt) => ({
        materialType: mt,
        unit:
          mt === 'glass'
            ? 'sqm'
            : mt === 'acp'
            ? 'sqm'
            : mt === 'aluminum' || mt === 'aluminium'
            ? 'kg'
            : null,
        currency: 'USD',
        source: 'default-table',
      }))
      await prisma.materialRate.createMany({
        data: defaults,
        skipDuplicates: true,
      })
    }

    let rates = await prisma.materialRate.findMany({
      where: { materialType: { in: materialTypes } },
    })

    // Optional: plug into a free metals API for live aluminum / steel prices
    const apiKey = process.env.METALPRICE_API_KEY
    const wantsLive =
      apiKey &&
      materialTypes.some((mt) => /alum|steel/.test(mt.toLowerCase()))

    if (wantsLive) {
      try {
        const resp = await fetch(
          `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=USD`
        )
        const json = await resp.json()
        const liveRates = (json && (json.rates || json.metals)) || {}

        const updates: { id: string; rate: number; source: string }[] = []

        for (const row of rates) {
          const mt = row.materialType.toLowerCase()
          let symbol: string | null = null
          if (mt.includes('alum')) symbol = 'ALU'
          else if (mt.includes('steel')) symbol = 'STL'

          if (!symbol) continue
          const live = liveRates[symbol]
          if (typeof live === 'number' && live > 0) {
            updates.push({
              id: row.id,
              rate: live,
              source: 'api:metalpriceapi',
            })
          }
        }

        if (updates.length) {
          await Promise.all(
            updates.map((u) =>
              prisma.materialRate.update({
                where: { id: u.id },
                data: {
                  rate: u.rate,
                  source: u.source,
                  updatedAt: new Date(),
                },
              })
            )
          )
          rates = await prisma.materialRate.findMany({
            where: { materialType: { in: materialTypes } },
          })
        }
      } catch (err) {
        console.error('Live metals API failed, using stored rates instead:', err)
        // fall back to stored rates
      }
    }

    return NextResponse.json({ rates })
  } catch (error) {
    console.error('Rates GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load rates' },
      { status: 500 }
    )
  }
}


