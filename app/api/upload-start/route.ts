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
    const existingProjectId = typeof body.projectId === 'string' ? body.projectId.trim() : undefined

    let projectId: string
    let projectNameOut: string

    if (existingProjectId) {
      const project = await prisma.project.findUnique({
        where: { id: existingProjectId },
      })
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      projectId = project.id
      projectNameOut = project.name
    } else {
      const project = await prisma.project.create({
        data: {
          name: projectName || `Project ${new Date().toLocaleString()}`,
        },
      })
      projectId = project.id
      projectNameOut = project.name
    }

    const drawing = await prisma.drawing.create({
      data: {
        projectId,
        filename: 'pending',
        fileType: 'pdf',
        filePath: 'pending-client-upload',
        status: 'pending',
      },
    })

    return NextResponse.json({
      drawingId: drawing.id,
      projectId,
      projectName: projectNameOut,
    })
  } catch (error) {
    console.error('Upload start error:', error)
    return NextResponse.json(
      { error: 'Failed to start upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
