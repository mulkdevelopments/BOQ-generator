export type EntityType =
  | 'TEXT'
  | 'MTEXT'
  | 'DIMENSION'
  | 'ATTRIB'
  | 'ATTDEF'
  | 'ACAD_TABLE_CELL'
  | 'LEADER'

export type ColumnRole = '' | 'desc' | 'qty' | 'size'

export interface TextChunk {
  text: string
  entityType: EntityType
  layer?: string
  blockName?: string
  // For table cells only:
  rowIndex?: number
  colIndex?: number
  tableName?: string
}

export interface TableRow {
  cells: string[]
  columnRoles?: ColumnRole[]
  rowIndex: number
  tableName?: string
}
