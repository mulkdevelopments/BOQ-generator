'use client'

import { useState, useEffect } from 'react'

interface DrawingViewerProps {
  filePath: string
  fileType: 'pdf' | 'dwg'
  filename: string
}

export default function DrawingViewer({ filePath, fileType, filename }: DrawingViewerProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  if (fileType === 'pdf') {
    return (
      <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
          <p className="text-sm font-medium text-gray-700">{filename}</p>
        </div>
        <div className="p-4">
          <iframe
            src={`/api/viewer?file=${encodeURIComponent(filePath)}&type=pdf`}
            className="w-full h-[600px] border-0"
            title="PDF Viewer"
            onLoad={() => setLoading(false)}
            onError={() => {
              setError('Failed to load PDF')
              setLoading(false)
            }}
          />
          {loading && (
            <div className="flex items-center justify-center h-[600px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-[600px] text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // DWG files - show download link and info
  return (
    <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
        <p className="text-sm font-medium text-gray-700">{filename}</p>
      </div>
      <div className="p-8 text-center">
        <div className="mb-4">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-gray-600 mb-2">DWG files cannot be previewed in the browser</p>
        <p className="text-sm text-gray-500 mb-4">
          Please use CAD software to view this file
        </p>
        <a
          href={`/api/download?file=${encodeURIComponent(filePath)}`}
          download={filename}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download DWG File
        </a>
      </div>
    </div>
  )
}
