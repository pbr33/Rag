import { useRef } from 'react'
import { useStore } from '../../store'
import type { KnowledgeFile, FileType, FileStatus } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function fmtAge(d: Date): string {
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (secs < 60) return 'Just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

function sourceLabel(f: KnowledgeFile): string {
  if (f.source === 'manual') return 'Manual upload'
  if (f.source === 'sharepoint') return `SharePoint ${f.sourcePath ?? ''}`
  if (f.source === 'blob') return `Blob /${f.sourcePath ?? ''}`
  if (f.source === 'onelake') return `OneLake /${f.sourcePath ?? ''}`
  return f.source
}

// ─── File type badge ──────────────────────────────────────────────────────────

const TYPE_COLORS: Record<FileType, [string, string]> = {
  xlsx: ['#107C10', '#fff'],
  pdf:  ['#C43501', '#fff'],
  docx: ['#185ABD', '#fff'],
  pptx: ['#B7472A', '#fff'],
  txt:  ['#616161', '#fff'],
  csv:  ['#00897B', '#fff'],
}

function TypeBadge({ type }: { type: FileType }) {
  const [bg, color] = TYPE_COLORS[type] ?? ['#616161', '#fff']
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 28,
        borderRadius: 4,
        background: bg,
        color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        flexShrink: 0,
      }}
    >
      {type.toUpperCase()}
    </span>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<FileStatus, React.CSSProperties> = {
  ready:    { color: '#107C10', border: '1px solid #107C10', background: '#F0FDF4' },
  indexing: { color: '#0078d4', border: '1px solid #0078d4', background: '#EBF3FB' },
  queued:   { color: '#8a8a8a', border: '1px solid #d0d0d0', background: '#f5f5f5' },
  failed:   { color: '#C43501', border: '1px solid #C43501', background: '#FFF4F1' },
}

