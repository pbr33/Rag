import { useState } from 'react'
import { ChatSidebar } from '../components/chat/ChatSidebar'
import { ChatWindow } from '../components/chat/ChatWindow'

type Tab = 'chat' | 'domains' | 'files' | 'about'

const TABS: { id: Tab; label: string }[] = [
  { id: 'chat',    label: 'Chat' },
  { id: 'domains', label: 'My domains' },
  { id: 'files',   label: "Files I've uploaded" },
  { id: 'about',   label: 'About' },
]

function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid #e0e0e0',
        paddingLeft: 16,
        background: '#fff',
        flexShrink: 0,
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '12px 16px',
            fontSize: 14,
            background: 'none',
            border: 'none',
            borderBottom: t.id === active ? '2px solid #0078d4' : '2px solid transparent',
            color: t.id === active ? '#0078d4' : '#424242',
            fontWeight: t.id === active ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function DomainsTab() {
  return (
    <div style={{ padding: 32, color: '#424242' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>My domains</h2>
      <p style={{ fontSize: 13, color: '#616161' }}>
        Domains you have access to appear here. Switch the active domain in the Chat tab sidebar to
        scope all retrieval to that domain's knowledge base.
      </p>
    </div>
  )
}

function FilesUploadedTab() {
  return (
    <div style={{ padding: 32, color: '#424242' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Files I've uploaded</h2>
      <p style={{ fontSize: 13, color: '#616161' }}>
        Files you have personally uploaded are listed here. They are visible only to you unless
        promoted to the shared knowledge base by an admin.
      </p>
    </div>
  )
}

function AboutTab() {
  return (
    <div style={{ padding: 32, color: '#424242', maxWidth: 600 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>About ELLA Square</h2>
      <p style={{ fontSize: 13, color: '#616161', lineHeight: 1.7 }}>
        ELLA Square is a domain-scoped enterprise RAG assistant built on Azure AI Foundry, Azure AI
        Search (vector + semantic), Azure OpenAI GPT-4o, and Azure Content Safety. It runs as a
        Microsoft Teams personal tab and channel tab, with a Bot Framework bot for @mention usage
        in channels.
      </p>
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          ['Knowledge sources', 'SharePoint, Azure Blob, OneLake, manual uploads'],
          ['Safety layer',      'Azure Content Safety — all inputs and outputs screened'],
          ['Privacy',           'Each chat is private by default; memory opt-in per session'],
          ['Model',             'Azure OpenAI GPT-4o with 128 k context'],
          ['Retrieval',         'Azure AI Search — hybrid (vector + keyword) + semantic re-rank'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: '#424242', width: 160, flexShrink: 0 }}>{k}</span>
            <span style={{ color: '#616161' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PersonalTab() {
  const [activeTab, setActiveTab] = useState<Tab>('chat')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <TabNav active={activeTab} onChange={setActiveTab} />

      {activeTab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <ChatSidebar />
          <ChatWindow />
        </div>
      )}
      {activeTab === 'domains' && <DomainsTab />}
      {activeTab === 'files'   && <FilesUploadedTab />}
      {activeTab === 'about'   && <AboutTab />}
    </div>
  )
}
