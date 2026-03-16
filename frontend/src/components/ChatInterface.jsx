import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, BookOpen, X, MessageSquare } from 'lucide-react';
import MessageBubble from './MessageBubble.jsx';
import CitationPanel from './CitationPanel.jsx';

const SUGGESTIONS = [
  'Summarize the key findings in the document',
  'What are the main risks mentioned?',
  'List all compliance requirements',
  'What technology is described in detail?',
  'Extract the financial data and numbers',
];

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatInterface({ documents, selectedDocs }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [citations, setCitations] = useState([]);
  const [showCitations, setShowCitations] = useState(false);
  const [highlightedSource, setHighlightedSource] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCitationClick = (sourceNum) => {
    setShowCitations(true);
    setHighlightedSource(sourceNum);
    setTimeout(() => setHighlightedSource(null), 2000);
  };

  const sendMessage = async (query = input.trim()) => {
    if (!query || isLoading) return;
    if (documents.length === 0) return;

    setInput('');
    setIsLoading(true);
    setCitations([]);

    // Add user message
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: query,
      timestamp: formatTime(new Date()),
    };

    // Placeholder AI message
    const aiId = Date.now() + 1;
    const aiMsg = {
      id: aiId,
      role: 'assistant',
      content: '',
      citations: [],
      isStreaming: true,
      timestamp: '',
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          fileIds: selectedDocs.length > 0 ? selectedDocs : null,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedContent = '';
      let msgCitations = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;

          try {
            const event = JSON.parse(dataStr);

            if (event.type === 'citations') {
              msgCitations = event.citations;
              setCitations(event.citations);
              setShowCitations(true);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId ? { ...m, citations: event.citations } : m
                )
              );
            } else if (event.type === 'chunk') {
              streamedContent += event.content;
              const captured = streamedContent;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId ? { ...m, content: captured } : m
                )
              );
            } else if (event.type === 'done') {
              const now = formatTime(new Date());
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiId
                    ? { ...m, isStreaming: false, timestamp: now }
                    : m
                )
              );
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id
            ? {
                ...m,
                content: `Sorry, an error occurred: ${err.message}`,
                isStreaming: false,
                timestamp: formatTime(new Date()),
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (isLoading) abortRef.current?.abort();
    setMessages([]);
    setCitations([]);
    setShowCitations(false);
  };

  const isEmpty = messages.length === 0;
  const noDocuments = documents.length === 0;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        {messages.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-1.5">
              <MessageSquare size={12} className="text-slate-500" />
              <span className="text-xs text-slate-500">
                {messages.filter(m => m.role === 'user').length} questions
              </span>
            </div>
            <div className="flex items-center gap-2">
              {citations.length > 0 && (
                <button
                  onClick={() => setShowCitations(!showCitations)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all ${
                    showCitations
                      ? 'bg-qblue-600/30 text-qblue-300 border border-qblue-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <BookOpen size={11} />
                  Sources ({citations.length})
                </button>
              )}
              <button
                onClick={clearChat}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Welcome screen */}
          {isEmpty && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-qblue-600 to-qpurple flex items-center justify-center mb-5 shadow-glow-blue">
                <Sparkles size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Ask anything about your documents
              </h2>
              <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                {noDocuments
                  ? 'Upload PDF, DOCX, XLSX, or TXT files on the left to get started. Perfect for DDQs, reports, contracts, and complex documents.'
                  : `${documents.length} document${documents.length !== 1 ? 's' : ''} loaded. Ask questions and get accurate answers with citations.`
                }
              </p>

              {/* Suggestions */}
              {!noDocuments && (
                <div className="w-full space-y-2">
                  <p className="text-xs text-slate-500 mb-3">Try asking:</p>
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left text-sm text-slate-300 glass-light hover:border-qblue-600/40 hover:text-white px-4 py-2.5 rounded-xl transition-all duration-200 border border-white/5 hover:bg-qblue-950/30"
                    >
                      <span className="text-qblue-400 mr-2">→</span>
                      {s}
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Message list */}
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onCitationClick={handleCitationClick}
              />
            ))}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-4 py-4 border-t border-white/5 shrink-0">
          {noDocuments && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mb-3"
            >
              <p className="text-xs text-amber-400/80">
                Upload documents first to start asking questions
              </p>
            </motion.div>
          )}

          <div className={`flex gap-2 items-end glass-light rounded-2xl p-2 border transition-all duration-300
            ${noDocuments ? 'opacity-50 pointer-events-none' : ''}
            ${isLoading ? 'border-qblue-600/30' : 'border-white/5 focus-within:border-qblue-600/30'}
          `}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents..."
              disabled={isLoading || noDocuments}
              rows={1}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none outline-none max-h-32 overflow-y-auto py-1.5 px-2"
              style={{ minHeight: '36px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading || noDocuments}
              className={`
                w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200
                ${input.trim() && !isLoading && !noDocuments
                  ? 'bg-gradient-to-br from-qblue-600 to-qpurple text-white shadow-glow-blue'
                  : 'bg-white/5 text-slate-600'
                }
              `}
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <Send size={15} />
              )}
            </motion.button>
          </div>
          <p className="text-[10px] text-slate-600 text-center mt-2">
            GPT-4o mini · Shift+Enter for newline
          </p>
        </div>
      </div>

      {/* Citation panel */}
      <AnimatePresence>
        {showCitations && citations.length > 0 && (
          <CitationPanel
            citations={citations}
            highlightedSource={highlightedSource}
            onClose={() => setShowCitations(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
