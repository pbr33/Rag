import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatInterface from './components/ChatInterface.jsx';
import axios from 'axios';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [initError, setInitError] = useState(null);

  // Check health & load existing docs on mount
  useEffect(() => {
    const init = async () => {
      try {
        await axios.get('/api/health');
        setIsConnected(true);
        const res = await axios.get('/api/documents');
        setDocuments(res.data.documents || []);
      } catch (err) {
        setIsConnected(false);
        setInitError('Cannot connect to backend. Make sure the server is running on port 3001.');
      }
    };
    init();
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-qdark-800">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-qblue-600/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-qpurple/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <Header docCount={documents.length} isConnected={isConnected} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">
        {initError ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-8 max-w-md text-center"
            >
              <div className="text-4xl mb-4">⚠️</div>
              <h2 className="text-lg font-semibold text-white mb-2">Connection Failed</h2>
              <p className="text-sm text-slate-400 mb-4">{initError}</p>
              <div className="bg-black/30 rounded-xl p-4 text-left">
                <p className="text-xs text-slate-400 mb-2 font-mono">Start the backend:</p>
                <code className="text-xs text-emerald-400 font-mono block">
                  cd backend && npm install && npm start
                </code>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-qblue-600/30 hover:bg-qblue-600/50 text-qblue-300 text-sm rounded-xl border border-qblue-600/30 transition-colors"
              >
                Retry Connection
              </button>
            </motion.div>
          </div>
        ) : (
          <>
            <Sidebar
              documents={documents}
              setDocuments={setDocuments}
              selectedDocs={selectedDocs}
              setSelectedDocs={setSelectedDocs}
            />
            <ChatInterface
              documents={documents}
              selectedDocs={selectedDocs}
            />
          </>
        )}
      </div>
    </div>
  );
}
