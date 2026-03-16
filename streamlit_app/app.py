"""
Qualcomm Document Intelligence — Streamlit RAG Application
Azure OpenAI · Real-time streaming · Citations · Batch Q&A
"""
from __future__ import annotations
import os, io, re, time
from pathlib import Path
import pandas as pd
import streamlit as st
from dotenv import load_dotenv
from openai import AzureOpenAI

from services.file_parser import parse_file
from services.vector_store import VectorStore
from services.rag_service import stream_answer, get_answer, build_context

# ─────────────────────────────────────────────────────────────────────────────
# Page config — must be first Streamlit call
# ─────────────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Qualcomm Document Intelligence",
    page_icon="🔷",
    layout="wide",
    initial_sidebar_state="expanded",
)
load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# CSS — Dark glassmorphism, Qualcomm brand
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

:root {
    --q-blue:   #3253DC;
    --q-indigo: #4f46e5;
    --q-purple: #7c3aed;
    --q-bg:     #07090f;
    --q-surface:#0d1117;
    --q-card:   #111827;
    --q-border: rgba(50,83,220,0.18);
    --q-text:   #e2e8f0;
    --q-muted:  #64748b;
    --q-green:  #22c55e;
    --q-yellow: #eab308;
    --q-red:    #ef4444;
}

html, body, [data-testid="stAppViewContainer"] {
    font-family: 'Inter', sans-serif !important;
    background: var(--q-bg) !important;
    color: var(--q-text) !important;
}

/* Ambient glows */
[data-testid="stAppViewContainer"]::before {
    content:''; position:fixed; top:-20vw; left:-10vw;
    width:55vw; height:55vw;
    background:radial-gradient(circle, rgba(50,83,220,0.06) 0%, transparent 65%);
    pointer-events:none; z-index:0;
}
[data-testid="stAppViewContainer"]::after {
    content:''; position:fixed; bottom:-20vw; right:-10vw;
    width:55vw; height:55vw;
    background:radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 65%);
    pointer-events:none; z-index:0;
}

/* ── Sidebar ─────────────────────────────────────────────────────── */
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #0a0e1a 0%, #080c12 100%) !important;
    border-right: 1px solid var(--q-border) !important;
}
[data-testid="stSidebar"] * { font-family: 'Inter', sans-serif !important; }

/* ── Main block ──────────────────────────────────────────────────── */
.main .block-container {
    padding: 1.25rem 2rem 4rem !important;
    max-width: 1440px !important;
}

#MainMenu, footer, header { visibility: hidden; }

/* ── Top nav bar ─────────────────────────────────────────────────── */
.topbar {
    display: flex; align-items: center;
    gap: 0; margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--q-border);
    padding-bottom: 0;
}
.topbar-logo {
    display:flex; align-items:center; gap:12px;
    padding: 0 1.5rem 1rem 0;
    border-right: 1px solid var(--q-border);
    margin-right: 1.5rem;
}
.topbar-logo-icon {
    width:40px; height:40px;
    background: linear-gradient(135deg, var(--q-blue), var(--q-purple));
    border-radius: 10px;
    display:flex; align-items:center; justify-content:center;
    font-size:1.25rem;
    box-shadow: 0 0 20px rgba(50,83,220,0.35);
}
.topbar-brand { font-size:1.05rem; font-weight:800; color:white; line-height:1.2; }
.topbar-brand-sub { font-size:0.68rem; color:var(--q-muted); font-weight:400; }

/* ── Tab nav ─────────────────────────────────────────────────────── */
[data-testid="stTabs"] { background: transparent !important; }
[data-testid="stTabsTabList"] {
    background: rgba(13,17,23,0.6) !important;
    border: 1px solid var(--q-border) !important;
    border-radius: 12px !important;
    padding: 4px !important;
    gap: 4px !important;
}
[data-testid="stTabsTabList"] button {
    border-radius: 8px !important;
    font-family: 'Inter', sans-serif !important;
    font-weight: 500 !important;
    font-size: 0.85rem !important;
    color: var(--q-muted) !important;
    transition: all 0.2s !important;
    padding: 0.5rem 1.25rem !important;
}
[data-testid="stTabsTabList"] button[aria-selected="true"] {
    background: linear-gradient(135deg, var(--q-blue), var(--q-purple)) !important;
    color: white !important;
    box-shadow: 0 2px 12px rgba(50,83,220,0.4) !important;
}
[data-testid="stTabsTabList"] button:hover:not([aria-selected="true"]) {
    background: rgba(50,83,220,0.12) !important;
    color: #a5b4fc !important;
}

/* ── Cards ───────────────────────────────────────────────────────── */
.q-card {
    background: rgba(17,24,39,0.8);
    border: 1px solid var(--q-border);
    border-radius: 14px;
    padding: 1.2rem 1.4rem;
    margin-bottom: 0.9rem;
    backdrop-filter: blur(16px);
}

