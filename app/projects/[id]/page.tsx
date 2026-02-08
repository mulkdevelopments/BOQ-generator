'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DrawingViewer from '@/components/DrawingViewer'
import ExtractionResults from '@/components/ExtractionResults'
import { ExtractedMaterial } from '@/types'

interface Drawing {
  id: string
  filename: string
  fileType: 'pdf' | 'dwg'
  filePath: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  createdAt: string
  extractedData: Array<{
    id: string
    materialType: string | null
    dimensions: string | null
    quantity: number | null
    annotations: string | null
    confidence: string | null
    rawData: string
  }>
}

interface Project {
  id: string
  name: string
  createdAt: string
  drawings: Drawing[]
}

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) {
      fetchProject()
    }
  }, [projectId])

  const fetchProject = async () => {
    try {
      const response = await fetch('/api/projects')
      if (!response.ok) {
        throw new Error('Failed to fetch project')
      }
      const data = await response.json()
      const foundProject = data.projects.find((p: Project) => p.id === projectId)
      
      if (!foundProject) {
        setError('Project not found')
        return
      }

      setProject(foundProject)
      if (foundProject.drawings.length > 0) {
        setSelectedDrawing(foundProject.drawings[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const convertExtractedDataToMaterials = (extractedData: Drawing['extractedData']): ExtractedMaterial[] => {
    return extractedData.map(data => ({
      materialType: data.materialType || undefined,
      dimensions: data.dimensions || undefined,
      quantity: data.quantity ?? undefined,
      annotations: data.annotations || undefined,
      confidence: (data.confidence as ExtractedMaterial['confidence']) || undefined,
      rawData: data.rawData ? JSON.parse(data.rawData) : {},
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Project not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const allMaterials: ExtractedMaterial[] = project.drawings.flatMap(drawing =>
    convertExtractedDataToMaterials(drawing.extractedData)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Projects
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-600 mt-1">
            Created {new Date(project.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Drawings List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Drawings</h2>
              <div className="space-y-2">
                {project.drawings.map((drawing) => (
                  <button
                    key={drawing.id}
                    onClick={() => setSelectedDrawing(drawing)}
                    className={`
                      w-full text-left p-3 rounded-lg border transition-colors
                      ${
                        selectedDrawing?.id === drawing.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {drawing.filename}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {drawing.fileType.toUpperCase()} • {drawing.extractedData.length} materials
                        </p>
                      </div>
                      <div className="ml-2">
                        <span
                          className={`
                            px-2 py-1 text-xs rounded-full
                            ${
                              drawing.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : drawing.status === 'processing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : drawing.status === 'error'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }
                          `}
                        >
                          {drawing.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {selectedDrawing && (
              <>
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Drawing: {selectedDrawing.filename}
                  </h2>
                  <DrawingViewer
                    filePath={selectedDrawing.filePath}
                    fileType={selectedDrawing.fileType}
                    filename={selectedDrawing.filename}
                  />
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Extracted Materials
                  </h2>
                  <ExtractionResults
                    materials={convertExtractedDataToMaterials(selectedDrawing.extractedData)}
                    drawingId={selectedDrawing.id}
                    projectId={projectId}
                    status={selectedDrawing.status}
                  />
                </div>
              </>
            )}

            {/* Combined BOM View */}
            {allMaterials.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Combined BOM/BOQ
                </h2>
                <ExtractionResults materials={allMaterials} projectId={projectId} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
