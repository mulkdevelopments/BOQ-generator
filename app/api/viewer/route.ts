import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filePath = searchParams.get('file')
    const type = searchParams.get('type')

    if (!filePath || !type) {
      return new NextResponse('Missing file or type parameter', { status: 400 })
    }

    // Security: Ensure file is in uploads directory
    const normalizedPath = join(process.cwd(), 'uploads', filePath.split('/').pop() || '')
    
    if (type === 'pdf') {
      const fileBuffer = await readFile(normalizedPath)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
        },
      })
    }

    return new NextResponse('Unsupported file type', { status: 400 })
  } catch (error) {
    console.error('Viewer error:', error)
    return new NextResponse('File not found', { status: 404 })
  }
}
