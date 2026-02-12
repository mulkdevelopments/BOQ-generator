'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { upload as uploadToBlob } from '@vercel/blob/client'

const SERVER_UPLOAD_LIMIT = 4.5 * 1024 * 1024 // 4.5MB - use client upload above this
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

type Phase = 'uploading' | 'extracting'

interface ProgressState {
  currentIndex: number // 1-based
  total: number
  fileName: string
  phase: Phase
  percent: number // 0-100 for current file phase
}

interface FailedFile {
  fileName: string
  error: string
}

interface FileUploadProps {
  onUploadSuccess?: (drawingId: string, projectId: string) => void
  /** When set, new files are added to this project (e.g. from project page). */
  existingProjectId?: string
  /** When adding to a project, filenames already in the project are skipped to avoid duplicates. */
  existingFileNames?: string[]
  /** Compact UI for embedding in project sidebar. */
  compact?: boolean
}

function getAcceptedFiles(files: FileList | null): File[] {
  if (!files?.length) return []
  const list: File[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const name = f.name.toLowerCase()
    if (name.endsWith('.pdf') || name.endsWith('.dwg')) list.push(f)
  }
  return list
}

function validateFile(file: File): string | null {
  const fileName = file.name.toLowerCase()
  const isPDF = fileName.endsWith('.pdf')
  const isDWG = fileName.endsWith('.dwg')

  if (!isPDF && !isDWG) {
    return 'Only PDF and DWG files are allowed'
  }

  if (file.size > MAX_FILE_SIZE) {
    return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
  }

  return null
}

