'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { upload as uploadToBlob } from '@vercel/blob/client'

const SERVER_UPLOAD_LIMIT = 4.5 * 1024 * 1024 // 4.5MB - use client upload above this

interface FileUploadProps {
  onUploadSuccess?: (drawingId: string, projectId: string) => void
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const router = useRouter()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const validateFile = (file: File): string | null => {
    const fileName = file.name.toLowerCase()
    const isPDF = fileName.endsWith('.pdf')
    const isDWG = fileName.endsWith('.dwg')

    if (!isPDF && !isDWG) {
      return 'Only PDF and DWG files are allowed'
    }

    const maxSize = 500 * 1024 * 1024 // 500MB
    if (file.size > maxSize) {
      return `File size must be less than ${maxSize / 1024 / 1024}MB`
    }

    return null
  }

  const handleFileUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    const useClientUpload = file.size > SERVER_UPLOAD_LIMIT
    const fileType = file.name.toLowerCase().endsWith('.dwg') ? 'dwg' : 'pdf'

    try {
      let drawingId: string
      let projectId: string

      if (useClientUpload) {
        // Large file: client upload to Blob (no 4.5MB server limit)
        const startRes = await fetch('/api/upload-start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectName: projectName.trim() || undefined }),
        })
        if (!startRes.ok) {
          const data = await startRes.json().catch(() => ({}))
          throw new Error(data.error || 'Could not start upload')
        }
        const startData = await startRes.json()
        drawingId = startData.drawingId
        projectId = startData.projectId

        const blob = await uploadToBlob(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/upload-blob',
          clientPayload: JSON.stringify({
            drawingId,
            projectId,
            filename: file.name,
            fileType,
          }),
          multipart: true,
        })
        const completeRes = await fetch('/api/upload-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drawingId,
            blobUrl: blob.url,
            filename: file.name,
            fileType,
          }),
        })
        if (!completeRes.ok) {
          const data = await completeRes.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to complete upload')
        }
      } else {
        // Small file: traditional server upload
        const formData = new FormData()
        formData.append('file', file)
        if (projectName.trim()) {
          formData.append('projectName', projectName.trim())
        }
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: 'Upload failed' }))
          throw new Error(data.error || 'Upload failed')
        }
        const data = await response.json()
        drawingId = data.drawing.id
        projectId = data.drawing.projectId
      }

      setUploadProgress(100)

      const extractResponse = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingId }),
      })

      if (!extractResponse.ok) {
        const extractData = await extractResponse.json().catch(() => ({ error: 'Extraction failed', details: 'Could not parse error response' }))
        const errorMsg = extractData.error || 'Extraction failed'
        const errorDetails = extractData.details ? `: ${extractData.details}` : ''
        throw new Error(`${errorMsg}${errorDetails}`)
      }

      if (onUploadSuccess) {
        onUploadSuccess(drawingId, projectId)
      } else {
        router.push(`/projects/${projectId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [projectName, onUploadSuccess, router])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleFileUpload(file)
      }
    },
    [handleFileUpload]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
          Project Name (Optional)
        </label>
        <input
          type="text"
          id="projectName"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Enter project name..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isUploading}
        />
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
        `}
      >
        <input
          type="file"
          id="file-upload"
          accept=".pdf,.dwg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <svg
            className="w-16 h-16 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-lg font-medium text-gray-700 mb-2">
            {isUploading ? 'Uploading...' : 'Drag and drop your file here'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            or click to browse
          </p>
          <p className="text-xs text-gray-400">
            Supports PDF and DWG files (max 500MB)
          </p>
        </label>

        {isUploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
