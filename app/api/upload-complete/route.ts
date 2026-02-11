import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Client calls this after upload() resolves, passing the blob URL.
 * Works locally (where onUploadCompleted webhook is never called) and in production.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { drawingId, blobUrl, filename, fileType } = body as {
      drawingId?: string
      blobUrl?: string
      filename?: string
      fileType?: string
    }

    if (!drawingId || !blobUrl || typeof blobUrl !== 'string' || !blobUrl.startsWith('http')) {
      return NextResponse.json(
        { error: 'drawingId and blobUrl (http URL) are required' },
        { status: 400 }
      )
    }

    const drawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
    })

    if (!drawing) {
      return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })
    }

    if (drawing.filePath !== 'pending-client-upload') {
      return NextResponse.json({ ok: true, message: 'Already completed' })
    }

    await prisma.drawing.update({
      where: { id: drawingId },
      data: {
        filePath: blobUrl,
        filename: typeof filename === 'string' && filename ? filename : drawing.filename,
        fileType: fileType === 'dwg' || fileType === 'pdf' ? fileType : drawing.fileType,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Upload complete error:', error)
    return NextResponse.json(
      { error: 'Failed to complete upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
