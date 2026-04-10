/**
 * ELLA Square API client.
 * /api/* routes are proxied to the Azure Functions backend (vite dev proxy or
 * Azure Static Web Apps linked Functions app in production).
 */

import type { ChatRequest, ChatResponseChunk, KnowledgeFile, KnowledgeStats } from '../types'

const BASE = '/api'

// ─── Chat (SSE streaming) ─────────────────────────────────────────────────────

export async function* streamChat(
  req: ChatRequest,
  signal?: AbortSignal
): AsyncGenerator<ChatResponseChunk> {
  const response = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(req),
    signal,
  })

  if (!response.ok) throw new Error(`Chat API ${response.status}`)

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const chunk = JSON.parse(line.slice(6)) as ChatResponseChunk
          yield chunk
          if (chunk.type === 'done' || chunk.type === 'error') return
        } catch {
          // skip malformed line
        }
      }
    }
  }
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export interface ListFilesResponse {
  files: KnowledgeFile[]
  stats: KnowledgeStats
}

export async function listFiles(domainId: string): Promise<ListFilesResponse> {
  const r = await fetch(`${BASE}/knowledge/files?domain=${domainId}`)
  if (!r.ok) throw new Error(`Knowledge API ${r.status}`)
  return r.json()
}

export async function uploadFile(domainId: string, file: File): Promise<{ fileId: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('domain', domainId)
  const r = await fetch(`${BASE}/knowledge/upload`, { method: 'POST', body: form })
  if (!r.ok) throw new Error(`Upload failed ${r.status}`)
  return r.json()
}

export async function deleteFile(fileId: string): Promise<void> {
  const r = await fetch(`${BASE}/knowledge/files/${fileId}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`Delete failed ${r.status}`)
}

export async function triggerReindex(domainId: string): Promise<void> {
  const r = await fetch(`${BASE}/knowledge/reindex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: domainId }),
  })
  if (!r.ok) throw new Error(`Reindex failed ${r.status}`)
}

export async function syncBlob(domainId: string, container: string): Promise<void> {
  const r = await fetch(`${BASE}/knowledge/sync/blob`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: domainId, container }),
  })
  if (!r.ok) throw new Error(`Blob sync failed ${r.status}`)
}

export async function syncSharePoint(domainId: string, siteUrl: string): Promise<void> {
  const r = await fetch(`${BASE}/knowledge/sync/sharepoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: domainId, siteUrl }),
  })
  if (!r.ok) throw new Error(`SharePoint sync failed ${r.status}`)
}

// ─── Domains ──────────────────────────────────────────────────────────────────

export async function getDomains() {
  const r = await fetch(`${BASE}/domains`)
  if (!r.ok) throw new Error(`Domains API ${r.status}`)
  return r.json()
}
