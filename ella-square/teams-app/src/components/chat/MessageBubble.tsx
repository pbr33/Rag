import type { Message } from '../../types'

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: 0.5,
      }}
    >
      {initials}
    </div>
  )
}

// ─── Badge pills ──────────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, React.CSSProperties> = {
  documents: { background: '#EFF6FF', color: '#1D6AFF', border: '1px solid #BDD7FF' },
  web:       { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBEDE0' },
  safety:    { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBEDE0' },
  private:   { background: '#F5F5F5', color: '#616161', border: '1px solid #E0E0E0' },
}

function Badge({ kind, label }: { kind: keyof typeof BADGE_STYLES; label: string }) {
  return (
    <span
      style={{
        ...BADGE_STYLES[kind],
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 12,
        padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ─── Content renderer (simple markdown-ish) ───────────────────────────────────

function MessageContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('- ') || line.startsWith('• ')) {
      nodes.push(
        <li key={i} style={{ marginLeft: 18, marginTop: 3, lineHeight: 1.5 }}>
          {line.slice(2)}
        </li>
      )
    } else if (line === '') {
      nodes.push(<div key={i} style={{ height: 6 }} />)
    } else {
      nodes.push(
        <p key={i} style={{ lineHeight: 1.6 }}>
          {line}
        </p>
      )
    }
  }
  return <div style={{ fontSize: 13, color: '#242424' }}>{nodes}</div>
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface Props {
  message: Message
  userInitials?: string
}

export function MessageBubble({ message, userInitials = 'PR' }: Props) {
  const isUser = message.role === 'user'
  const ts = new Date(message.timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isUser) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
        <Avatar initials={userInitials} color="#8764B8" />
        <div>
          <div style={{ fontSize: 12, color: '#8a8a8a', marginBottom: 4 }}>
            <strong style={{ color: '#242424', fontWeight: 600 }}>You</strong>
            {'  '}
            {ts}
          </div>
          <div style={{ fontSize: 13, color: '#242424', lineHeight: 1.6 }}>{message.content}</div>
        </div>
      </div>
    )
  }

  const meta = message.meta
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 24 }}>
      <Avatar initials="ES" color="#107C10" />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            fontSize: 12,
            color: '#8a8a8a',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ color: '#242424', fontWeight: 600 }}>ELLA Square</strong>
          <span>{ts}</span>
          {meta && (
            <>
              <span>·</span>
              <span>{(meta.latencyMs / 1000).toFixed(1)}s</span>
              <span>·</span>
              <span>{meta.model}</span>
            </>
          )}
        </div>

        {/* Badges */}
        {meta && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {meta.docCount > 0 && (
              <Badge kind="documents" label={`${meta.docCount} document${meta.docCount !== 1 ? 's' : ''}`} />
            )}
            {meta.webCount > 0 && (
              <Badge kind="web" label={`${meta.webCount} web`} />
            )}
            {meta.safetyPassed && <Badge kind="safety" label="Safety passed" />}
            {meta.isPrivate && <Badge kind="private" label="Private chat" />}
          </div>
        )}

        {/* Content */}
        <MessageContent text={message.content} />

        {/* Sources */}
        {meta && meta.sources.length > 0 && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid #f0f0f0',
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {meta.sources.map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  color: s.kind === 'web' ? '#0078d4' : '#616161',
                  cursor: s.url ? 'pointer' : 'default',
                  textDecoration: s.url ? 'underline' : 'none',
                }}
              >
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
