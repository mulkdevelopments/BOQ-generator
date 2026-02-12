'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DrawingViewer from '@/components/DrawingViewer'
import FileUpload from '@/components/FileUpload'
import ScopeOfWorkBill from '@/components/ScopeOfWorkBill'
import ProjectAssistant from '@/components/ProjectAssistant'
import ProjectRates from '@/components/ProjectRates'
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
  client?: string | null
  consultant?: string | null
  contractor?: string | null
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
  const [rightTab, setRightTab] = useState<'viewer' | 'ai' | 'rates'>('viewer')

  // Adjustable layout widths (desktop)
  const [leftWidth, setLeftWidth] = useState(260) // px
  const [rightWidth, setRightWidth] = useState(440) // px
  const dragState = useRef<{
    side: 'left' | 'right' | null
    startX: number
    startLeft: number
    startRight: number
  }>({ side: null, startX: 0, startLeft: 260, startRight: 440 })

  const beginDrag = useCallback((side: 'left' | 'right') => {
    if (typeof window === 'undefined') return
    dragState.current = {
      side,
      startX: window.event instanceof MouseEvent ? window.event.clientX : 0,
      startLeft: leftWidth,
      startRight: rightWidth,
    }
    document.body.style.userSelect = 'none'
  }, [leftWidth, rightWidth])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleMove = (e: MouseEvent) => {
      const { side, startX, startLeft, startRight } = dragState.current
      if (!side) return

      const delta = e.clientX - startX
      const minSidebar = 180
      const minRight = 320

      if (side === 'left') {
        const next = Math.max(minSidebar, startLeft + delta)
        setLeftWidth(next)
      } else if (side === 'right') {
        const next = Math.max(minRight, startRight - delta)
        setRightWidth(next)
      }
    }

    const handleUp = () => {
      if (dragState.current.side) {
        dragState.current.side = null
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

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
      id: data.id,
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
      <div className="h-screen bg-gray-50 flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center overflow-hidden">
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
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold text-gray-900 truncate">{project.name}</h1>
          <p className="text-sm text-gray-500 hidden sm:inline">
            {project.drawings.length} file(s) · {new Date(project.createdAt).toLocaleString()}
          </p>
        </div>
      </header>

      {/* Three-column layout: sidebar (files) | center (bill) | right (viewer) */}
      <div className="flex-1 flex min-h-0 flex-col lg:flex-row">
        {/* Left: Files sidebar */}
        <aside
          className="shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-white flex flex-col overflow-hidden max-h-48 lg:max-h-none"
          style={{ width: leftWidth }}
        >
          <div className="p-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Files</h2>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 min-h-0">
            {project.drawings.map((drawing) => (
              <button
                key={drawing.id}
                onClick={() => setSelectedDrawing(drawing)}
                className={`
                  w-full text-left p-2.5 rounded-lg transition-colors mb-1
                  ${
                    selectedDrawing?.id === drawing.id
                      ? 'bg-blue-50 border border-blue-200 text-blue-900'
                      : 'border border-transparent hover:bg-gray-50 text-gray-700'
                  }
                `}
              >
                <p className="text-sm font-medium truncate" title={drawing.filename}>
                  {drawing.filename}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">{drawing.fileType.toUpperCase()}</span>
                  <span
                    className={`
                      shrink-0 w-2 h-2 rounded-full
                      ${
                        drawing.status === 'completed'
                          ? 'bg-green-500'
                          : drawing.status === 'processing'
                          ? 'bg-amber-500'
                          : drawing.status === 'error'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                      }
                    `}
                    title={drawing.status}
                  />
                </div>
              </button>
            ))}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <FileUpload
                existingProjectId={projectId}
                existingFileNames={project.drawings.map((d) => d.filename)}
                compact
                onUploadSuccess={() => fetchProject()}
              />
            </div>
          </nav>
        </aside>

        {/* Resizer between sidebar and bill (desktop only) */}
        <div
          className="hidden lg:block w-1 cursor-col-resize bg-gray-200 hover:bg-gray-300 shrink-0"
          onMouseDown={() => beginDrag('left')}
        />

        {/* Center: Bill (scope-of-work style BOQ) */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden p-4 lg:p-6">
          <div className="flex-1 bill-scroll overflow-y-auto">
            <div className="max-w-5xl mx-auto">
              <ScopeOfWorkBill
                projectName={project.name}
                client={project.client ?? ''}
                consultant={project.consultant ?? ''}
                contractor={project.contractor ?? ''}
                materials={allMaterials}
                projectId={projectId}
                onSaveSuccess={fetchProject}
              />
            </div>
          </div>
        </main>

        {/* Resizer between bill and viewer (desktop only) */}
        <div
          className="hidden lg:block w-1 cursor-col-resize bg-gray-200 hover:bg-gray-300 shrink-0"
          onMouseDown={() => beginDrag('right')}
        />

        {/* Right: Viewer / AI / Rates */}
        <section
          className="w-full shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col overflow-hidden min-h-[360px] lg:min-h-0"
          style={{ width: rightWidth }}
        >
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setRightTab('viewer')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    rightTab === 'viewer'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Viewer
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('ai')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    rightTab === 'ai'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  AI
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('rates')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    rightTab === 'rates'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Rates
                </button>
              </div>
              {rightTab === 'viewer' && (
                <span className="text-xs text-gray-500 truncate max-w-[180px]">
                  {selectedDrawing ? selectedDrawing.filename : 'No file selected'}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-3">
            {rightTab === 'viewer' && (
              selectedDrawing ? (
                <DrawingViewer
                  filePath={selectedDrawing.filePath}
                  fileType={selectedDrawing.fileType}
                  filename={selectedDrawing.filename}
                />
              ) : (
                <div className="h-full min-h-[320px] flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                  Select a file from the left to preview
                </div>
              )
            )}
            {rightTab === 'ai' && (
              <ProjectAssistant
                projectId={projectId}
                drawings={project.drawings}
                onBillUpdated={fetchProject}
              />
            )}
            {rightTab === 'rates' && <ProjectRates projectId={projectId} />}
          </div>
        </section>
      </div>
      <style jsx>{`
        .bill-scroll {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
        .bill-scroll::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
      `}</style>
    </div>
  )
}
