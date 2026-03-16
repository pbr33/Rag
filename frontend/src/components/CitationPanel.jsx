import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, ChevronDown, ChevronUp, ExternalLink, BookOpen } from 'lucide-react';

function ScoreBadge({ score }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-yellow-400' : 'text-slate-400';
  return (
    <span className={`text-[10px] font-semibold ${color}`}>{pct}% match</span>
  );
}

function CitationCard({ citation, index, isHighlighted }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className={`
        rounded-xl border transition-all duration-200
        ${isHighlighted
          ? 'border-qblue-500/50 bg-qblue-950/50 shadow-glow-blue'
          : 'border-white/5 bg-white/[0.02] hover:border-white/10'
        }
      `}
    >
      {/* Header */}
      <div
        className="flex items-start gap-2.5 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-qblue-600 to-qpurple flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-white">{citation.sourceId}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <p className="text-xs font-medium text-slate-200 truncate">{citation.filename}</p>
            <ScoreBadge score={citation.score} />
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
            {citation.excerpt}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-slate-600">
              Chunk {citation.chunkIndex + 1}/{citation.totalChunks}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-slate-600">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
      </div>

      {/* Expanded full text */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-white/5 pt-2.5">
              <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-black/20 rounded-lg p-2.5 max-h-48 overflow-y-auto">
                {citation.fullText}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CitationPanel({ citations, highlightedSource, onClose }) {
  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="shrink-0 glass border-l border-white/5 flex flex-col overflow-hidden"
      style={{ width: 320 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-qblue-400" />
          <h3 className="text-sm font-semibold text-slate-200">Sources</h3>
          <span className="bg-qblue-600/30 text-qblue-300 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
            {citations.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Citations list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {citations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-slate-500">No citations yet</p>
          </div>
        ) : (
          citations.map((citation, i) => (
            <CitationCard
              key={citation.sourceId}
              citation={citation}
              index={i}
              isHighlighted={highlightedSource === citation.sourceId}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-white/5 shrink-0">
        <p className="text-[10px] text-slate-600 text-center">
          Click [SOURCE_N] in responses to highlight
        </p>
      </div>
    </motion.aside>
  );
}
