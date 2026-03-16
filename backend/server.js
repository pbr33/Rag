require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

const { parseFile } = require('./services/fileParser');
const { VectorStore } = require('./services/vectorStore');
const { streamRAGResponse } = require('./services/ragService');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Vector Store (in-memory, persists while server is running)
const vectorStore = new VectorStore();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not supported`));
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    documents: vectorStore.getDocuments().length,
    timestamp: new Date().toISOString(),
  });
});

// Upload file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileId = uuidv4();
  const filePath = req.file.path;

  try {
    // Parse the file
    const parsed = await parseFile(filePath, req.file.originalname);

    if (!parsed.text || parsed.text.trim().length < 10) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Could not extract text from file. Is it a scanned image?' });
    }

    // Index into vector store
    const docMeta = await vectorStore.addDocument(fileId, parsed, openai);

    // Clean up uploaded file from disk
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      document: docMeta,
    });
  } catch (err) {
    // Clean up on error
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to process file' });
  }
});

// Get all documents
app.get('/api/documents', (req, res) => {
  res.json({ documents: vectorStore.getDocuments() });
});

// Delete a document
app.delete('/api/documents/:fileId', (req, res) => {
  const { fileId } = req.params;
  const doc = vectorStore.getDocument(fileId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  vectorStore.removeDocument(fileId);
  res.json({ success: true, message: `"${doc.filename}" removed` });
});

// Chat with RAG (SSE streaming)
app.post('/api/chat', async (req, res) => {
  const { query, fileIds } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const docs = vectorStore.getDocuments();
  if (docs.length === 0) {
    return res.status(400).json({ error: 'No documents uploaded. Please upload files first.' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    // Search for relevant chunks
    const relevantChunks = await vectorStore.search(
      query,
      openai,
      6,
      fileIds && fileIds.length > 0 ? fileIds : null
    );

    // Stream RAG response
    await streamRAGResponse(query, relevantChunks, openai, res);
  } catch (err) {
    console.error('Chat error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Qualcomm RAG Backend running on http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);
  console.log(`🤖 Model: gpt-4o-mini | Embeddings: text-embedding-3-small\n`);
});
