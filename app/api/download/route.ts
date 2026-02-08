import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filePath = searchParams.get('file')

    if (!filePath) {
      return new NextResponse('Missing file parameter', { status: 400 })
    }

    // Security: Ensure file is in uploads directory
    const normalizedPath = join(process.cwd(), 'uploads', filePath.split('/').pop() || '')
    const fileName = filePath.split('/').pop() || 'download'
    
    const fileBuffer = await readFile(normalizedPath)
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return new NextResponse('File not found', { status: 404 })
  }
}
