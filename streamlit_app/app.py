"""
Qualcomm Document Intelligence — Streamlit RAG Application
GPT-4o mini · text-embedding-3-small · Real-time streaming · Citations
"""
from __future__ import annotations
import os, time, re
from pathlib import Path
import streamlit as st
from dotenv import load_dotenv
from openai import OpenAI

from services.file_parser import parse_file
from services.vector_store import VectorStore
from services.rag_service import stream_answer

# ─────────────────────────────────────────────────────────────────────────────
# Page config  (MUST be first Streamlit call)
# ─────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Qualcomm Document Intelligence",
    page_icon="🔷",
    layout="wide",
    initial_sidebar_state="expanded",
)

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# Custom CSS — Qualcomm dark glassmorphism theme
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
/* ── Google Font ─────────────────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

/* ── Root variables ──────────────────────────────────────────────────────── */
:root {
    --q-blue:    #3253DC;
    --q-purple:  #7c3aed;
    --q-cyan:    #06b6d4;
    --q-dark:    #080c12;
    --q-card:    #0d1117;
    --q-border:  rgba(50,83,220,0.18);
    --q-text:    #e2e8f0;
    --q-muted:   #64748b;
}

/* ── Global ──────────────────────────────────────────────────────────────── */
html, body, [data-testid="stAppViewContainer"] {
    font-family: 'Inter', sans-serif !important;
    background: var(--q-dark) !important;
}

