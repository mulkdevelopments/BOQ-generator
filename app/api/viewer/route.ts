import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, basename } from 'path'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filePath = searchParams.get('file')
    const type = searchParams.get('type')

    if (!filePath || !type) {
      return new NextResponse('Missing file or type parameter', { status: 400 })
    }

    if (type !== 'pdf') {
      return new NextResponse('Unsupported file type', { status: 400 })
    }

    let fileBuffer: Buffer
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      const res = await fetch(filePath)
      if (!res.ok) throw new Error('Blob fetch failed')
      fileBuffer = Buffer.from(await res.arrayBuffer())
    } else {
      const fileName = basename(filePath)
      const normalizedPath = join(process.cwd(), 'uploads', fileName)
      fileBuffer = await readFile(normalizedPath)
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    console.error('Viewer error:', error)
    return new NextResponse('File not found', { status: 404 })
  }
}
