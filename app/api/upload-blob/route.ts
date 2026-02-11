import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB for client upload

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Blob not configured' }, { status: 503 })
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        const payload = clientPayload ? (JSON.parse(clientPayload) as { drawingId?: string; projectId?: string; filename?: string; fileType?: string }) : null
        const drawingId = payload?.drawingId
        const projectId = payload?.projectId

        if (!drawingId || !projectId) {
          throw new Error('Missing drawingId or projectId in client payload')
        }

        const drawing = await prisma.drawing.findFirst({
          where: { id: drawingId, projectId },
        })
        if (!drawing) {
          throw new Error('Drawing not found')
        }

        return {
          allowedContentTypes: ['application/pdf', 'application/octet-stream', 'application/acad', 'application/x-dwg', 'image/vnd.dwg'],
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            drawingId,
            projectId,
            filename: payload.filename ?? pathname.split('/').pop() ?? 'file',
            fileType: payload.fileType ?? (pathname.toLowerCase().endsWith('.dwg') ? 'dwg' : 'pdf'),
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) return
        try {
          const { drawingId, filename, fileType } = JSON.parse(tokenPayload) as { drawingId: string; filename?: string; fileType?: string }
          await prisma.drawing.update({
            where: { id: drawingId },
            data: {
              filePath: blob.url,
              filename: filename ?? blob.pathname?.split('/').pop() ?? 'file',
              fileType: fileType ?? 'pdf',
            },
          })
        } catch (e) {
          console.error('onUploadCompleted error:', e)
          throw new Error('Could not update drawing')
        }
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Upload blob error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    )
  }
}