function StatusBadge({ status }: { status: FileStatus }) {
  return (
    <span
      style={{
        ...STATUS_STYLES[status],
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 9px',
        borderRadius: 12,
        whiteSpace: 'nowrap',
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / total) * 100))
  return (
    <div
      style={{
        height: 4,
        background: '#e0e0e0',
        borderRadius: 2,
        overflow: 'hidden',
        marginTop: 4,
        width: '100%',
        maxWidth: 240,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: '#0078d4',
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  )
}

// ─── File row ─────────────────────────────────────────────────────────────────

function FileRow({ file }: { file: KnowledgeFile }) {
  return (
    <tr
      style={{
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      {/* Name + meta */}
      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <TypeBadge type={file.type} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#242424' }}>{file.name}</div>
            <div style={{ fontSize: 11, color: '#8a8a8a', marginTop: 2 }}>
              {file.status === 'ready' && file.chunks && (
                <span>
                  {file.chunks} chunks
                  {file.label && (
                    <>
                      {' · '}
                      <span
                        style={{
                          color: file.label === 'confidential' ? '#C43501' : '#8764B8',
                          fontWeight: 600,
                        }}
                      >
                        {file.label} label
                      </span>
                    </>
                  )}
                </span>
              )}
              {file.status === 'indexing' && file.progressCurrent !== undefined && (
                <>
                  <span>
                    {file.progressStage === 'chunking'
                      ? `chunking ${file.progressCurrent} of ${file.progressTotal} pages`
                      : `embedding ${file.progressCurrent} of ${file.progressTotal} chunks`}
                    {file.label && (
                      <>
                        {' · '}
                        <span style={{ color: '#8764B8', fontWeight: 600 }}>
                          {file.label} label
                        </span>
                      </>
                    )}
                  </span>
                  <ProgressBar current={file.progressCurrent} total={file.progressTotal!} />
                </>
              )}
              {file.status === 'queued' && <span>queued for ingestion</span>}
              {file.status === 'failed' && <span style={{ color: '#C43501' }}>ingestion failed</span>}
            </div>
          </div>
        </div>
      </td>

      {/* Source */}
      <td style={{ padding: '10px 16px', fontSize: 12, color: '#616161', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        {sourceLabel(file)}
      </td>

      {/* Size */}
      <td style={{ padding: '10px 16px', fontSize: 12, color: '#616161', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        {fmtSize(file.sizeBytes)}
      </td>

      {/* Status */}
      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
        <StatusBadge status={file.status} />
      </td>

      {/* Updated */}
      <td style={{ padding: '10px 16px', fontSize: 12, color: '#8a8a8a', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        {fmtAge(file.updatedAt)}
      </td>
    </tr>
  )
}

// ─── Source filter tabs ───────────────────────────────────────────────────────

const SOURCE_FILTERS = ['all', 'manual', 'blob', 'sharepoint', 'onelake', 'failed'] as const
const FILTER_LABELS: Record<string, string> = {
  all:        'All sources',
  manual:     'Manual uploads',
  blob:       'Blob',
  sharepoint: 'SharePoint',
  onelake:    'OneLake',
  failed:     'Failed',
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function FilesPanel() {
  const { files, stats, sourceFilter, searchQuery, setSourceFilter, setSearchQuery } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = files.filter((f) => {
    const matchFilter =
      sourceFilter === 'all' ||
      (sourceFilter === 'failed' ? f.status === 'failed' : f.source === sourceFilter)
    const matchSearch =
      !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Teams info banner */}
      <div
        style={{
          background: '#F0FDF4',
          border: '1px solid #BBEDE0',
          padding: '8px 16px',
          fontSize: 12,
          color: '#424242',
          flexShrink: 0,
        }}
      >
        Teams note · this tab content is our React page rendered inside a Teams iframe. The tabs
        strip, header and left rail belong to Teams.
      </div>

      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid #e8e8e8',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <input ref={fileInputRef} type="file" multiple hidden accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv" />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            background: '#0078d4',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          + Upload files
        </button>
        {['Sync Blob container', 'Sync SharePoint', 'Reindex all'].map((lbl) => (
          <button
            key={lbl}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: '#fff',
              color: '#424242',
              border: '1px solid #d0d0d0',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {lbl}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files…"
          style={{
            padding: '6px 12px',
            fontSize: 13,
            border: '1px solid #d0d0d0',
            borderRadius: 4,
            outline: 'none',
            width: 180,
          }}
        />
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '14px 16px',
          borderBottom: '1px solid #e8e8e8',
          flexShrink: 0,
        }}
      >
        {[
          { label: 'Documents indexed', value: stats.documentsIndexed.toLocaleString() },
          { label: 'Chunks in KB',      value: `${(stats.chunksKb / 1000).toFixed(1)} k` },
          { label: 'Ingesting now',     value: String(stats.ingestingNow) },
          { label: 'Last refresh',      value: `${Math.floor((Date.now() - new Date(stats.lastRefreshAt).getTime()) / 60000)} m ago` },
        ].map((stat, i) => (
          <div
            key={stat.label}
            style={{
              flex: 1,
              borderLeft: i > 0 ? '1px solid #e8e8e8' : 'none',
              paddingLeft: i > 0 ? 24 : 0,
              paddingRight: 24,
            }}
          >
            <div style={{ fontSize: 11, color: '#8a8a8a', marginBottom: 2 }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 300, color: '#242424', letterSpacing: -0.5 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Source filter */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #e8e8e8',
          paddingLeft: 16,
          flexShrink: 0,
        }}
      >
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setSourceFilter(f)}
            style={{
              padding: '10px 14px',
              fontSize: 13,
              background: 'none',
              border: 'none',
              borderBottom: f === sourceFilter ? '2px solid #0078d4' : '2px solid transparent',
              color: f === sourceFilter ? '#0078d4' : '#616161',
              fontWeight: f === sourceFilter ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Files table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e8e8e8', background: '#fafafa' }}>
              {['Name', 'Source', 'Size', 'Status', 'Updated'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '8px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#8a8a8a',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <FileRow key={f.id} file={f} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#8a8a8a', fontSize: 13 }}>
                  No files match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
