/**
 * Azure OpenAI wrapper.
 * - embedText: generates embeddings for indexing and retrieval
 * - streamChat: RAG completion with Server-Sent Events streaming
 */

import OpenAI from 'openai'

const aoai = new OpenAI({
  apiKey:  process.env.AZURE_OPENAI_API_KEY!,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_CHAT_DEPLOYMENT}`,
  defaultQuery: { 'api-version': '2024-05-01-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY! },
})

const embedClient = new OpenAI({
  apiKey:  process.env.AZURE_OPENAI_API_KEY!,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_EMBED_DEPLOYMENT}`,
  defaultQuery: { 'api-version': '2024-05-01-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY! },
})

export async function embedText(text: string): Promise<number[]> {
  const r = await embedClient.embeddings.create({
    model: process.env.AZURE_OPENAI_EMBED_DEPLOYMENT!,
    input: text,
  })
  return r.data[0].embedding
}

const SYSTEM_PROMPT = `You are ELLA Square, an expert enterprise assistant.
Answer based ONLY on the provided context documents.
Be concise and precise. Use bullet points for lists.
If the answer is not in the context, say so — do not fabricate.
Always cite source document names inline using [SourceName].`

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function* streamCompletion(
  userMessage: string,
  context: string,
  history: ChatMessage[] = []
): AsyncGenerator<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: `Context documents:\n\n${context}`,
    },
    ...history.slice(-6), // last 3 turns
    { role: 'user', content: userMessage },
  ]

  const stream = await aoai.chat.completions.create({
    model: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT!,
    messages,
    stream: true,
    max_tokens: 1024,
    temperature: 0.1,
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) yield delta
  }
}