export default function FileUpload({ onUploadSuccess, existingProjectId, existingFileNames = [], compact = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [overallPercent, setOverallPercent] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [failedFiles, setFailedFiles] = useState<FailedFile[]>([])
  const [skippedFiles, setSkippedFiles] = useState<string[]>([])
  const [projectName, setProjectName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()


  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const processOneFile = useCallback(
    async (
      file: File,
      fileIndex: number,
      totalFiles: number,
      projectId: string | null
    ): Promise<{ projectId: string; drawingId: string } | null> => {
      const setPhase = (phase: Phase, percent: number) => {
        setProgress({
          currentIndex: fileIndex + 1,
          total: totalFiles,
          fileName: file.name,
          phase,
          percent,
        })
        const completed = fileIndex * 100
        const current = phase === 'uploading' ? percent / 2 : 50 + percent / 2
        setOverallPercent(Math.round((completed + current) / totalFiles))
      }

      const useClientUpload = file.size > SERVER_UPLOAD_LIMIT
      const fileType = file.name.toLowerCase().endsWith('.dwg') ? 'dwg' : 'pdf'

      let drawingId: string
      let resolvedProjectId: string

      if (useClientUpload) {
        setPhase('uploading', 0)
        const startRes = await fetch('/api/upload-start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: (projectId ?? existingProjectId) ? undefined : projectName.trim() || undefined,
            projectId: projectId ?? existingProjectId ?? undefined,
          }),
        })
        if (!startRes.ok) {
          const data = await startRes.json().catch(() => ({}))
          throw new Error(data.error || 'Could not start upload')
        }
        const startData = await startRes.json()
        drawingId = startData.drawingId
        resolvedProjectId = startData.projectId

        const blob = await uploadToBlob(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/upload-blob',
          clientPayload: JSON.stringify({
            drawingId,
            projectId: resolvedProjectId,
            filename: file.name,
            fileType,
          }),
          multipart: true,
        })
        setPhase('uploading', 100)

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
        setPhase('uploading', 0)
        const formData = new FormData()
        formData.append('file', file)
        const effectiveProjectId = projectId ?? existingProjectId
        if (effectiveProjectId) {
          formData.append('projectId', effectiveProjectId)
        } else if (projectName.trim()) {
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
        resolvedProjectId = data.drawing.projectId
        setPhase('uploading', 100)
      }

      setPhase('extracting', 0)
      const extractResponse = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingId }),
      })
      if (!extractResponse.ok) {
        const extractData = await extractResponse.json().catch(() => ({}))
        const errorMsg = extractData.error || 'Extraction failed'
        const details = extractData.details ? `: ${extractData.details}` : ''
        throw new Error(`${errorMsg}${details}`)
      }
      setPhase('extracting', 100)

      return { projectId: resolvedProjectId, drawingId }
    },
    [projectName, existingProjectId]
  )

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      const validationErrors = files.map((f) => ({ file: f, err: validateFile(f) })).filter((x) => x.err)
      if (validationErrors.length > 0) {
        setError(
          validationErrors.length === 1
            ? validationErrors[0].err!
            : `${validationErrors.length} files invalid: ${validationErrors.map((e) => e.file.name).join(', ')} — only PDF/DWG under 500MB allowed.`
        )
        return
      }

      // Skip files that already exist in the project (when adding to existing project)
      const toProcess: File[] = []
      const skipped: string[] = []
      if (existingFileNames.length > 0) {
        const existingLower = new Set(existingFileNames.map((n) => n.toLowerCase()))
        for (const file of files) {
          if (existingLower.has(file.name.toLowerCase())) skipped.push(file.name)
          else toProcess.push(file)
        }
        setSkippedFiles(skipped)
      } else {
        setSkippedFiles([])
        toProcess.push(...files)
      }

      if (toProcess.length === 0) {
        setError(skipped.length === 1 ? 'This file is already in the project.' : 'All selected files are already in the project.')
        return
      }

      setIsUploading(true)
      setError(null)
      setFailedFiles([])
      setOverallPercent(0)

      let lastProjectId: string | null = null
      let lastDrawingId: string | null = null
      const failed: FailedFile[] = []

      for (let i = 0; i < toProcess.length; i++) {
        try {
          const result = await processOneFile(toProcess[i], i, toProcess.length, existingProjectId ?? lastProjectId)
          if (result) {
            lastProjectId = result.projectId
            lastDrawingId = result.drawingId
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          failed.push({ fileName: toProcess[i].name, error: msg })
        }
      }

      setProgress(null)
      setIsUploading(false)
      setOverallPercent(100)

      if (failed.length > 0) {
        setFailedFiles(failed)
        if (failed.length === toProcess.length) {
          setError('All files failed. See list below.')
        } else {
          setError(`${failed.length} of ${toProcess.length} file(s) failed. See list below.`)
        }
      }

      if (lastProjectId && failed.length < toProcess.length) {
        if (onUploadSuccess) {
          onUploadSuccess(lastDrawingId || '', lastProjectId)
        } else {
          router.push(`/projects/${lastProjectId}`)
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [processOneFile, onUploadSuccess, router, existingProjectId, existingFileNames]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = getAcceptedFiles(e.dataTransfer.files)
      if (files.length) handleFiles(files)
    },
    [handleFiles]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = getAcceptedFiles(e.target.files)
    if (files.length) handleFiles(files)
  }

  const inputId = compact ? 'file-upload-compact' : 'file-upload'

  return (
    <div className={compact ? 'w-full' : 'w-full'}>
      {!compact && (
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
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg text-center transition-colors
          ${compact ? 'p-4' : 'p-12'}
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          id={inputId}
          accept=".pdf,.dwg"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        <label
          htmlFor={inputId}
          className="cursor-pointer flex flex-col items-center"
        >
          <svg
            className={compact ? 'w-10 h-10 text-gray-400 mb-2' : 'w-16 h-16 text-gray-400 mb-4'}
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
          <p className={compact ? 'text-sm font-medium text-gray-700' : 'text-lg font-medium text-gray-700 mb-2'}>
            {isUploading
              ? 'Processing...'
              : compact
                ? 'Add files (PDF/DWG)'
                : 'Drag and drop your files here or click to browse'}
          </p>
          {!compact && (
            <p className="text-sm text-gray-500 mb-4">
              PDF and DWG • Multiple files • Max 500MB each
            </p>
          )}
        </label>

        {progress && (
          <div className={compact ? 'mt-2 w-full text-left' : 'mt-4 w-full max-w-md mx-auto text-left'}>
            <p className="text-sm font-medium text-gray-700 mb-1">
              File {progress.currentIndex} of {progress.total}: {progress.fileName}
            </p>
            <p className="text-xs text-gray-500 mb-2 capitalize">
              {progress.phase}… {progress.percent < 100 ? `${Math.round(progress.percent)}%` : 'done'}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">Overall: {overallPercent}%</p>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        )}

        {failedFiles.length > 0 && (
          <div className={compact ? 'mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-left text-xs' : 'mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left max-w-md mx-auto'}>
            <p className="text-sm font-medium text-amber-800 mb-2">Failed files:</p>
            <ul className="text-xs text-amber-700 space-y-1">
              {failedFiles.map((f, i) => (
                <li key={i}>
                  <span className="font-medium">{f.fileName}</span> — {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {skippedFiles.length > 0 && (
          <div className={compact ? 'mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-left text-xs' : 'mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-left max-w-md mx-auto'}>
            <p className="text-sm font-medium text-slate-700 mb-1">Already in project (skipped):</p>
            <ul className="text-xs text-slate-600">
              {skippedFiles.map((name, i) => (
                <li key={i} className="truncate">{name}</li>
              ))}
            </ul>
          </div>
        )}

        {error && failedFiles.length === 0 && (
          <div className={compact ? 'mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm' : 'mt-4 p-3 bg-red-50 border border-red-200 rounded-lg'}>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
