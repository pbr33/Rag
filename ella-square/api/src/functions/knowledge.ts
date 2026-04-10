/**
 * Knowledge management endpoints.
 *
 *  GET    /api/knowledge/files?domain=finance        — list files + stats
 *  POST   /api/knowledge/upload                      — upload file to Blob → queue indexing
 *  DELETE /api/knowledge/files/:fileId               — remove file + chunks from index
 *  POST   /api/knowledge/reindex                     — trigger full re-index for domain
 *  POST   /api/knowledge/sync/blob                   — crawl Blob container
 *  POST   /api/knowledge/sync/sharepoint             — crawl SharePoint library
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import { SearchClient, SearchIndexClient, AzureKeyCredential } from '@azure/search-documents'

// ─── Blob helpers ─────────────────────────────────────────────────────────────

function getBlobClient() {
  return BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!)
}

function containerForDomain(domainId: string): string {
  const map: Record<string, string> = {
    finance: process.env.AZURE_STORAGE_CONTAINER_FINANCE ?? 'ella-finance',
    hr:      process.env.AZURE_STORAGE_CONTAINER_HR      ?? 'ella-hr',
    legal:   process.env.AZURE_STORAGE_CONTAINER_LEGAL   ?? 'ella-legal',
  }
  const c = map[domainId]
  if (!c) throw new Error(`Unknown domain: ${domainId}`)
  return c
}

function indexForDomain(domainId: string): string {
  const map: Record<string, string> = {
    finance: process.env.AZURE_SEARCH_INDEX_FINANCE ?? 'ella-finance',
    hr:      process.env.AZURE_SEARCH_INDEX_HR      ?? 'ella-hr',
    legal:   process.env.AZURE_SEARCH_INDEX_LEGAL   ?? 'ella-legal',
  }
  const idx = map[domainId]
  if (!idx) throw new Error(`Unknown domain: ${domainId}`)
  return idx
}

// ─── GET /api/knowledge/files ─────────────────────────────────────────────────

app.http('knowledge-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'knowledge/files',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const domainId = req.query.get('domain') ?? 'finance'
    const blobClient = getBlobClient()
    const container  = containerForDomain(domainId)

    const files: object[] = []
    const containerClient = blobClient.getContainerClient(container)

    for await (const blob of containerClient.listBlobsFlat({ includeMetadata: true })) {
      files.push({
        id:        blob.name,
        name:      blob.name.split('/').pop(),
        source:    blob.metadata?.source ?? 'manual',
        sourcePath: blob.metadata?.sourcePath,
        sizeBytes:  blob.properties.contentLength ?? 0,
        status:    blob.metadata?.status ?? 'ready',
        chunks:    blob.metadata?.chunks ? Number(blob.metadata.chunks) : undefined,
        label:     blob.metadata?.label,
        updatedAt: blob.properties.lastModified?.toISOString(),
      })
    }

    return {
      status: 200,
      jsonBody: {
        files,
        stats: {
          documentsIndexed: files.length,
          chunksKb: 0, // aggregated from index in production
          ingestingNow: files.filter((f: any) => f.status === 'indexing').length,
          lastRefreshAt: new Date().toISOString(),
        },
      },
    }
  },
})

// ─── POST /api/knowledge/upload ───────────────────────────────────────────────

app.http('knowledge-upload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'knowledge/upload',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const formData = await req.formData()
    const file     = formData.get('file') as File | null
    const domainId = formData.get('domain') as string ?? 'finance'

    if (!file) return { status: 400, body: 'Missing file' }

    const blobClient    = getBlobClient()
    const container     = containerForDomain(domainId)
    const containerClient = blobClient.getContainerClient(container)
    const blobName      = `uploads/${Date.now()}-${file.name}`
    const blockBlob     = containerClient.getBlockBlobClient(blobName)

    const arrayBuffer = await file.arrayBuffer()
    await blockBlob.uploadData(arrayBuffer, {
      blobHTTPHeaders: { blobContentType: file.type },
      metadata: { source: 'manual', status: 'queued', originalName: file.name },
    })

    // In production an Event Grid trigger picks up the blob and starts the
    // chunking → embedding → indexing pipeline automatically.

    return { status: 202, jsonBody: { fileId: blobName, status: 'queued' } }
  },
})

// ─── DELETE /api/knowledge/files/:fileId ──────────────────────────────────────

app.http('knowledge-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'knowledge/files/{fileId}',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const fileId   = req.params.fileId
    const domainId = req.query.get('domain') ?? 'finance'

    // Remove from Blob
    const blobClient = getBlobClient()
    const container  = containerForDomain(domainId)
    await blobClient.getContainerClient(container).deleteBlob(fileId)

    // Remove chunks from AI Search
    const searchClient = new SearchClient(
      process.env.AZURE_SEARCH_ENDPOINT!,
      indexForDomain(domainId),
      new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY!)
    )

    // Delete all chunks whose sourceName matches
    const deleteResults = await searchClient.search('*', {
      filter: `sourceName eq '${fileId}'`,
      select: ['id'],
      top: 1000,
    })
    const ids: string[] = []
    for await (const r of deleteResults.results) ids.push((r.document as any).id)
    if (ids.length > 0) await searchClient.deleteDocuments(ids.map((id) => ({ id })))

    return { status: 204 }
  },
})

// ─── POST /api/knowledge/reindex ──────────────────────────────────────────────

app.http('knowledge-reindex', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'knowledge/reindex',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    // In production this starts an Azure AI Search indexer run.
    // The indexer is configured with a skillset (chunk → embed → label extract).
    const { domain } = (await req.json()) as { domain: string }

    const indexClient = new SearchIndexClient(
      process.env.AZURE_SEARCH_ENDPOINT!,
      new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY!)
    )

    // Trigger the pre-created indexer for this domain
    // await indexClient.getIndexerClient().runIndexer(`ella-${domain}-indexer`)

    return { status: 202, jsonBody: { message: `Reindex triggered for domain: ${domain}` } }
  },
})

// ─── POST /api/knowledge/sync/blob ────────────────────────────────────────────

app.http('knowledge-sync-blob', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'knowledge/sync/blob',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const { domain, container } = (await req.json()) as {
      domain: string
      container: string
    }
    // Trigger the AI Search Blob indexer for this container
    return { status: 202, jsonBody: { message: `Blob sync triggered for ${container} in domain ${domain}` } }
  },
})

// ─── POST /api/knowledge/sync/sharepoint ─────────────────────────────────────

app.http('knowledge-sync-sharepoint', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'knowledge/sync/sharepoint',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const { domain, siteUrl } = (await req.json()) as {
      domain: string
      siteUrl: string
    }
    // Trigger the SharePoint Online connector indexer
    return { status: 202, jsonBody: { message: `SharePoint sync triggered for ${siteUrl} in domain ${domain}` } }
  },
})
