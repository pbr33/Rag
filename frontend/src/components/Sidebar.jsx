import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, FileText, FileSpreadsheet, File, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import FileUploadZone from './FileUploadZone.jsx';
import axios from 'axios';

const TYPE_ICONS = {
  pdf: <FileText size={14} className="text-red-400" />,
  docx: <FileText size={14} className="text-blue-400" />,
  doc: <FileText size={14} className="text-blue-400" />,
  xlsx: <FileSpreadsheet size={14} className="text-emerald-400" />,
  xls: <FileSpreadsheet size={14} className="text-emerald-400" />,
  csv: <FileSpreadsheet size={14} className="text-emerald-400" />,
  txt: <File size={14} className="text-slate-400" />,
  md: <File size={14} className="text-slate-400" />,
};

function formatWords(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k words`;
  return `${n} words`;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Sidebar({ documents, setDocuments, selectedDocs, setSelectedDocs }) {
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (fileId, filename) => {
    if (!confirm(`Remove "${filename}" from the knowledge base?`)) return;
    setDeleting(fileId);
    try {
      await axios.delete(`/api/documents/${fileId}`);
      setDocuments((prev) => prev.filter((d) => d.fileId !== fileId));
      setSelectedDocs((prev) => prev.filter((id) => id !== fileId));
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const toggleSelect = (fileId) => {
    setSelectedDocs((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const selectAll = () => {
    setSelectedDocs(documents.map((d) => d.fileId));
  };

  const clearSelection = () => setSelectedDocs([]);

  return (
    <aside className="w-72 shrink-0 flex flex-col glass border-r border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Knowledge Base</h2>
        <FileUploadZone
          onDocumentAdded={(doc) => setDocuments((prev) => [...prev, doc])}
        />
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {documents.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-4xl mb-2">📂</div>
            <p className="text-xs text-slate-500">No documents yet</p>
            <p className="text-xs text-slate-600 mt-1">Upload files to get started</p>
          </div>
        ) : (
          <>
            {/* Select controls */}
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs text-slate-500">{documents.length} files</span>
              <button
                onClick={selectedDocs.length === documents.length ? clearSelection : selectAll}
                className="text-xs text-qblue-400 hover:text-qblue-300 transition-colors"
              >
                {selectedDocs.length === documents.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <AnimatePresence>
              {documents.map((doc) => {
                const isSelected = selectedDocs.includes(doc.fileId);
                return (
                  <motion.div
                    key={doc.fileId}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`
                      relative rounded-lg p-2.5 cursor-pointer transition-all duration-200 group
                      ${isSelected
                        ? 'bg-qblue-950/60 border border-qblue-600/30'
                        : 'hover:bg-white/[0.03] border border-transparent'
                      }
                    `}
                    onClick={() => toggleSelect(doc.fileId)}
                  >
                    <div className="flex items-start gap-2">
                      {/* Checkbox */}
                      <div className="mt-0.5 shrink-0">
                        {isSelected
                          ? <CheckSquare size={13} className="text-qblue-400" />
                          : <Square size={13} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                        }
                      </div>

                      {/* Icon */}
                      <div className="mt-0.5 shrink-0">
                        {TYPE_ICONS[doc.type] || <File size={14} className="text-slate-400" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate leading-tight">
                          {doc.filename}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-500">
                            {formatWords(doc.wordCount)}
                          </span>
                          <span className="text-slate-700">·</span>
                          <span className="text-[10px] text-slate-500">
                            {doc.chunkCount} chunks
                          </span>
                          <span className="text-slate-700">·</span>
                          <span className="text-[10px] text-slate-500">
                            {timeAgo(doc.uploadedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.fileId, doc.filename);
                        }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-400 text-slate-600"
                      >
                        {deleting === doc.fileId ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                          >
                            <Trash2 size={12} />
                          </motion.div>
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Footer hint */}
      {documents.length > 0 && (
        <div className="px-4 py-3 border-t border-white/5">
          <p className="text-[10px] text-slate-600 text-center">
            {selectedDocs.length === 0
              ? 'All documents active · Select to filter'
              : `Querying ${selectedDocs.length} of ${documents.length} documents`
            }
          </p>
        </div>
      )}
    </aside>
  );
}
