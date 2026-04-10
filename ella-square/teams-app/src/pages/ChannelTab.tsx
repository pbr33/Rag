import { useState } from 'react'
import { FilesPanel } from '../components/knowledge/FilesPanel'

type Tab = 'files' | 'sources' | 'dlp' | 'about'

const TABS: { id: Tab; label: string }[] = [
  { id: 'files',   label: 'Files' },
  { id: 'sources', label: 'Knowledge sources' },
  { id: 'dlp',     label: 'DLP & safety' },
  { id: 'about',   label: 'About' },
]

function SourcesTab() {
  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Knowledge sources</h2>
      <p style={{ fontSize: 13, color: '#616161', lineHeight: 1.7 }}>
        Connect SharePoint document libraries, Azure Blob containers, OneLake lakehouses, or allow
        manual uploads. Each source is crawled on a configurable schedule, chunked, and indexed into
        the domain's Azure AI Search index.
      </p>
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { name: 'SharePoint /Treasury',        status: 'Connected', schedule: 'Every 15 min', items: 312  },
          { name: 'Blob container treasury-fy26', status: 'Connected', schedule: 'On upload',   items: 89   },
          { name: 'OneLake /finance/analytics',   status: 'Pending',   schedule: '—',           items: 0    },
        ].map((src) => (
          <div
            key={src.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 16px',
              border: '1px solid #e0e0e0',
              borderRadius: 6,
              background: '#fafafa',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{src.name}</div>
              <div style={{ fontSize: 11, color: '#8a8a8a', marginTop: 2 }}>
                {src.schedule} · {src.items} documents
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: '2px 9px',
                borderRadius: 12,
                ...(src.status === 'Connected'
                  ? { color: '#107C10', border: '1px solid #107C10', background: '#F0FDF4' }
                  : { color: '#8a8a8a', border: '1px solid #d0d0d0', background: '#f5f5f5' }),
              }}
            >
              {src.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DlpTab() {
  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>DLP & safety</h2>
      <p style={{ fontSize: 13, color: '#616161', lineHeight: 1.7 }}>
        All inputs and outputs are screened by Azure Content Safety before being processed or
        returned. Microsoft Purview sensitivity labels are honoured — files labelled{' '}
        <strong>Confidential</strong> are only surfaced to users with matching Purview permissions.
      </p>
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['Content Safety screening', 'Enabled — all categories, threshold: medium'],
          ['Purview label enforcement', 'Enabled — Confidential, Internal, Public'],
          ['PII redaction',             'Enabled — names, account numbers scrubbed from logs'],
          ['Audit logging',             'Azure Monitor + Log Analytics workspace'],
          ['Retention',                 '90-day conversation log retention'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: '#107C10', width: 8, flexShrink: 0 }}>✓</span>
            <span style={{ fontWeight: 600, color: '#424242', width: 220, flexShrink: 0 }}>{k}</span>
            <span style={{ color: '#616161' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AboutChannelTab() {
  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        ask-ella-square — Finance &amp; treasury
      </h2>
      <p style={{ fontSize: 13, color: '#616161', lineHeight: 1.7 }}>
        This Teams channel is the admin interface for the Finance &amp; treasury domain knowledge
        base. Team owners can manage document sources, monitor indexing status, configure DLP
        policies, and review usage analytics.
      </p>
    </div>
  )
}

export function ChannelTab() {
  const [activeTab, setActiveTab] = useState<Tab>('files')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* Tab nav — sits below the Teams-native tabs strip */}
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
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '12px 16px',
              fontSize: 14,
              background: 'none',
              border: 'none',
              borderBottom: t.id === activeTab ? '2px solid #0078d4' : '2px solid transparent',
              color: t.id === activeTab ? '#0078d4' : '#424242',
              fontWeight: t.id === activeTab ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'files'   && <FilesPanel />}
        {activeTab === 'sources' && <SourcesTab />}
        {activeTab === 'dlp'     && <DlpTab />}
        {activeTab === 'about'   && <AboutChannelTab />}
      </div>
    </div>
  )
}
