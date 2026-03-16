const SYSTEM_PROMPT = `You are an expert AI assistant for Qualcomm's document intelligence platform.
You answer questions accurately and concisely based ONLY on the provided document context.

Rules:
1. Answer using ONLY information from the provided context chunks.
2. Cite your sources using [SOURCE_N] notation (e.g., [SOURCE_1], [SOURCE_2]).
3. If multiple sources support a point, cite all of them: [SOURCE_1][SOURCE_3].
4. If the answer is not in the provided context, say: "I don't have enough information in the uploaded documents to answer this question."
5. Be precise, structured, and professional.
6. For complex documents like DDQs (Due Diligence Questionnaires), extract structured information clearly.
7. Use markdown formatting for lists, tables, and sections where appropriate.`;

function buildContextPrompt(chunks) {
  if (chunks.length === 0) {
    return 'No relevant context found in the uploaded documents.';
  }

  return chunks
    .map(
      (chunk, i) => `[SOURCE_${i + 1}] From "${chunk.filename}" (chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}):
---
${chunk.text}
---`
    )
    .join('\n\n');
}

async function streamRAGResponse(query, chunks, openai, res) {
  const contextPrompt = buildContextPrompt(chunks);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Here are the relevant document excerpts:\n\n${contextPrompt}\n\n---\n\nQuestion: ${query}`,
    },
  ];

  // Send citations metadata first
  const citations = chunks.map((chunk, i) => ({
    sourceId: i + 1,
    label: `SOURCE_${i + 1}`,
    filename: chunk.filename,
    chunkIndex: chunk.chunkIndex,
    totalChunks: chunk.totalChunks,
    fileId: chunk.fileId,
    score: Math.round(chunk.score * 100) / 100,
    excerpt: chunk.text.substring(0, 300) + (chunk.text.length > 300 ? '...' : ''),
    fullText: chunk.text,
  }));

  res.write(`data: ${JSON.stringify({ type: 'citations', citations })}\n\n`);

  // Stream the LLM response
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    stream: true,
    temperature: 0.2,
    max_tokens: 2000,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
}

module.exports = { streamRAGResponse };
