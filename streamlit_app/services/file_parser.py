"""
File parsing service — supports PDF, DOCX, TXT, XLSX, CSV
"""
import io
from pathlib import Path
import pandas as pd
import PyPDF2
from docx import Document


def parse_file(file_bytes: bytes, filename: str) -> dict:
    """Parse uploaded file bytes into text + metadata."""
    ext = Path(filename).suffix.lower()

    parsers = {
        ".pdf":  _parse_pdf,
        ".docx": _parse_docx,
        ".doc":  _parse_docx,
        ".txt":  _parse_txt,
        ".md":   _parse_txt,
        ".xlsx": _parse_excel,
        ".xls":  _parse_excel,
        ".csv":  _parse_csv,
    }

    parser = parsers.get(ext)
    if not parser:
        raise ValueError(f"Unsupported file type: {ext}. Supported: PDF, DOCX, TXT, MD, XLSX, CSV")

    return parser(file_bytes, filename)


def _parse_pdf(data: bytes, filename: str) -> dict:
    reader = PyPDF2.PdfReader(io.BytesIO(data))
    pages_text = []
    for i, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        if text.strip():
            pages_text.append(f"[Page {i}]\n{text}")

    full_text = "\n\n".join(pages_text)
    return {
        "text": full_text,
        "filename": filename,
        "type": "pdf",
        "pages": len(reader.pages),
        "word_count": len(full_text.split()),
    }


def _parse_docx(data: bytes, filename: str) -> dict:
    doc = Document(io.BytesIO(data))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    full_text = "\n\n".join(paragraphs)
    return {
        "text": full_text,
        "filename": filename,
        "type": "docx",
        "pages": None,
        "word_count": len(full_text.split()),
    }


def _parse_txt(data: bytes, filename: str) -> dict:
    full_text = data.decode("utf-8", errors="replace")
    return {
        "text": full_text,
        "filename": filename,
        "type": "txt",
        "pages": None,
        "word_count": len(full_text.split()),
    }


def _parse_excel(data: bytes, filename: str) -> dict:
    xl = pd.ExcelFile(io.BytesIO(data))
    parts = []
    for sheet in xl.sheet_names:
        df = xl.parse(sheet).fillna("")
        parts.append(f"=== Sheet: {sheet} ===\n{df.to_string(index=False)}")
    full_text = "\n\n".join(parts)
    return {
        "text": full_text,
        "filename": filename,
        "type": "xlsx",
        "pages": None,
        "sheets": len(xl.sheet_names),
        "word_count": len(full_text.split()),
    }


def _parse_csv(data: bytes, filename: str) -> dict:
    df = pd.read_csv(io.BytesIO(data)).fillna("")
    full_text = df.to_string(index=False)
    return {
        "text": full_text,
        "filename": filename,
        "type": "csv",
        "pages": None,
        "word_count": len(full_text.split()),
    }
