import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Zap, CircleCheck } from 'lucide-react';

export default function Header({ docCount, isConnected }) {
  return (
    <header className="glass border-b border-white/5 px-6 py-3 flex items-center justify-between z-10 shrink-0">
      {/* Logo + Title */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-qblue-600 to-qpurple flex items-center justify-center shadow-glow-blue">
            <Cpu size={18} className="text-white" />
          </div>
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-qdark-800"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </div>
        <div>
          <h1 className="font-bold text-white text-base leading-none tracking-tight">
            Qualcomm{' '}
            <span className="gradient-text">Document Intelligence</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Powered by GPT-4o mini · RAG Platform</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 glass-light rounded-full px-3 py-1.5">
          <Zap size={12} className="text-qblue-400" />
          <span className="text-xs text-slate-300 font-medium">
            {docCount} {docCount === 1 ? 'document' : 'documents'} indexed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CircleCheck size={14} className={isConnected ? 'text-emerald-400' : 'text-red-400'} />
          <span className="text-xs text-slate-400">{isConnected ? 'Connected' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
}
