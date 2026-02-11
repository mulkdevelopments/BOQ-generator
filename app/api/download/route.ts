import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, basename } from 'path'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filePath = searchParams.get('file')

    if (!filePath) {
      return new NextResponse('Missing file parameter', { status: 400 })
    }

    const fileName = filePath.startsWith('http') ? basename(new URL(filePath).pathname) || 'download' : basename(filePath) || 'download'
    let fileBuffer: Buffer

    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      const res = await fetch(filePath)
      if (!res.ok) throw new Error('Blob fetch failed')
      fileBuffer = Buffer.from(await res.arrayBuffer())
    } else {
      const normalizedPath = join(process.cwd(), 'uploads', basename(filePath))
      fileBuffer = await readFile(normalizedPath)
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
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
