/**
 * POST /api/chat
 *
 * Full RAG pipeline:
 *   1. Content Safety — screen user input
 *   2. AI Search — hybrid retrieval (vector + BM25 + semantic re-rank)
 *   3. Azure OpenAI GPT-4o — streamed completion
 *   4. Content Safety — screen LLM output
 *
 * Response: Server-Sent Events stream
 *   data: {"type":"meta",    "data":{"docCount":4,"webCount":0}}
 *   data: {"type":"token",   "data":"Net EUR exposure…"}
 *   data: {"type":"sources", "data":[{"name":"Treasury_Q3.pdf","kind":"document"}]}
 *   data: {"type":"done",    "data":{"latencyMs":3100}}
 *   data: {"type":"error",   "data":"Content blocked: Hate"}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { screenText } from '../services/contentSafety'
import { hybridSearch, buildContext } from '../services/aiSearch'
import { streamCompletion } from '../services/openai'

interface ChatBody {
  message: string
  domainId: string
  chatId: string
  memoryOn: boolean
  tools: { documents: boolean; web: boolean }
}

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous', // SWA handles auth
  route: 'chat',
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const startMs = Date.now()

    let body: ChatBody
    try {
      body = (await req.json()) as ChatBody
    } catch {
      return { status: 400, body: 'Invalid JSON' }
    }

    const { message, domainId, tools } = body

    // ── 1. Screen input ────────────────────────────────────────────────────────
    const inputSafety = await screenText(message)
    if (!inputSafety.passed) {
      const payload = `data: ${JSON.stringify({ type: 'error', data: `Content blocked: ${inputSafety.blocked.join(', ')}` })}\n\n`
      return {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
        body: payload,
      }
    }

    // ── 2. Retrieve context ────────────────────────────────────────────────────
    let chunks: Awaited<ReturnType<typeof hybridSearch>> = []
    if (tools.documents) {
      chunks = await hybridSearch(message, domainId, 6)
    }
    const context = buildContext(chunks)

    // ── 3. Stream completion ───────────────────────────────────────────────────
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    const sse = (obj: object) => `data: ${JSON.stringify(obj)}\n\n`

    // Fire streaming in background
    ;(async () => {
      try {
        // Send meta
        await writer.write(encoder.encode(sse({ type: 'meta', data: { docCount: chunks.length, webCount: 0 } })))

        // Stream tokens
        for await (const token of streamCompletion(message, context)) {
          await writer.write(encoder.encode(sse({ type: 'token', data: token })))
        }

        // Sources
        const sources = chunks.map((c) => ({ name: c.sourceName, kind: 'document' }))
        await writer.write(encoder.encode(sse({ type: 'sources', data: sources })))

        // Done
        await writer.write(
          encoder.encode(sse({ type: 'done', data: { latencyMs: Date.now() - startMs } }))
        )
      } catch (err) {
        ctx.error('Stream error', err)
        await writer.write(
          encoder.encode(sse({ type: 'error', data: String(err) }))
        )
      } finally {
        await writer.close()
      }
    })()

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS?.split(',')[0] ?? '*',
      },
      body: readable,
    }
  },
})
