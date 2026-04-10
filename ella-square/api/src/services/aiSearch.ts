/**
 * Azure AI Search wrapper.
 * Performs hybrid retrieval: vector similarity (HNSW) + BM25 keyword,
 * then applies semantic re-ranking with a Reciprocal Rank Fusion merge.
 *
 * Index schema (per domain):
 *  id (string, key), content (string, searchable), contentVector (float32, 1536-dim),
 *  sourceName (string, filterable), sourceUrl (string), label (string, filterable),
 *  domainId (string, filterable), chunkIndex (int32), pageNumber (int32)
 */

import { SearchClient, AzureKeyCredential } from '@azure/search-documents'
import { embedText } from './openai'

const SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT!
const SEARCH_KEY      = process.env.AZURE_SEARCH_API_KEY!

const INDEX_MAP: Record<string, string> = {
  finance: process.env.AZURE_SEARCH_INDEX_FINANCE ?? 'ella-finance',
  hr:      process.env.AZURE_SEARCH_INDEX_HR      ?? 'ella-hr',
  legal:   process.env.AZURE_SEARCH_INDEX_LEGAL   ?? 'ella-legal',
}

export interface SearchChunk {
  id: string
  content: string
  sourceName: string
  sourceUrl?: string
  score: number
  pageNumber?: number
}

export async function hybridSearch(
  query: string,
  domainId: string,
  topK = 6
): Promise<SearchChunk[]> {
  const indexName = INDEX_MAP[domainId]
  if (!indexName) throw new Error(`Unknown domain: ${domainId}`)

  const client = new SearchClient<Record<string, unknown>>(
    SEARCH_ENDPOINT,
    indexName,
    new AzureKeyCredential(SEARCH_KEY)
  )

  // Generate query embedding
  const queryVector = await embedText(query)

  const results = await client.search(query, {
    vectorSearchOptions: {
      queries: [
        {
          kind: 'vector',
          vector: queryVector,
          kNearestNeighborsCount: topK * 2,
          fields: ['contentVector'],
        },
      ],
    },
    queryType: 'semantic',
    semanticSearchOptions: {
      configurationName: 'ella-semantic',
    },
    top: topK,
    select: ['id', 'content', 'sourceName', 'sourceUrl', 'pageNumber'],
  })

  const chunks: SearchChunk[] = []
  for await (const r of results.results) {
    const doc = r.document as Record<string, unknown>
    chunks.push({
      id:         String(doc.id ?? ''),
      content:    String(doc.content ?? ''),
      sourceName: String(doc.sourceName ?? 'Unknown'),
      sourceUrl:  doc.sourceUrl ? String(doc.sourceUrl) : undefined,
      score:      r.score ?? 0,
      pageNumber: doc.pageNumber != null ? Number(doc.pageNumber) : undefined,
    })
  }

  return chunks
}

export function buildContext(chunks: SearchChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] ${c.sourceName}${c.pageNumber ? ` (p.${c.pageNumber})` : ''}\n${c.content}`)
    .join('\n\n---\n\n')
}
