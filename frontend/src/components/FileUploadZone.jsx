import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import axios from 'axios';

const FILE_ICONS = {
  pdf: '📄',
  docx: '📝',
  doc: '📝',
  txt: '📃',
  md: '📃',
  xlsx: '📊',
  xls: '📊',
  csv: '📊',
};

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || '📁';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploadZone({ onDocumentAdded }) {
  const [uploads, setUploads] = useState([]); // { id, name, size, status, progress, error }

  const updateUpload = (id, patch) =>
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  const uploadFile = async (file) => {
    const id = `${Date.now()}-${file.name}`;
    setUploads((prev) => [
      { id, name: file.name, size: file.size, status: 'uploading', progress: 0 },
      ...prev,
    ]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded / e.total) * 100);
          updateUpload(id, { progress: pct });
        },
      });
      updateUpload(id, { status: 'done', progress: 100 });
      onDocumentAdded(res.data.document);

      // Auto-remove success after 3s
      setTimeout(() => setUploads((prev) => prev.filter((u) => u.id !== id)), 3000);
    } catch (err) {
      const msg = err.response?.data?.error || 'Upload failed';
      updateUpload(id, { status: 'error', error: msg });
    }
  };

  const onDrop = useCallback(
    (accepted) => {
      accepted.forEach(uploadFile);
    },
    [onDocumentAdded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    multiple: true,
  });

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all duration-300
          ${isDragActive
            ? 'border-qblue-500 bg-qblue-950/40 shadow-glow-blue'
            : 'border-white/10 hover:border-qblue-600/50 hover:bg-qblue-950/20'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2 text-center">
          <motion.div
            animate={isDragActive ? { scale: 1.15, rotate: 5 } : { scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-qblue-600/30 to-qpurple/30 flex items-center justify-center"
          >
            <Upload size={18} className={isDragActive ? 'text-qblue-400' : 'text-slate-400'} />
          </motion.div>
          <div>
            <p className="text-sm font-medium text-slate-200">
              {isDragActive ? 'Drop files here' : 'Drop files or click to upload'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">PDF, DOCX, TXT, XLSX, CSV · Max 50MB</p>
          </div>
        </div>
      </div>

      {/* Upload progress items */}
      <AnimatePresence>
        {uploads.map((upload) => (
          <motion.div
            key={upload.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="glass-light rounded-lg p-3"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{getFileIcon(upload.name)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-medium text-slate-200 truncate">{upload.name}</p>
                  <div className="shrink-0">
                    {upload.status === 'uploading' && (
                      <Loader2 size={12} className="text-qblue-400 animate-spin" />
                    )}
                    {upload.status === 'done' && (
                      <CheckCircle2 size={12} className="text-emerald-400" />
                    )}
                    {upload.status === 'error' && (
                      <AlertCircle size={12} className="text-red-400" />
                    )}
                  </div>
                </div>
                {upload.status === 'uploading' && (
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-qblue-600 to-qpurple rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${upload.progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
                {upload.status === 'done' && (
                  <p className="text-xs text-emerald-400">Indexed successfully</p>
                )}
                {upload.status === 'error' && (
                  <p className="text-xs text-red-400 truncate">{upload.error}</p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
