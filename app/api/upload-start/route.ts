import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Start a client upload: create Project and Drawing with placeholder path.
 * Client will upload file to Blob and we set the real URL in upload-blob's onUploadCompleted.
 */
export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Client upload is not configured (no Blob store)' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const projectName = typeof body.projectName === 'string' ? body.projectName.trim() : ''

    const project = await prisma.project.create({
      data: {
        name: projectName || `Project ${new Date().toLocaleString()}`,
      },
    })

    const drawing = await prisma.drawing.create({
      data: {
        projectId: project.id,
        filename: 'pending',
        fileType: 'pdf',
        filePath: 'pending-client-upload',
        status: 'pending',
      },
    })

    return NextResponse.json({
      drawingId: drawing.id,
      projectId: project.id,
      projectName: project.name,
    })
  } catch (error) {
    console.error('Upload start error:', error)
    return NextResponse.json(
      { error: 'Failed to start upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
