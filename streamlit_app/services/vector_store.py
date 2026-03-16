"""
In-memory vector store with cosine similarity search.
Supports Azure OpenAI embeddings via a passed AzureOpenAI client.
"""
from __future__ import annotations
import uuid
from dataclasses import dataclass
from typing import Optional
import numpy as np

CHUNK_SIZE    = 800   # words per chunk
CHUNK_OVERLAP = 150   # words overlap


# ─────────────────────────────────────────────────────────────────────────────
# Chunking
# ─────────────────────────────────────────────────────────────────────────────

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        slice_ = words[i : i + size]
        if len(slice_) < 20 and chunks:
            chunks[-1]["text"] += " " + " ".join(slice_)
        else:
            chunks.append({"text": " ".join(slice_), "word_start": i})
        i += size - overlap
    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# Cosine similarity
# ─────────────────────────────────────────────────────────────────────────────

def cosine_similarity(a: list[float], b: list[float]) -> float:
    a, b = np.array(a), np.array(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom else 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Chunk:
    id: str
    file_id: str
    filename: str
    file_type: str
    chunk_index: int
    total_chunks: int
    text: str
    embedding: list[float]


@dataclass
class DocumentMeta:
    file_id: str
    filename: str
    file_type: str
    pages: Optional[int]
    word_count: int
    chunk_count: int


# ─────────────────────────────────────────────────────────────────────────────
# Vector Store
# ─────────────────────────────────────────────────────────────────────────────

class VectorStore:
    def __init__(self):
        self.documents: dict[str, DocumentMeta] = {}
        self.chunks: list[Chunk] = []

    # ── Ingestion ─────────────────────────────────────────────────────────────

    def add_document(self, parsed: dict, client, embed_deployment: str) -> DocumentMeta:
        """
        client: AzureOpenAI (or OpenAI) instance
        embed_deployment: Azure deployment name for embeddings
        """
        file_id = str(uuid.uuid4())
        raw_chunks = chunk_text(parsed["text"])
        if not raw_chunks:
            raise ValueError("No text could be extracted from the document.")

        BATCH = 100
        all_embeddings: list[list[float]] = []
        for i in range(0, len(raw_chunks), BATCH):
            batch_texts = [c["text"] for c in raw_chunks[i : i + BATCH]]
            resp = client.embeddings.create(model=embed_deployment, input=batch_texts)
            all_embeddings.extend([d.embedding for d in resp.data])

        total = len(raw_chunks)
        for idx, (rc, emb) in enumerate(zip(raw_chunks, all_embeddings)):
            self.chunks.append(Chunk(
                id=f"{file_id}_{idx}",
                file_id=file_id,
                filename=parsed["filename"],
                file_type=parsed["type"],
                chunk_index=idx,
                total_chunks=total,
                text=rc["text"],
                embedding=emb,
            ))

        meta = DocumentMeta(
            file_id=file_id,
            filename=parsed["filename"],
            file_type=parsed["type"],
            pages=parsed.get("pages"),
            word_count=parsed.get("word_count", 0),
            chunk_count=total,
        )
        self.documents[file_id] = meta
        return meta

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def search(
        self,
        query: str,
        client,
        embed_deployment: str,
        top_k: int = 6,
        file_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        resp = client.embeddings.create(model=embed_deployment, input=[query])
        q_emb = resp.data[0].embedding

        candidates = self.chunks
        if file_ids:
            candidates = [c for c in candidates if c.file_id in file_ids]

        if not candidates:
            return []

        scored = sorted(
            candidates,
            key=lambda c: cosine_similarity(q_emb, c.embedding),
            reverse=True,
        )[:top_k]

        return [
            {
                "source_id": i + 1,
                "label": f"SOURCE_{i + 1}",
                "file_id": c.file_id,
                "filename": c.filename,
                "chunk_index": c.chunk_index,
                "total_chunks": c.total_chunks,
                "text": c.text,
                "score": cosine_similarity(q_emb, c.embedding),
                "excerpt": c.text[:300] + ("..." if len(c.text) > 300 else ""),
            }
            for i, c in enumerate(scored)
        ]

    # ── Management ────────────────────────────────────────────────────────────

    def remove_document(self, file_id: str):
        self.documents.pop(file_id, None)
        self.chunks = [c for c in self.chunks if c.file_id != file_id]

    def list_documents(self) -> list[DocumentMeta]:
        return list(self.documents.values())

    def is_empty(self) -> bool:
        return len(self.documents) == 0