/* Animated ambient glow */
[data-testid="stAppViewContainer"]::before {
    content: '';
    position: fixed;
    top: -15vw; left: -15vw;
    width: 50vw; height: 50vw;
    background: radial-gradient(circle, rgba(50,83,220,0.07) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
}
[data-testid="stAppViewContainer"]::after {
    content: '';
    position: fixed;
    bottom: -15vw; right: -15vw;
    width: 50vw; height: 50vw;
    background: radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%);
    pointer-events: none; z-index: 0;
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
[data-testid="stSidebar"] {
    background: rgba(13,17,23,0.9) !important;
    border-right: 1px solid var(--q-border) !important;
}
[data-testid="stSidebar"] * { font-family: 'Inter', sans-serif !important; }

/* ── Main content ────────────────────────────────────────────────────────── */
.main .block-container {
    padding: 1.5rem 2rem !important;
    max-width: 1400px !important;
}

/* ── Hide default header / footer ────────────────────────────────────────── */
#MainMenu, footer, header { visibility: hidden; }

/* ── Card ────────────────────────────────────────────────────────────────── */
.q-card {
    background: rgba(13,17,23,0.85);
    backdrop-filter: blur(20px);
    border: 1px solid var(--q-border);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1rem;
}

/* ── Header banner ───────────────────────────────────────────────────────── */
.q-header {
    background: linear-gradient(135deg, rgba(50,83,220,0.15) 0%, rgba(124,58,237,0.15) 100%);
    border: 1px solid var(--q-border);
    border-radius: 20px;
    padding: 1.5rem 2rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
}
.q-header-logo {
    width: 52px; height: 52px;
    background: linear-gradient(135deg, var(--q-blue), var(--q-purple));
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.6rem;
    box-shadow: 0 0 24px rgba(50,83,220,0.4);
    flex-shrink: 0;
}
.q-header-title {
    font-size: 1.5rem; font-weight: 800; color: white;
    background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.q-header-sub { font-size: 0.8rem; color: var(--q-muted); margin-top: 2px; }

/* ── Gradient text ───────────────────────────────────────────────────────── */
.grad {
    background: linear-gradient(135deg, var(--q-blue), var(--q-purple));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    font-weight: 700;
}

/* ── Stat chip ───────────────────────────────────────────────────────────── */
.stat-chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(50,83,220,0.12);
    border: 1px solid rgba(50,83,220,0.25);
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 0.75rem; color: #a5b4fc; font-weight: 500;
}

/* ── Chat messages ───────────────────────────────────────────────────────── */
.msg-user {
    background: linear-gradient(135deg, rgba(50,83,220,0.25), rgba(124,58,237,0.25));
    border: 1px solid rgba(50,83,220,0.3);
    border-radius: 16px 16px 4px 16px;
    padding: 0.9rem 1.1rem;
    margin: 0.5rem 0;
    margin-left: 10%;
    color: var(--q-text);
    font-size: 0.9rem; line-height: 1.6;
}
.msg-ai {
    background: rgba(13,17,23,0.9);
    border: 1px solid var(--q-border);
    border-radius: 16px 16px 16px 4px;
    padding: 0.9rem 1.1rem;
    margin: 0.5rem 0;
    margin-right: 10%;
    color: var(--q-text);
    font-size: 0.9rem; line-height: 1.7;
}
.msg-label {
    font-size: 0.7rem; font-weight: 600; letter-spacing: 0.05em;
    margin-bottom: 6px; opacity: 0.6;
    text-transform: uppercase;
}
.msg-label.ai { color: #818cf8; }
.msg-label.user { color: #94a3b8; text-align: right; }

/* ── Citation badge ──────────────────────────────────────────────────────── */
.cite-badge {
    display: inline-block;
    background: rgba(50,83,220,0.2);
    border: 1px solid rgba(50,83,220,0.4);
    color: #818cf8;
    border-radius: 5px;
    padding: 1px 6px;
    font-size: 0.72rem; font-weight: 700;
    cursor: pointer;
    margin: 0 1px;
}

/* ── Citation source card ────────────────────────────────────────────────── */
.src-card {
    background: rgba(13,17,23,0.95);
    border: 1px solid var(--q-border);
    border-radius: 12px;
    padding: 0.85rem 1rem;
    margin-bottom: 0.6rem;
    transition: border-color 0.2s;
}
.src-card:hover { border-color: rgba(50,83,220,0.45); }
.src-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px;
    background: linear-gradient(135deg, var(--q-blue), var(--q-purple));
    border-radius: 6px;
    font-size: 0.7rem; font-weight: 700; color: white;
    flex-shrink: 0;
}
.src-title { font-size: 0.8rem; font-weight: 600; color: #c7d2fe; }
.src-meta  { font-size: 0.7rem; color: var(--q-muted); margin-top: 2px; }
.src-text  {
    font-size: 0.75rem; color: #94a3b8; line-height: 1.5;
    background: rgba(0,0,0,0.25); border-radius: 8px;
    padding: 0.5rem 0.75rem; margin-top: 0.5rem;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    max-height: 120px; overflow-y: auto;
    white-space: pre-wrap; word-break: break-word;
}

/* ── Doc card in sidebar ─────────────────────────────────────────────────── */
.doc-card {
    background: rgba(20,27,40,0.8);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 10px;
    padding: 0.6rem 0.8rem;
    margin-bottom: 0.4rem;
    font-size: 0.8rem;
}
.doc-name { color: #e2e8f0; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.doc-meta { color: var(--q-muted); font-size: 0.7rem; margin-top: 2px; }

/* ── Upload zone ─────────────────────────────────────────────────────────── */
[data-testid="stFileUploader"] {
    border: 2px dashed rgba(50,83,220,0.3) !important;
    border-radius: 12px !important;
    background: rgba(50,83,220,0.04) !important;
}
[data-testid="stFileUploader"]:hover {
    border-color: rgba(50,83,220,0.6) !important;
    background: rgba(50,83,220,0.08) !important;
}

/* ── Input ───────────────────────────────────────────────────────────────── */
[data-testid="stChatInput"] textarea {
    background: rgba(13,17,23,0.9) !important;
    border: 1px solid var(--q-border) !important;
    border-radius: 14px !important;
    color: var(--q-text) !important;
    font-family: 'Inter', sans-serif !important;
}
[data-testid="stChatInput"] textarea:focus {
    border-color: var(--q-blue) !important;
    box-shadow: 0 0 0 2px rgba(50,83,220,0.2) !important;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.stButton > button {
    background: linear-gradient(135deg, var(--q-blue), var(--q-purple)) !important;
    color: white !important; border: none !important;
    border-radius: 10px !important; font-weight: 600 !important;
    font-family: 'Inter', sans-serif !important;
    transition: opacity 0.2s, transform 0.1s !important;
}
.stButton > button:hover { opacity: 0.88 !important; transform: translateY(-1px) !important; }

/* ── Progress bar ────────────────────────────────────────────────────────── */
.stProgress > div > div { background: linear-gradient(90deg, var(--q-blue), var(--q-purple)) !important; }

/* ── Expander ────────────────────────────────────────────────────────────── */
[data-testid="stExpander"] {
    background: rgba(13,17,23,0.7) !important;
    border: 1px solid var(--q-border) !important;
    border-radius: 12px !important;
}

/* ── Score bar ───────────────────────────────────────────────────────────── */
.score-bar-wrap { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.score-bar {
    flex: 1; height: 4px; background: rgba(255,255,255,0.06);
    border-radius: 2px; overflow: hidden;
}
.score-fill { height: 100%; border-radius: 2px;
    background: linear-gradient(90deg, var(--q-blue), var(--q-purple)); }
.score-text { font-size: 0.65rem; color: #818cf8; font-weight: 700; white-space: nowrap; }

/* ── Divider ─────────────────────────────────────────────────────────────── */
hr { border-color: rgba(50,83,220,0.12) !important; }

/* ── Scrollbars ──────────────────────────────────────────────────────────── */
* { scrollbar-width: thin; scrollbar-color: rgba(50,83,220,0.4) rgba(0,0,0,0.2); }
</style>
""", unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
# Session state initialisation
# ─────────────────────────────────────────────────────────────────────────────
def _init_state():
    defaults = {
        "messages":     [],   # list of {role, content, citations?}
        "vector_store": VectorStore(),
        "openai_client": None,
        "api_key_ok":   False,
        "selected_docs": [],  # file_ids to filter; empty = all
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

_init_state()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
TYPE_EMOJI = {"pdf": "📄", "docx": "📝", "doc": "📝",
              "xlsx": "📊", "xls": "📊", "csv": "📊",
              "txt": "📃", "md": "📃"}

def _emoji(t): return TYPE_EMOJI.get(t, "📁")
def _fmt_words(n): return f"{n/1000:.1f}k words" if n >= 1000 else f"{n} words"

def _score_color(s):
    if s >= 0.8: return "#34d399"
    if s >= 0.6: return "#fbbf24"
    return "#94a3b8"

def _citation_html(n: int) -> str:
    return f'<span class="cite-badge">[SOURCE_{n}]</span>'

def _render_content_with_citations(text: str) -> str:
    """Replace [SOURCE_N] markers with styled HTML badges."""
    return re.sub(
        r'\[SOURCE_(\d+)\]',
        lambda m: f'<span class="cite-badge">[{m.group(1)}]</span>',
        text,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Sidebar
# ─────────────────────────────────────────────────────────────────────────────
with st.sidebar:
    # Logo + title
    st.markdown("""
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.25rem;">
      <div style="width:42px;height:42px;background:linear-gradient(135deg,#3253DC,#7c3aed);
                  border-radius:12px;display:flex;align-items:center;justify-content:center;
                  font-size:1.3rem;box-shadow:0 0 16px rgba(50,83,220,0.4);">🔷</div>
      <div>
        <div style="font-size:0.95rem;font-weight:700;color:white;">Qualcomm</div>
        <div style="font-size:0.7rem;color:#64748b;">Document Intelligence</div>
      </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("### 🔑 API Configuration")

    # API key input
    api_key_input = st.text_input(
        "OpenAI API Key",
        value=os.getenv("OPENAI_API_KEY", ""),
        type="password",
        placeholder="sk-...",
        help="Required to power embeddings and GPT-4o mini"
    )

    if api_key_input:
        if not st.session_state.api_key_ok or (
            st.session_state.openai_client and
            st.session_state.openai_client.api_key != api_key_input
        ):
            st.session_state.openai_client = OpenAI(api_key=api_key_input)
            st.session_state.api_key_ok = True

    if st.session_state.api_key_ok:
        st.success("✓ API key configured", icon="✅")
    else:
        st.warning("Enter your OpenAI API key to start", icon="⚠️")

    st.divider()

    # ── Upload ────────────────────────────────────────────────────────────────
    st.markdown("### 📂 Knowledge Base")

    uploaded_files = st.file_uploader(
        "Upload Documents",
        type=["pdf", "docx", "doc", "txt", "md", "xlsx", "xls", "csv"],
        accept_multiple_files=True,
        help="Supports PDF, DOCX, TXT, XLSX, CSV — up to 50 MB each",
        label_visibility="collapsed",
    )

    if uploaded_files and st.session_state.api_key_ok:
        vs = st.session_state.vector_store
        existing_names = {d.filename for d in vs.list_documents()}

        new_files = [f for f in uploaded_files if f.name not in existing_names]
        if new_files:
            progress = st.progress(0, text="Processing files…")
            for idx, uf in enumerate(new_files):
                progress.progress((idx) / len(new_files), text=f"⚙️ Parsing {uf.name}…")
                try:
                    parsed = parse_file(uf.read(), uf.name)
                    progress.progress((idx + 0.5) / len(new_files), text=f"🧠 Embedding {uf.name}…")
                    vs.add_document(parsed, st.session_state.openai_client)
                except Exception as e:
                    st.error(f"❌ {uf.name}: {e}")
            progress.progress(1.0, text="✅ Done!")
            time.sleep(0.6)
            progress.empty()
            st.rerun()
        elif uploaded_files and not new_files:
            st.caption("All files already indexed.")
    elif uploaded_files and not st.session_state.api_key_ok:
        st.warning("Add your API key first.")

    # ── Document list ─────────────────────────────────────────────────────────
    docs = st.session_state.vector_store.list_documents()

    if docs:
        st.markdown(f"""
        <div class="stat-chip" style="margin-bottom:0.75rem;">
          📚 {len(docs)} document{'s' if len(docs)!=1 else ''} indexed
        </div>
        """, unsafe_allow_html=True)

        all_ids = [d.file_id for d in docs]
        sel = st.session_state.selected_docs

        # Select / deselect all
        col1, col2 = st.columns(2)
        with col1:
            if st.button("Select all", use_container_width=True):
                st.session_state.selected_docs = all_ids[:]
                st.rerun()
        with col2:
            if st.button("Deselect all", use_container_width=True):
                st.session_state.selected_docs = []
                st.rerun()

        for doc in docs:
            checked = doc.file_id in st.session_state.selected_docs
            meta_parts = [_fmt_words(doc.word_count), f"{doc.chunk_count} chunks"]
            if doc.pages:
                meta_parts.insert(0, f"{doc.pages} pages")

            c1, c2 = st.columns([0.08, 0.92])
            with c1:
                new_checked = st.checkbox("", value=checked, key=f"chk_{doc.file_id}", label_visibility="collapsed")
                if new_checked != checked:
                    if new_checked:
                        st.session_state.selected_docs.append(doc.file_id)
                    else:
                        st.session_state.selected_docs.remove(doc.file_id)
                    st.rerun()
            with c2:
                st.markdown(f"""
                <div class="doc-card">
                  <div class="doc-name">{_emoji(doc.file_type)} {doc.filename}</div>
                  <div class="doc-meta">{" · ".join(meta_parts)}</div>
                </div>
                """, unsafe_allow_html=True)

            if st.button("🗑", key=f"del_{doc.file_id}", help=f"Remove {doc.filename}"):
                st.session_state.vector_store.remove_document(doc.file_id)
                if doc.file_id in st.session_state.selected_docs:
                    st.session_state.selected_docs.remove(doc.file_id)
                st.rerun()

        scope_msg = (
            f"Querying **{len(sel)}** of **{len(docs)}** documents"
            if sel else f"Querying **all {len(docs)}** documents"
        )
        st.caption(scope_msg)
    else:
        st.markdown("""
        <div style="text-align:center;padding:1.5rem 0;">
          <div style="font-size:2rem;margin-bottom:0.5rem;">📂</div>
          <div style="color:#64748b;font-size:0.8rem;">No documents yet</div>
          <div style="color:#475569;font-size:0.72rem;margin-top:4px;">Upload files above</div>
        </div>
        """, unsafe_allow_html=True)

    st.divider()

    # ── Clear chat ────────────────────────────────────────────────────────────
    if st.button("🗑️ Clear conversation", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

    st.caption("GPT-4o mini · text-embedding-3-small")


# ─────────────────────────────────────────────────────────────────────────────
# Main content
# ─────────────────────────────────────────────────────────────────────────────

# Header
st.markdown("""
<div class="q-header">
  <div class="q-header-logo">🔷</div>
  <div>
    <div class="q-header-title">Qualcomm Document Intelligence</div>
    <div class="q-header-sub">
      Upload complex documents — DDQs, contracts, reports, spreadsheets —
      and get accurate AI-powered answers with source citations.
    </div>
  </div>
</div>
""", unsafe_allow_html=True)

vs   = st.session_state.vector_store
docs = vs.list_documents()
msgs = st.session_state.messages

# ── Welcome / empty state ─────────────────────────────────────────────────────
if not msgs:
    SUGGESTIONS = [
        "📋 Summarize the key findings in the uploaded documents",
        "⚠️  What are the main risks or concerns mentioned?",
        "✅  List all compliance and regulatory requirements",
        "💰  Extract and summarize the financial data",
        "🔧  What technologies or products are described?",
        "📊  Create a structured overview of the document sections",
    ]

    st.markdown("""
    <div style="text-align:center;padding:2rem 0 1rem;">
      <div style="font-size:3rem;margin-bottom:0.75rem;">🧠</div>
      <h2 style="color:white;font-weight:700;font-size:1.4rem;margin:0;">
        Ask anything about your documents
      </h2>
      <p style="color:#64748b;font-size:0.875rem;margin-top:0.5rem;max-width:520px;margin-inline:auto;line-height:1.6;">
        Perfect for DDQs, compliance reports, legal contracts, technical specs,
        and financial documents. Get precise answers with exact source citations.
      </p>
    </div>
    """, unsafe_allow_html=True)

    if docs:
        cols = st.columns(2)
        for i, s in enumerate(SUGGESTIONS):
            with cols[i % 2]:
                if st.button(s, use_container_width=True, key=f"sug_{i}"):
                    st.session_state.messages.append({"role": "user", "content": s})
                    st.rerun()
    else:
        st.markdown("""
        <div style="text-align:center;padding:1rem;">
          <div style="background:rgba(50,83,220,0.08);border:1px dashed rgba(50,83,220,0.3);
                      border-radius:14px;padding:1.5rem;max-width:480px;margin:auto;">
            <div style="font-size:1.5rem;margin-bottom:0.5rem;">👈</div>
            <div style="color:#94a3b8;font-size:0.85rem;">
              Upload documents using the sidebar to get started
            </div>
          </div>
        </div>
        """, unsafe_allow_html=True)

# ── Render conversation history ───────────────────────────────────────────────
for msg in msgs:
    if msg["role"] == "user":
        st.markdown(f"""
        <div class="msg-label user">You</div>
        <div class="msg-user">{msg["content"]}</div>
        """, unsafe_allow_html=True)
    else:
        st.markdown('<div class="msg-label ai">⚡ Qualcomm AI</div>', unsafe_allow_html=True)
        content_html = _render_content_with_citations(msg["content"])
        st.markdown(f'<div class="msg-ai">{content_html}</div>', unsafe_allow_html=True)

        # Render citations in expander
        citations = msg.get("citations", [])
        if citations:
            with st.expander(f"📚 {len(citations)} source{'s' if len(citations)!=1 else ''} cited", expanded=False):
                for c in citations:
                    pct = int(c["score"] * 100)
                    color = _score_color(c["score"])
                    st.markdown(f"""
                    <div class="src-card">
                      <div style="display:flex;align-items:flex-start;gap:10px;">
                        <div class="src-num">{c["source_id"]}</div>
                        <div style="flex:1;min-width:0;">
                          <div class="src-title">{c["filename"]}</div>
                          <div class="src-meta">Chunk {c["chunk_index"]+1}/{c["total_chunks"]}</div>
                          <div class="score-bar-wrap">
                            <div class="score-bar">
                              <div class="score-fill" style="width:{pct}%;background:linear-gradient(90deg,{color},{color}99);"></div>
                            </div>
                            <div class="score-text" style="color:{color};">{pct}% match</div>
                          </div>
                          <div class="src-text">{c["excerpt"]}</div>
                        </div>
                      </div>
                    </div>
                    """, unsafe_allow_html=True)


# ── Chat input ────────────────────────────────────────────────────────────────
placeholder = (
    "Ask a question about your documents… (e.g. 'What are the key risks?')"
    if docs else "Upload documents first…"
)

user_query = st.chat_input(
    placeholder,
    disabled=not (st.session_state.api_key_ok and docs),
)

if user_query:
    query = user_query.strip()
    if not query:
        st.stop()

    # Show user message immediately
    st.markdown(f"""
    <div class="msg-label user">You</div>
    <div class="msg-user">{query}</div>
    """, unsafe_allow_html=True)

    # Retrieve relevant chunks
    file_ids = st.session_state.selected_docs or None
    with st.spinner("🔍 Searching knowledge base…"):
        try:
            chunks = vs.search(query, st.session_state.openai_client, top_k=6, file_ids=file_ids)
        except Exception as e:
            st.error(f"Search error: {e}")
            st.stop()

    # Stream response
    st.markdown('<div class="msg-label ai">⚡ Qualcomm AI</div>', unsafe_allow_html=True)

    response_container = st.empty()
    full_response = ""

    try:
        for token in stream_answer(query, chunks, st.session_state.openai_client):
            full_response += token
            display = _render_content_with_citations(full_response)
            response_container.markdown(
                f'<div class="msg-ai">{display}<span style="display:inline-block;width:2px;height:14px;background:#3253DC;margin-left:2px;animation:pulse 1s infinite;vertical-align:middle;"></span></div>',
                unsafe_allow_html=True,
            )
    except Exception as e:
        full_response = f"An error occurred: {e}"
        response_container.error(full_response)

    # Final render without cursor
    display_final = _render_content_with_citations(full_response)
    response_container.markdown(
        f'<div class="msg-ai">{display_final}</div>',
        unsafe_allow_html=True,
    )

    # Show citations inline
    if chunks:
        with st.expander(f"📚 {len(chunks)} source{'s' if len(chunks)!=1 else ''} cited", expanded=True):
            for c in chunks:
                pct = int(c["score"] * 100)
                color = _score_color(c["score"])
                st.markdown(f"""
                <div class="src-card">
                  <div style="display:flex;align-items:flex-start;gap:10px;">
                    <div class="src-num">{c["source_id"]}</div>
                    <div style="flex:1;min-width:0;">
                      <div class="src-title">{c["filename"]}</div>
                      <div class="src-meta">Chunk {c["chunk_index"]+1}/{c["total_chunks"]}</div>
                      <div class="score-bar-wrap">
                        <div class="score-bar">
                          <div class="score-fill" style="width:{pct}%;background:linear-gradient(90deg,{color},{color}99);"></div>
                        </div>
                        <div class="score-text" style="color:{color};">{pct}% match</div>
                      </div>
                      <div class="src-text">{c["excerpt"]}</div>
                    </div>
                  </div>
                </div>
                """, unsafe_allow_html=True)

    # Persist to session
    st.session_state.messages.append({"role": "user", "content": query})
    st.session_state.messages.append({
        "role": "assistant",
        "content": full_response,
        "citations": chunks,
    })
    st.rerun()
