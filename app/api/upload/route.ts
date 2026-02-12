import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/db'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB (local disk)
const MAX_BLOB_SIZE = 4.5 * 1024 * 1024 // 4.5MB (Vercel Blob server upload limit)

// Configure route for large file uploads
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for large file processing

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectName = formData.get('projectName') as string | null
    const existingProjectId = formData.get('projectId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const fileType = file.type || ''
    const fileName = file.name.toLowerCase()
    const isPDF = fileName.endsWith('.pdf') || fileType === 'application/pdf'
    const isDWG = fileName.endsWith('.dwg') ||
                  fileType === 'application/acad' ||
                  fileType === 'application/x-dwg' ||
                  fileType === 'image/vnd.dwg'

    if (!isPDF && !isDWG) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and DWG files are allowed.' },
        { status: 400 }
      )
    }

    const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
    const maxSize = useBlob ? MAX_BLOB_SIZE : MAX_FILE_SIZE
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: useBlob
            ? `File size exceeds Vercel Blob server limit (${MAX_BLOB_SIZE / 1024 / 1024}MB). Use a smaller file or client upload.`
            : `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileId = uuidv4()
    const fileExtension = isPDF ? '.pdf' : '.dwg'
    const fileNameOnDisk = `${fileId}${fileExtension}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    let storedPath: string

    if (useBlob) {
      const blob = await put(fileNameOnDisk, buffer, {
        access: 'public',
        contentType: isPDF ? 'application/pdf' : 'application/octet-stream',
      })
      storedPath = blob.url
    } else {
      const uploadsDir = join(process.cwd(), 'uploads')
      const filePath = join(uploadsDir, fileNameOnDisk)
      const fs = await import('fs/promises');
      try {
        await fs.access(uploadsDir)
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true })
      }
      await writeFile(filePath, buffer)
      storedPath = filePath
    }

    // Create or get project
    let project
    try {
      if (existingProjectId && existingProjectId.trim()) {
        const existing = await prisma.project.findUnique({
          where: { id: existingProjectId.trim() },
        });
        if (!existing) {
          if (!useBlob && storedPath) {
            try {
              const fs = await import('fs/promises');
              await fs.unlink(storedPath);
            } catch {}
            }
          return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        project = existing;
      } else if (projectName && projectName.trim()) {
        project = await prisma.project.create({
          data: {
            name: projectName.trim(),
          },
        });
      } else {
        project = await prisma.project.create({
          data: {
            name: `Project ${new Date().toLocaleString()}`,
          },
        });
      }
    } catch (dbError) {
      if (!useBlob && storedPath) {
        try {
          const fs = await import('fs/promises');
          await fs.unlink(storedPath);
        } catch (unlinkError) {
          console.error('Failed to clean up file after DB error:', unlinkError);
        }
      }
      throw new Error(`Failed to create project: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
    }

    // Create drawing record
    let drawing
    try {
      drawing = await prisma.drawing.create({
        data: {
          projectId: project.id,
          filename: file.name,
          fileType: isPDF ? 'pdf' : 'dwg',
          filePath: storedPath,
          status: 'pending',
        },
      });
    } catch (dbError) {
      if (!useBlob && storedPath) {
        try {
          const fs = await import('fs/promises');
          await fs.unlink(storedPath);
        } catch (unlinkError) {
          console.error('Failed to clean up file after DB error:', unlinkError);
        }
      }
      throw new Error(`Failed to create drawing record: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
    }

    return NextResponse.json({
      success: true,
      drawing: {
        id: drawing.id,
        filename: drawing.filename,
        fileType: drawing.fileType,
        status: drawing.status,
        projectId: project.id,
        projectName: project.name,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