/* ── Stat pills ──────────────────────────────────────────────────── */
.stat-pill {
    display:inline-flex; align-items:center; gap:6px;
    background: rgba(50,83,220,0.1);
    border: 1px solid rgba(50,83,220,0.22);
    border-radius: 999px;
    padding: 3px 11px;
    font-size: 0.72rem; color:#a5b4fc; font-weight:600;
}
.stat-pill.green {
    background:rgba(34,197,94,0.1); border-color:rgba(34,197,94,0.25); color:#4ade80;
}
.stat-pill.yellow {
    background:rgba(234,179,8,0.1); border-color:rgba(234,179,8,0.25); color:#fbbf24;
}

/* ── Chat messages ───────────────────────────────────────────────── */
.msg-row { display:flex; gap:12px; margin:0.6rem 0; align-items:flex-start; }
.msg-row.user { flex-direction:row-reverse; }

.msg-avatar {
    width:34px; height:34px; border-radius:10px;
    display:flex; align-items:center; justify-content:center;
    font-size:0.95rem; flex-shrink:0;
}
.msg-avatar.ai {
    background: linear-gradient(135deg, var(--q-blue), var(--q-purple));
    box-shadow: 0 0 14px rgba(50,83,220,0.35);
}
.msg-avatar.user { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); }

.msg-bubble {
    max-width: 78%; border-radius: 14px;
    padding: 0.85rem 1.1rem;
    font-size: 0.875rem; line-height: 1.7;
    color: var(--q-text);
}
.msg-bubble.ai {
    background: rgba(17,24,39,0.9);
    border: 1px solid var(--q-border);
    border-top-left-radius: 4px;
}
.msg-bubble.user {
    background: linear-gradient(135deg, rgba(50,83,220,0.28), rgba(124,58,237,0.28));
    border: 1px solid rgba(50,83,220,0.32);
    border-top-right-radius: 4px;
}
.msg-meta { font-size:0.67rem; color:var(--q-muted); margin-bottom:5px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; }

/* ── Citation badge ──────────────────────────────────────────────── */
.cite-badge {
    display:inline-block;
    background: rgba(50,83,220,0.18);
    border: 1px solid rgba(50,83,220,0.38);
    color: #818cf8;
    border-radius: 4px;
    padding: 0 5px;
    font-size: 0.7rem; font-weight:700;
    margin: 0 1px;
    vertical-align: middle;
}

