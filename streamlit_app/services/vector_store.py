"""
In-memory document store with TF-IDF retrieval.
No embedding deployment required — only a chat deployment is needed.
"""
from __future__ import annotations
import uuid
from dataclasses import dataclass
from typing import Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sk_cosine

CHUNK_SIZE    = 800
CHUNK_OVERLAP = 150


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


@dataclass
class DocumentMeta:
    file_id: str
    filename: str
    file_type: str
    pages: Optional[int]
    word_count: int
    chunk_count: int


# ─────────────────────────────────────────────────────────────────────────────
# Vector Store (TF-IDF based)
# ─────────────────────────────────────────────────────────────────────────────

class VectorStore:
    def __init__(self):
        self.documents: dict[str, DocumentMeta] = {}
        self.chunks: list[Chunk] = []
        self._vectorizer: Optional[TfidfVectorizer] = None
        self._matrix = None  # sparse TF-IDF matrix

    # ── Ingestion ─────────────────────────────────────────────────────────────

    def add_document(self, parsed: dict, *args, **kwargs) -> DocumentMeta:
        """Add a document. Extra args ignored (backward compat with old embed API)."""
        file_id = str(uuid.uuid4())
        raw_chunks = chunk_text(parsed["text"])
        if not raw_chunks:
            raise ValueError("No text could be extracted from the document.")

        total = len(raw_chunks)
        for idx, rc in enumerate(raw_chunks):
            self.chunks.append(Chunk(
                id=f"{file_id}_{idx}",
                file_id=file_id,
                filename=parsed["filename"],
                file_type=parsed["type"],
                chunk_index=idx,
                total_chunks=total,
                text=rc["text"],
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
        self._rebuild_index()
        return meta

    def _rebuild_index(self):
        if not self.chunks:
            self._vectorizer = None
            self._matrix = None
            return
        self._vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=50_000,
            sublinear_tf=True,
        )
        self._matrix = self._vectorizer.fit_transform([c.text for c in self.chunks])

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def search(
        self,
        query: str,
        *args,             # absorb old client / embed_deploy params
        top_k: int = 6,
        file_ids: Optional[list[str]] = None,
        **kwargs,
    ) -> list[dict]:
        if self._vectorizer is None or self._matrix is None:
            return []

        candidates_idx = list(range(len(self.chunks)))
        if file_ids:
            candidates_idx = [i for i, c in enumerate(self.chunks) if c.file_id in file_ids]
        if not candidates_idx:
            return []

        q_vec = self._vectorizer.transform([query])
        sub_matrix = self._matrix[candidates_idx]
        scores = sk_cosine(q_vec, sub_matrix).flatten()

        top_local = np.argsort(scores)[::-1][:top_k]
        results = []
        for rank, local_i in enumerate(top_local):
            global_i = candidates_idx[local_i]
            c = self.chunks[global_i]
            score = float(scores[local_i])
            results.append({
                "source_id": rank + 1,
                "label": f"SOURCE_{rank + 1}",
                "file_id": c.file_id,
                "filename": c.filename,
                "chunk_index": c.chunk_index,
                "total_chunks": c.total_chunks,
                "text": c.text,
                "score": score,
                "excerpt": c.text[:300] + ("..." if len(c.text) > 300 else ""),
            })
        return results

    # ── Management ────────────────────────────────────────────────────────────

    def remove_document(self, file_id: str):
        self.documents.pop(file_id, None)
        self.chunks = [c for c in self.chunks if c.file_id != file_id]
        self._rebuild_index()

    def list_documents(self) -> list[DocumentMeta]:
        return list(self.documents.values())

    def is_empty(self) -> bool:
        return len(self.documents) == 0
