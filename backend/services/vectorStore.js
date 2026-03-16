const { v4: uuidv4 } = require('uuid');

// Cosine similarity between two vectors
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Split text into overlapping chunks
function chunkText(text, chunkSize = 800, overlap = 150) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const chunkWords = words.slice(i, i + chunkSize);
    if (chunkWords.length < 20 && chunks.length > 0) {
      // Append small leftover to last chunk
      chunks[chunks.length - 1].text += ' ' + chunkWords.join(' ');
    } else {
      chunks.push({
        text: chunkWords.join(' '),
        wordStart: i,
        wordEnd: i + chunkWords.length,
      });
    }
    i += chunkSize - overlap;
  }

  return chunks;
}

class VectorStore {
  constructor() {
    this.documents = new Map(); // fileId -> metadata
    this.chunks = [];           // all chunks with embeddings
  }

  async addDocument(fileId, parsedFile, openai) {
    const { text, filename, type, pages, sheets, wordCount } = parsedFile;

    // Chunk the text
    const rawChunks = chunkText(text, 800, 150);

    // Batch embed (OpenAI allows up to 2048 inputs per call)
    const BATCH_SIZE = 100;
    const allEmbeddings = [];

    for (let i = 0; i < rawChunks.length; i += BATCH_SIZE) {
      const batch = rawChunks.slice(i, i + BATCH_SIZE).map((c) => c.text);
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });
      allEmbeddings.push(...response.data.map((d) => d.embedding));
    }

    // Store chunks
    const documentChunks = rawChunks.map((chunk, idx) => ({
      id: `${fileId}_${idx}`,
      fileId,
      filename,
      type,
      chunkIndex: idx,
      totalChunks: rawChunks.length,
      text: chunk.text,
      wordStart: chunk.wordStart,
      wordEnd: chunk.wordEnd,
      embedding: allEmbeddings[idx],
    }));

    this.chunks.push(...documentChunks);

    // Store document metadata
    this.documents.set(fileId, {
      fileId,
      filename,
      type,
      pages: pages || null,
      sheets: sheets || null,
      wordCount: wordCount || 0,
      chunkCount: documentChunks.length,
      uploadedAt: new Date().toISOString(),
    });

    return this.documents.get(fileId);
  }

  async search(queryText, openai, topK = 6, fileIds = null) {
    // Embed the query
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: [queryText],
    });
    const queryEmbedding = response.data[0].embedding;

    // Filter by fileIds if specified
    let candidates = this.chunks;
    if (fileIds && fileIds.length > 0) {
      candidates = candidates.filter((c) => fileIds.includes(c.fileId));
    }

    if (candidates.length === 0) return [];

    // Score and sort
    const scored = candidates
      .map((chunk) => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }

  removeDocument(fileId) {
    this.documents.delete(fileId);
    this.chunks = this.chunks.filter((c) => c.fileId !== fileId);
  }

  getDocuments() {
    return Array.from(this.documents.values());
  }

  getDocument(fileId) {
    return this.documents.get(fileId) || null;
  }

  clear() {
    this.documents.clear();
    this.chunks = [];
  }
}

module.exports = { VectorStore };