/* ── Source card ─────────────────────────────────────────────────── */
.src-card {
    background: rgba(17,24,39,0.95);
    border: 1px solid rgba(50,83,220,0.14);
    border-radius: 10px;
    padding: 0.75rem 0.9rem;
    margin-bottom: 0.5rem;
    transition: border-color 0.15s;
}
.src-card:hover { border-color: rgba(50,83,220,0.4); }
.src-num {
    display:inline-flex; align-items:center; justify-content:center;
    width:20px; height:20px;
    background: linear-gradient(135deg, var(--q-blue), var(--q-purple));
    border-radius:5px;
    font-size:0.65rem; font-weight:800; color:white; flex-shrink:0;
}
.src-title { font-size:0.78rem; font-weight:600; color:#c7d2fe; }
.src-meta  { font-size:0.68rem; color:var(--q-muted); margin-top:1px; }
.src-text  {
    font-size:0.72rem; color:#94a3b8; line-height:1.5;
    background:rgba(0,0,0,0.3); border-radius:6px;
    padding:0.45rem 0.65rem; margin-top:0.45rem;
    font-family: monospace;
    max-height:110px; overflow-y:auto;
    white-space:pre-wrap; word-break:break-word;
}
.score-bar-row { display:flex; align-items:center; gap:7px; margin-top:4px; }
.score-bar { flex:1; height:3px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; }
.score-fill { height:100%; border-radius:2px; }
.score-txt  { font-size:0.63rem; font-weight:700; white-space:nowrap; }

/* ── Doc card sidebar ────────────────────────────────────────────── */
.doc-card {
    background: rgba(15,20,30,0.9);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 9px;
    padding: 0.55rem 0.75rem;
    margin-bottom: 0.35rem;
    transition: border-color 0.15s;
}
.doc-card:hover { border-color: rgba(50,83,220,0.3); }
.doc-name { color:#e2e8f0; font-size:0.78rem; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.doc-meta { color:var(--q-muted); font-size:0.67rem; margin-top:2px; }

/* ── File uploader ───────────────────────────────────────────────── */
[data-testid="stFileUploader"] {
    border: 2px dashed rgba(50,83,220,0.28) !important;
    border-radius: 11px !important;
    background: rgba(50,83,220,0.03) !important;
    transition: all 0.2s !important;
}
[data-testid="stFileUploader"]:hover {
    border-color: rgba(50,83,220,0.55) !important;
    background: rgba(50,83,220,0.07) !important;
}

/* ── Chat input ──────────────────────────────────────────────────── */
[data-testid="stChatInput"] textarea {
    background: rgba(13,17,23,0.95) !important;
    border: 1px solid var(--q-border) !important;
    border-radius: 13px !important;
    color: var(--q-text) !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 0.9rem !important;
}
[data-testid="stChatInput"] textarea:focus {
    border-color: var(--q-blue) !important;
    box-shadow: 0 0 0 3px rgba(50,83,220,0.18) !important;
}

/* ── Buttons ─────────────────────────────────────────────────────── */
.stButton > button {
    background: linear-gradient(135deg, var(--q-blue), var(--q-purple)) !important;
    color: white !important; border: none !important;
    border-radius: 9px !important; font-weight: 600 !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 0.82rem !important;
    transition: opacity 0.18s, transform 0.1s !important;
}
.stButton > button:hover { opacity:0.86 !important; transform:translateY(-1px) !important; }
.stButton > button:active { transform:translateY(0) !important; }

/* ── Download button ─────────────────────────────────────────────── */
[data-testid="stDownloadButton"] > button {
    background: linear-gradient(135deg, #16a34a, #15803d) !important;
    color: white !important; border: none !important;
    border-radius: 9px !important; font-weight: 600 !important;
}

/* ── Progress ────────────────────────────────────────────────────── */
.stProgress > div > div { background:linear-gradient(90deg, var(--q-blue), var(--q-purple)) !important; }

/* ── Expander ────────────────────────────────────────────────────── */
[data-testid="stExpander"] {
    background: rgba(13,17,23,0.75) !important;
    border: 1px solid var(--q-border) !important;
    border-radius: 11px !important;
}

/* ── Text input / select ─────────────────────────────────────────── */
[data-testid="stTextInput"] input,
[data-testid="stSelectbox"] select,
textarea {
    background: rgba(13,17,23,0.9) !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 8px !important;
    color: var(--q-text) !important;
    font-family: 'Inter', sans-serif !important;
}
[data-testid="stTextInput"] input:focus { border-color: var(--q-blue) !important; }

/* ── Batch results table ─────────────────────────────────────────── */
.batch-row {
    background: rgba(17,24,39,0.85);
    border: 1px solid var(--q-border);
    border-radius: 12px;
    padding: 1rem 1.2rem;
    margin-bottom: 0.75rem;
}
.batch-q { font-size:0.82rem; font-weight:600; color:#a5b4fc; margin-bottom:6px; }
.batch-q::before { content:"Q: "; color:#818cf8; }
.batch-a { font-size:0.82rem; color:var(--q-text); line-height:1.65; }

/* ── Welcome hero ────────────────────────────────────────────────── */
.hero {
    text-align:center; padding:3rem 0 2rem;
}
.hero-icon { font-size:3.5rem; margin-bottom:1rem; }
.hero-title { font-size:1.5rem; font-weight:800; color:white; margin:0; }
.hero-sub {
    font-size:0.875rem; color:var(--q-muted);
    margin-top:0.6rem; max-width:540px; margin-inline:auto; line-height:1.65;
}

/* ── Scrollbars ──────────────────────────────────────────────────── */
* { scrollbar-width:thin; scrollbar-color:rgba(50,83,220,0.35) rgba(0,0,0,0.15); }

hr { border-color: rgba(50,83,220,0.1) !important; }

/* ── Azure config section ────────────────────────────────────────── */
.config-section {
    background: rgba(50,83,220,0.05);
    border: 1px solid rgba(50,83,220,0.15);
    border-radius: 10px;
    padding: 0.8rem 1rem;
    margin-bottom: 0.75rem;
}
.config-label {
    font-size: 0.67rem; font-weight: 700; letter-spacing: 0.06em;
    color: #818cf8; text-transform: uppercase; margin-bottom: 6px;
}
</style>
""", unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
# Session state
# ─────────────────────────────────────────────────────────────────────────────
def _init():
    defaults = {
        "messages":        [],
        "vector_store":    VectorStore(),
        "az_client":       None,
        "az_ok":           False,
        "chat_deploy":     "",
        "embed_deploy":    "",
        "selected_docs":   [],
        "batch_results":   [],
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

_init()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
TYPE_EMOJI = {
    "pdf": "📄", "docx": "📝", "doc": "📝",
    "xlsx": "📊", "xls": "📊", "csv": "📊",
    "txt": "📃", "md": "📃",
}

def _emoji(t): return TYPE_EMOJI.get(t, "📁")
def _fmt_words(n): return f"{n/1000:.1f}k" if n >= 1000 else str(n)

def _score_color(s):
    if s >= 0.78: return "#4ade80"
    if s >= 0.55: return "#fbbf24"
    return "#94a3b8"

def _render_citations(text: str) -> str:
    return re.sub(
        r'\[SOURCE_(\d+)\]',
        lambda m: f'<span class="cite-badge">[{m.group(1)}]</span>',
        text,
    )

def _source_cards_html(chunks: list[dict]) -> str:
    parts = []
    for c in chunks:
        pct  = int(c["score"] * 100)
        col  = _score_color(c["score"])
        parts.append(f"""
        <div class="src-card">
          <div style="display:flex;align-items:flex-start;gap:9px;">
            <div class="src-num">{c["source_id"]}</div>
            <div style="flex:1;min-width:0;">
              <div class="src-title">{c["filename"]}</div>
              <div class="src-meta">chunk {c["chunk_index"]+1}/{c["total_chunks"]}</div>
              <div class="score-bar-row">
                <div class="score-bar">
                  <div class="score-fill" style="width:{pct}%;background:{col};opacity:0.9;"></div>
                </div>
                <div class="score-txt" style="color:{col};">{pct}%</div>
              </div>
              <div class="src-text">{c["excerpt"]}</div>
            </div>
          </div>
        </div>""")
    return "".join(parts)

def _build_xlsx(results: list[dict]) -> bytes:
    rows = []
    for r in results:
        sources = "; ".join(
            f'{c["filename"]} (chunk {c["chunk_index"]+1}, {int(c["score"]*100)}%)'
            for c in r.get("chunks", [])
        )
        rows.append({
            "#": r["idx"],
            "Question": r["question"],
            "Answer": r["answer"],
            "Sources": sources,
            "Top Match %": int(r["chunks"][0]["score"] * 100) if r.get("chunks") else 0,
        })
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Q&A Results")
        ws = writer.sheets["Q&A Results"]
        ws.column_dimensions["B"].width = 50
        ws.column_dimensions["C"].width = 80
        ws.column_dimensions["D"].width = 60
    return buf.getvalue()

def _build_csv(results: list[dict]) -> bytes:
    rows = []
    for r in results:
        sources = "; ".join(
            f'{c["filename"]} (chunk {c["chunk_index"]+1})'
            for c in r.get("chunks", [])
        )
        rows.append({"#": r["idx"], "Question": r["question"], "Answer": r["answer"], "Sources": sources})
    return pd.DataFrame(rows).to_csv(index=False).encode()

def _parse_question_file(data: bytes, filename: str) -> list[str]:
    ext = Path(filename).suffix.lower()
    if ext == ".txt":
        lines = data.decode("utf-8", errors="replace").splitlines()
        return [l.strip() for l in lines if l.strip() and not l.startswith("#")]
    if ext == ".csv":
        df = pd.read_csv(io.BytesIO(data))
    elif ext in (".xlsx", ".xls"):
        df = pd.read_excel(io.BytesIO(data))
    else:
        raise ValueError("Question file must be TXT, CSV, or XLSX")
    # Find a column named question / Question / QUESTION, else use first column
    cols_lower = {c.lower(): c for c in df.columns}
    col = cols_lower.get("question") or cols_lower.get("questions") or df.columns[0]
    return [str(q).strip() for q in df[col].dropna() if str(q).strip()]


# ─────────────────────────────────────────────────────────────────────────────
# Sidebar — Azure config + Knowledge Base
# ─────────────────────────────────────────────────────────────────────────────
with st.sidebar:
    # Logo
    st.markdown("""
    <div style="display:flex;align-items:center;gap:11px;margin-bottom:1.2rem;padding-bottom:1rem;border-bottom:1px solid rgba(50,83,220,0.15);">
      <div style="width:38px;height:38px;background:linear-gradient(135deg,#3253DC,#7c3aed);
                  border-radius:10px;display:flex;align-items:center;justify-content:center;
                  font-size:1.15rem;box-shadow:0 0 14px rgba(50,83,220,0.4);flex-shrink:0;">🔷</div>
      <div>
        <div style="font-size:0.88rem;font-weight:800;color:white;line-height:1.2;">Qualcomm</div>
        <div style="font-size:0.65rem;color:#64748b;font-weight:400;">Document Intelligence</div>
      </div>
    </div>
    """, unsafe_allow_html=True)

    # ── Azure OpenAI Config ───────────────────────────────────────────────────
    with st.expander("🔑 Azure OpenAI Config", expanded=not st.session_state.az_ok):
        az_endpoint = st.text_input(
            "Endpoint",
            value=os.getenv("AZURE_OPENAI_ENDPOINT", ""),
            placeholder="https://your-resource.openai.azure.com/",
            help="Your Azure OpenAI resource endpoint URL",
        )
        az_key = st.text_input(
            "API Key",
            value=os.getenv("AZURE_OPENAI_KEY", ""),
            type="password",
            placeholder="••••••••••••••••",
        )
        az_version = st.text_input(
            "API Version",
            value=os.getenv("AZURE_OPENAI_VERSION", "2024-02-15-preview"),
            placeholder="2024-02-15-preview",
        )
        chat_deploy = st.text_input(
            "Chat Deployment Name",
            value=os.getenv("AZURE_CHAT_DEPLOYMENT", "gpt-4o-mini"),
            placeholder="gpt-4o-mini",
            help="Your deployed model name for chat (e.g. gpt-4o-mini)",
        )
        embed_deploy = st.text_input(
            "Embedding Deployment Name",
            value=os.getenv("AZURE_EMBED_DEPLOYMENT", "text-embedding-3-small"),
            placeholder="text-embedding-3-small",
            help="Your deployed model name for embeddings",
        )

        if st.button("✓ Connect", use_container_width=True):
            if az_endpoint and az_key and az_version and chat_deploy and embed_deploy:
                try:
                    client = AzureOpenAI(
                        azure_endpoint=az_endpoint.rstrip("/"),
                        api_key=az_key,
                        api_version=az_version,
                    )
                    # Quick test
                    client.embeddings.create(model=embed_deploy, input=["test"])
                    st.session_state.az_client    = client
                    st.session_state.chat_deploy  = chat_deploy
                    st.session_state.embed_deploy = embed_deploy
                    st.session_state.az_ok        = True
                    st.rerun()
                except Exception as e:
                    st.error(f"Connection failed: {e}")
            else:
                st.warning("Fill in all fields.")

    if st.session_state.az_ok:
        st.markdown("""
        <div class="stat-pill green" style="margin-bottom:0.8rem;">
          ✓ Connected to Azure OpenAI
        </div>
        """, unsafe_allow_html=True)
        if st.button("Disconnect", use_container_width=False):
            st.session_state.az_ok     = False
            st.session_state.az_client = None
            st.rerun()

    st.divider()

    # ── Knowledge Base ────────────────────────────────────────────────────────
    st.markdown('<div style="font-size:0.75rem;font-weight:700;color:#818cf8;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.6rem;">📂 Knowledge Base</div>', unsafe_allow_html=True)

    uploaded_files = st.file_uploader(
        "Drop files here",
        type=["pdf", "docx", "doc", "txt", "md", "xlsx", "xls", "csv"],
        accept_multiple_files=True,
        label_visibility="collapsed",
    )

    if uploaded_files and st.session_state.az_ok:
        vs = st.session_state.vector_store
        existing = {d.filename for d in vs.list_documents()}
        new_files = [f for f in uploaded_files if f.name not in existing]
        if new_files:
            bar = st.progress(0, text="Processing…")
            for i, uf in enumerate(new_files):
                bar.progress(i / len(new_files), text=f"⚙️ {uf.name}")
                try:
                    parsed = parse_file(uf.read(), uf.name)
                    bar.progress((i + 0.5) / len(new_files), text=f"🧠 Embedding {uf.name}…")
                    vs.add_document(parsed, st.session_state.az_client, st.session_state.embed_deploy)
                except Exception as e:
                    st.error(f"❌ {uf.name}: {e}")
            bar.progress(1.0, text="✅ Done!")
            time.sleep(0.5)
            bar.empty()
            st.rerun()
    elif uploaded_files and not st.session_state.az_ok:
        st.caption("⚠️ Connect to Azure OpenAI first.")

    # ── Document list ─────────────────────────────────────────────────────────
    docs = st.session_state.vector_store.list_documents()
    if docs:
        total_words = sum(d.word_count for d in docs)
        st.markdown(f"""
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:0.65rem;">
          <div class="stat-pill">📚 {len(docs)} doc{'s' if len(docs)!=1 else ''}</div>
          <div class="stat-pill">📝 {_fmt_words(total_words)} words</div>
        </div>
        """, unsafe_allow_html=True)

        c1, c2 = st.columns(2)
        with c1:
            if st.button("All", use_container_width=True):
                st.session_state.selected_docs = [d.file_id for d in docs]
                st.rerun()
        with c2:
            if st.button("None", use_container_width=True):
                st.session_state.selected_docs = []
                st.rerun()

        for doc in docs:
            checked = doc.file_id in st.session_state.selected_docs
            col_chk, col_info, col_del = st.columns([0.08, 0.75, 0.17])
            with col_chk:
                new = st.checkbox("", value=checked, key=f"chk_{doc.file_id}", label_visibility="collapsed")
                if new != checked:
                    if new: st.session_state.selected_docs.append(doc.file_id)
                    else:   st.session_state.selected_docs.remove(doc.file_id)
                    st.rerun()
            with col_info:
                meta = f"{_fmt_words(doc.word_count)}w · {doc.chunk_count} chunks"
                if doc.pages: meta = f"{doc.pages}p · " + meta
                st.markdown(f"""
                <div class="doc-card">
                  <div class="doc-name">{_emoji(doc.file_type)} {doc.filename}</div>
                  <div class="doc-meta">{meta}</div>
                </div>
                """, unsafe_allow_html=True)
            with col_del:
                if st.button("✕", key=f"del_{doc.file_id}", help="Remove"):
                    st.session_state.vector_store.remove_document(doc.file_id)
                    if doc.file_id in st.session_state.selected_docs:
                        st.session_state.selected_docs.remove(doc.file_id)
                    st.rerun()

        sel = st.session_state.selected_docs
        scope = f"All {len(docs)} docs" if not sel else f"{len(sel)}/{len(docs)} selected"
        st.caption(f"🔍 Querying: {scope}")
    else:
        st.markdown("""
        <div style="text-align:center;padding:1.2rem 0;">
          <div style="font-size:1.75rem;">📂</div>
          <div style="color:#475569;font-size:0.78rem;margin-top:4px;">Upload documents above</div>
        </div>
        """, unsafe_allow_html=True)

    st.divider()
    if st.button("🗑️ Clear chat", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

    st.markdown(f"""
    <div style="text-align:center;margin-top:0.5rem;">
      <span class="stat-pill">
        {st.session_state.chat_deploy or "—"} · {st.session_state.embed_deploy or "—"}
      </span>
    </div>
    """, unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────────────────────────
# Main — Top nav + Tabs
# ─────────────────────────────────────────────────────────────────────────────
st.markdown("""
<div class="topbar">
  <div class="topbar-logo">
    <div class="topbar-logo-icon">🔷</div>
    <div>
      <div class="topbar-brand">Document Intelligence</div>
      <div class="topbar-brand-sub">Powered by Azure OpenAI</div>
    </div>
  </div>
</div>
""", unsafe_allow_html=True)

tab_chat, tab_batch = st.tabs(["💬  Chat", "📋  Batch Q&A"])

vs   = st.session_state.vector_store
docs = vs.list_documents()
az_ok = st.session_state.az_ok
client = st.session_state.az_client
chat_d  = st.session_state.chat_deploy
embed_d = st.session_state.embed_deploy


# ═════════════════════════════════════════════════════════════════════════════
# TAB 1 — CHAT
# ═════════════════════════════════════════════════════════════════════════════
with tab_chat:
    msgs = st.session_state.messages

    # Empty state
    if not msgs:
        SUGGESTIONS = [
            "📋 Summarize the key findings",
            "⚠️  What are the main risks?",
            "✅  List compliance requirements",
            "💰  Summarize the financial data",
            "🔧  What technologies are described?",
            "📊  Give a structured document overview",
        ]
        st.markdown("""
        <div class="hero">
          <div class="hero-icon">🧠</div>
          <div class="hero-title">Ask anything about your documents</div>
          <div class="hero-sub">
            Perfect for DDQs, compliance reports, contracts, technical specs,
            and financial documents — with precise source citations.
          </div>
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
              <div style="background:rgba(50,83,220,0.06);border:1px dashed rgba(50,83,220,0.25);
                          border-radius:13px;padding:1.4rem;max-width:460px;margin:auto;">
                <div style="font-size:1.4rem;margin-bottom:0.4rem;">👈</div>
                <div style="color:#94a3b8;font-size:0.82rem;line-height:1.6;">
                  Upload your documents in the sidebar and connect to Azure OpenAI to get started.
                </div>
              </div>
            </div>
            """, unsafe_allow_html=True)

    # Render history
    for msg in msgs:
        if msg["role"] == "user":
            st.markdown(f"""
            <div class="msg-row user">
              <div class="msg-avatar user">👤</div>
              <div>
                <div class="msg-meta" style="text-align:right;">You</div>
                <div class="msg-bubble user">{msg["content"]}</div>
              </div>
            </div>
            """, unsafe_allow_html=True)
        else:
            html = _render_citations(msg["content"])
            st.markdown(f"""
            <div class="msg-row">
              <div class="msg-avatar ai">🔷</div>
              <div style="max-width:78%;">
                <div class="msg-meta">Qualcomm AI</div>
                <div class="msg-bubble ai">{html}</div>
              </div>
            </div>
            """, unsafe_allow_html=True)
            cits = msg.get("citations", [])
            if cits:
                with st.expander(f"📚 {len(cits)} source{'s' if len(cits)!=1 else ''}", expanded=False):
                    st.markdown(_source_cards_html(cits), unsafe_allow_html=True)

    # Chat input
    placeholder = (
        "Ask a question about your documents…" if (az_ok and docs)
        else "Connect Azure OpenAI and upload documents to start…"
    )
    user_query = st.chat_input(placeholder, disabled=not (az_ok and docs))

    if user_query:
        q = user_query.strip()
        if not q:
            st.stop()

        st.markdown(f"""
        <div class="msg-row user">
          <div class="msg-avatar user">👤</div>
          <div>
            <div class="msg-meta" style="text-align:right;">You</div>
            <div class="msg-bubble user">{q}</div>
          </div>
        </div>
        """, unsafe_allow_html=True)

        file_ids = st.session_state.selected_docs or None
        with st.spinner("🔍 Searching knowledge base…"):
            try:
                chunks = vs.search(q, client, embed_d, top_k=6, file_ids=file_ids)
            except Exception as e:
                st.error(f"Search error: {e}")
                st.stop()

        st.markdown("""
        <div class="msg-row">
          <div class="msg-avatar ai">🔷</div>
          <div style="max-width:78%;">
            <div class="msg-meta">Qualcomm AI</div>
        """, unsafe_allow_html=True)

        resp_box = st.empty()
        full = ""
        try:
            for tok in stream_answer(q, chunks, client, chat_d):
                full += tok
                resp_box.markdown(
                    f'<div class="msg-bubble ai">{_render_citations(full)}'
                    f'<span style="display:inline-block;width:2px;height:13px;'
                    f'background:#3253DC;margin-left:2px;vertical-align:middle;'
                    f'animation:blink 1s step-end infinite;"></span></div>',
                    unsafe_allow_html=True,
                )
        except Exception as e:
            full = f"Error: {e}"
            resp_box.error(full)

        resp_box.markdown(
            f'<div class="msg-bubble ai">{_render_citations(full)}</div>',
            unsafe_allow_html=True,
        )
        st.markdown("</div></div>", unsafe_allow_html=True)

        if chunks:
            with st.expander(f"📚 {len(chunks)} source{'s' if len(chunks)!=1 else ''}", expanded=True):
                st.markdown(_source_cards_html(chunks), unsafe_allow_html=True)

        st.session_state.messages.append({"role": "user", "content": q})
        st.session_state.messages.append({"role": "assistant", "content": full, "citations": chunks})
        st.rerun()


# ═════════════════════════════════════════════════════════════════════════════
# TAB 2 — BATCH Q&A
# ═════════════════════════════════════════════════════════════════════════════
with tab_batch:
    st.markdown("""
    <div class="q-card" style="margin-bottom:1.2rem;">
      <div style="font-size:1rem;font-weight:700;color:white;margin-bottom:4px;">📋 Batch Question Answering</div>
      <div style="font-size:0.8rem;color:#64748b;line-height:1.6;">
        Upload a file containing multiple questions (TXT — one per line; or CSV/XLSX with a <code>Question</code> column).
        The AI will answer every question using your indexed documents and produce a downloadable report.
      </div>
    </div>
    """, unsafe_allow_html=True)

    if not az_ok:
        st.warning("Connect to Azure OpenAI in the sidebar first.", icon="⚠️")
        st.stop()
    if not docs:
        st.warning("Upload at least one document to the knowledge base first.", icon="📂")
        st.stop()

    # ── Upload question file ──────────────────────────────────────────────────
    col_up, col_tmpl = st.columns([0.65, 0.35])

    with col_up:
        q_file = st.file_uploader(
            "Upload your questions file",
            type=["txt", "csv", "xlsx", "xls"],
            key="batch_q_file",
        )

    with col_tmpl:
        st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)
        tmpl_txt = "# One question per line\n# Lines starting with # are ignored\n\nWhat is the main purpose of this document?\nWhat are the key risks mentioned?\nList all compliance requirements.\nSummarize the financial highlights.\nWhat technologies or products are described?"
        st.download_button(
            "⬇ Download TXT template",
            data=tmpl_txt.encode(),
            file_name="questions_template.txt",
            mime="text/plain",
            use_container_width=True,
        )
        tmpl_df = pd.DataFrame({"Question": [
            "What is the main purpose of this document?",
            "What are the key risks mentioned?",
            "List all compliance requirements.",
            "Summarize the financial highlights.",
        ]})
        st.download_button(
            "⬇ Download XLSX template",
            data=_build_xlsx([]),  # just headers
            file_name="questions_template.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
        ) if False else None  # placeholder — show real one below

        buf_tmpl = io.BytesIO()
        tmpl_df.to_excel(buf_tmpl, index=False)
        st.download_button(
            "⬇ Download XLSX template",
            data=buf_tmpl.getvalue(),
            file_name="questions_template.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
        )

    # ── Options ───────────────────────────────────────────────────────────────
    col_opt1, col_opt2 = st.columns(2)
    with col_opt1:
        top_k_batch = st.slider("Chunks per question (top-k)", 3, 10, 5)
    with col_opt2:
        file_ids_batch = st.session_state.selected_docs or None
        scope_label = "All documents" if not file_ids_batch else f"{len(file_ids_batch)} selected doc(s)"
        st.markdown(f"""
        <div style="padding-top:1.8rem;font-size:0.8rem;color:#94a3b8;">
          🔍 Scope: <strong style="color:#a5b4fc;">{scope_label}</strong>
        </div>
        """, unsafe_allow_html=True)

    # ── Run ───────────────────────────────────────────────────────────────────
    if q_file:
        try:
            questions = _parse_question_file(q_file.read(), q_file.name)
        except Exception as e:
            st.error(f"Could not read question file: {e}")
            st.stop()

        if not questions:
            st.warning("No questions found in the file.")
            st.stop()

        st.markdown(f"""
        <div class="stat-pill" style="margin-bottom:0.8rem;">
          {len(questions)} question{'s' if len(questions)!=1 else ''} loaded
        </div>
        """, unsafe_allow_html=True)

        # Preview questions
        with st.expander("Preview questions", expanded=False):
            for i, q in enumerate(questions[:20], 1):
                st.markdown(f"`{i}.` {q}")
            if len(questions) > 20:
                st.caption(f"… and {len(questions)-20} more")

        if st.button(f"🚀 Run Batch ({len(questions)} questions)", use_container_width=True):
            results = []
            bar  = st.progress(0, text="Starting…")
            stat = st.empty()

            for i, q in enumerate(questions):
                bar.progress(i / len(questions), text=f"Q{i+1}/{len(questions)}: {q[:60]}…")
                stat.markdown(f'<div class="stat-pill">Processing {i+1} of {len(questions)}</div>', unsafe_allow_html=True)
                try:
                    chunks = vs.search(q, client, embed_d, top_k=top_k_batch, file_ids=file_ids_batch)
                    answer = get_answer(q, chunks, client, chat_d)
                except Exception as e:
                    answer = f"Error: {e}"
                    chunks = []
                results.append({"idx": i + 1, "question": q, "answer": answer, "chunks": chunks})

            bar.progress(1.0, text="✅ Complete!")
            stat.empty()
            time.sleep(0.4)
            bar.empty()

            st.session_state.batch_results = results
            st.rerun()

    # ── Results ───────────────────────────────────────────────────────────────
    results = st.session_state.batch_results
    if results:
        st.divider()
        st.markdown(f"""
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div style="font-size:1rem;font-weight:700;color:white;">
            Results — {len(results)} answer{'s' if len(results)!=1 else ''}
          </div>
        </div>
        """, unsafe_allow_html=True)

        # Download buttons
        dl1, dl2, dl3 = st.columns(3)
        with dl1:
            st.download_button(
                "⬇ Download Excel (.xlsx)",
                data=_build_xlsx(results),
                file_name="qa_results.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
            )
        with dl2:
            st.download_button(
                "⬇ Download CSV",
                data=_build_csv(results),
                file_name="qa_results.csv",
                mime="text/csv",
                use_container_width=True,
            )
        with dl3:
            # Plain text download
            txt_lines = []
            for r in results:
                txt_lines.append(f"Q{r['idx']}: {r['question']}\nA: {r['answer']}\n{'─'*60}")
            st.download_button(
                "⬇ Download TXT",
                data="\n".join(txt_lines).encode(),
                file_name="qa_results.txt",
                mime="text/plain",
                use_container_width=True,
            )

        st.markdown("<div style='height:0.5rem'></div>", unsafe_allow_html=True)

        # Render results
        for r in results:
            answer_html = _render_citations(r["answer"])
            top_score = int(r["chunks"][0]["score"] * 100) if r.get("chunks") else 0
            col = _score_color(r["chunks"][0]["score"]) if r.get("chunks") else "#94a3b8"
            with st.expander(f'Q{r["idx"]}: {r["question"][:90]}{"…" if len(r["question"])>90 else ""}', expanded=False):
                st.markdown(f"""
                <div style="margin-bottom:0.75rem;">
                  <div style="font-size:0.68rem;font-weight:700;color:#818cf8;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:4px;">Question</div>
                  <div style="font-size:0.875rem;color:#e2e8f0;font-weight:500;">{r["question"]}</div>
                </div>
                <div style="margin-bottom:0.75rem;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                    <div style="font-size:0.68rem;font-weight:700;color:#818cf8;letter-spacing:0.05em;text-transform:uppercase;">Answer</div>
                    <div class="stat-pill" style="padding:2px 8px;font-size:0.65rem;">top match {top_score}%</div>
                  </div>
                  <div style="font-size:0.875rem;color:#e2e8f0;line-height:1.7;">{answer_html}</div>
                </div>
                """, unsafe_allow_html=True)
                if r.get("chunks"):
                    st.markdown("**Sources**")
                    st.markdown(_source_cards_html(r["chunks"]), unsafe_allow_html=True)

        if st.button("🗑️ Clear results"):
            st.session_state.batch_results = []
            st.rerun()
