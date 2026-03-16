import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Cpu, User, Copy, Check } from 'lucide-react';
import { useState } from 'react';

function CitationBadge({ num, onClick }) {
  return (
    <span
      className="citation-ref"
      onClick={() => onClick(num)}
      title={`View source ${num}`}
    >
      [{num}]
    </span>
  );
}

// Process content to replace [SOURCE_N] with interactive badges
function processContent(content, onCitationClick) {
  // Split by [SOURCE_N] pattern
  const parts = content.split(/(\[SOURCE_\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/\[SOURCE_(\d+)\]/);
    if (match) {
      return <CitationBadge key={i} num={parseInt(match[1])} onClick={onCitationClick} />;
    }
    return part;
  });
}

// Custom renderer that handles citation refs inline
function MarkdownWithCitations({ content, onCitationClick }) {
  const processedContent = content.replace(/\[SOURCE_(\d+)\]/g, '**[S$1]**');

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose-custom"
      components={{
        strong: ({ children }) => {
          const text = String(children);
          const match = text.match(/^\[S(\d+)\]$/);
          if (match) {
            return <CitationBadge num={parseInt(match[1])} onClick={onCitationClick} />;
          }
          return <strong>{children}</strong>;
        },
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
}

export default function MessageBubble({ message, onCitationClick }) {
  const { role, content, citations, isStreaming, timestamp } = message;
  const isAI = role === 'assistant';
  const [copied, setCopied] = useState(false);

  const copyContent = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`flex gap-3 ${isAI ? 'items-start' : 'items-start flex-row-reverse'}`}
    >
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5
        ${isAI
          ? 'bg-gradient-to-br from-qblue-600 to-qpurple shadow-glow-blue'
          : 'bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10'
        }
      `}>
        {isAI
          ? <Cpu size={13} className="text-white" />
          : <User size={13} className="text-slate-300" />
        }
      </div>

      {/* Bubble */}
      <div className={`flex-1 max-w-[85%] ${isAI ? '' : 'flex justify-end'}`}>
        <div className={`
          relative group rounded-2xl px-4 py-3 text-sm
          ${isAI
            ? 'glass-light rounded-tl-sm'
            : 'bg-gradient-to-br from-qblue-600/90 to-qpurple/90 text-white rounded-tr-sm shadow-glow-blue'
          }
        `}>
          {/* Typing indicator */}
          {isStreaming && content === '' && (
            <div className="flex gap-1 items-center h-5 py-1">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          )}

          {/* Content */}
          {content && (
            <>
              {isAI ? (
                <MarkdownWithCitations content={content} onCitationClick={onCitationClick} />
              ) : (
                <p className="text-sm leading-relaxed">{content}</p>
              )}
            </>
          )}

          {/* Streaming cursor */}
          {isStreaming && content && (
            <span className="inline-block w-0.5 h-4 bg-qblue-400 ml-0.5 animate-pulse" />
          )}

          {/* Copy button for AI messages */}
          {isAI && !isStreaming && content && (
            <button
              onClick={copyContent}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/5 text-slate-500 hover:text-slate-300"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          )}
        </div>

        {/* Citation count badge */}
        {isAI && citations && citations.length > 0 && !isStreaming && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onCitationClick(null)}
            className="mt-1.5 ml-1 flex items-center gap-1.5 text-[10px] text-qblue-400 hover:text-qblue-300 transition-colors"
          >
            <span className="w-1 h-1 rounded-full bg-qblue-400" />
            {citations.length} source{citations.length !== 1 ? 's' : ''} cited
          </motion.button>
        )}

        {/* Timestamp */}
        {timestamp && !isStreaming && (
          <p className={`text-[10px] text-slate-600 mt-1 ${isAI ? 'ml-1' : 'mr-1 text-right'}`}>
            {timestamp}
          </p>
        )}
      </div>
    </motion.div>
  );
}
