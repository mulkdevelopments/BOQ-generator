export type Confidence = 'confirmed' | 'estimated' | 'missing'

export interface ExtractedMaterial {
  id?: string // DB id when loaded from project (for saving edits)
  materialType?: string
  dimensions?: string
  quantity?: number
  annotations?: string
  rawData?: Record<string, any>
  confidence?: Confidence
}

export interface DrawingMetadata {
  id: string
  filename: string
  fileType: 'pdf' | 'dwg'
  filePath: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  createdAt: Date
}

export interface ProjectData {
  id: string
  name: string
  createdAt: Date
  drawings: DrawingMetadata[]
}

export interface ExtractionResult {
  success: boolean
  materials: ExtractedMaterial[]
  error?: string
}
