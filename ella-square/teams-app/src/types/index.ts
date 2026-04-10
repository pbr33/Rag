// ─── Chat types ──────────────────────────────────────────────────────────────

export interface Source {
  name: string
  kind: 'document' | 'web'
  url?: string
}

export interface MessageMeta {
  latencyMs: number
  model: string
  docCount: number
  webCount: number
  safetyPassed: boolean
  isPrivate: boolean
  sources: Source[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  meta?: MessageMeta
}

export interface Chat {
  id: string
  title: string
  domainId: string
  messages: Message[]
  memoryOn: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Domain {
  id: string
  name: string
  color: string
  abbr: string
}

// ─── Knowledge types ──────────────────────────────────────────────────────────

export type FileType = 'xlsx' | 'pdf' | 'docx' | 'pptx' | 'txt' | 'csv'
export type FileSource = 'manual' | 'blob' | 'sharepoint' | 'onelake'
export type FileStatus = 'ready' | 'indexing' | 'queued' | 'failed'
export type ProgressStage = 'chunking' | 'embedding'

export interface KnowledgeFile {
  id: string
  name: string
  type: FileType
  source: FileSource
  sourcePath?: string
  sizeBytes: number
  status: FileStatus
  chunks?: number
  progressCurrent?: number
  progressTotal?: number
  progressStage?: ProgressStage
  label?: 'confidential' | 'internal' | 'public'
  updatedAt: Date
}

export interface KnowledgeStats {
  documentsIndexed: number
  chunksKb: number
  ingestingNow: number
  lastRefreshAt: Date
}

// ─── API types ────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string
  domainId: string
  chatId: string
  memoryOn: boolean
  tools: { documents: boolean; web: boolean }
}

export interface ChatResponseChunk {
  type: 'meta' | 'token' | 'sources' | 'done' | 'error'
  data: unknown
}
