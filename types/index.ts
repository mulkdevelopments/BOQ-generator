export type Confidence = 'confirmed' | 'estimated' | 'missing'

export interface ExtractedMaterial {
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
