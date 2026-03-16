"""
RAG service — builds context prompt and streams GPT-4o mini response.
"""
from __future__ import annotations
from typing import Generator
from openai import OpenAI

CHAT_MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = """You are an expert AI assistant for Qualcomm's Document Intelligence platform.
You answer questions accurately and concisely based ONLY on the provided document context.

Rules:
1. Answer using ONLY information from the provided context chunks.
2. Cite your sources using [SOURCE_N] notation inline (e.g., [SOURCE_1], [SOURCE_2]).
3. If multiple sources support a point, cite all of them.
4. If the answer is NOT in the provided context, say exactly:
   "I don't have enough information in the uploaded documents to answer this."
5. Be precise, structured, and professional.
6. For complex documents like DDQs, extract structured information clearly.
7. Use markdown formatting — bullet lists, bold, tables — where appropriate."""


def build_context(chunks: list[dict]) -> str:
    if not chunks:
        return "No relevant context found in the uploaded documents."
    parts = []
    for c in chunks:
        parts.append(
            f'[SOURCE_{c["source_id"]}] From "{c["filename"]}" '
            f'(chunk {c["chunk_index"] + 1}/{c["total_chunks"]}):\n'
            f'---\n{c["text"]}\n---'
        )
    return "\n\n".join(parts)


def stream_answer(
    query: str,
    chunks: list[dict],
    client: OpenAI,
) -> Generator[str, None, None]:
    """Yield streamed token strings from GPT-4o mini."""
    context = build_context(chunks)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Here are the relevant document excerpts:\n\n{context}"
                f"\n\n---\n\nQuestion: {query}"
            ),
        },
    ]
    stream = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        stream=True,
        temperature=0.15,
        max_tokens=2000,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            yield delta
