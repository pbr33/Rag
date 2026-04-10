import { useEffect, useRef, KeyboardEvent } from 'react'
import { useStore, DOMAINS } from '../../store'
import { MessageBubble } from './MessageBubble'

// ─── Tool toggle button ───────────────────────────────────────────────────────

function ToolToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        fontSize: 12,
        border: 'none',
        borderRadius: 12,
        background: active ? '#EBF3FB' : 'transparent',
        color: active ? '#0078d4' : '#8a8a8a',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

// ─── Streaming indicator ──────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#107C10',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        ES
      </div>
      <div
        style={{
          padding: '10px 14px',
          background: '#f5f5f5',
          borderRadius: 8,
          display: 'flex',
          gap: 5,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#107C10',
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              opacity: 0.6,
            }}
          />
        ))}
        <style>{`@keyframes pulse { 0%,80%,100%{opacity:0.3} 40%{opacity:1} }`}</style>
      </div>
    </div>
  )
}

// ─── Main ChatWindow ──────────────────────────────────────────────────────────

export function ChatWindow() {
  const {
    chats,
    activeChatId,
    activeDomainId,
    composerText,
    streaming,
    toolsEnabled,
    autoRoute,
    setComposerText,
    toggleTool,
    setAutoRoute,
    sendMessage,
  } = useStore()

  const chat = chats.find((c) => c.id === activeChatId)
  const domain = DOMAINS.find((d) => d.id === activeDomainId)!
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat?.messages.length, streaming])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (composerText.trim()) sendMessage(composerText.trim())
    }
  }

  if (!chat) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8a8a8a',
          fontSize: 14,
        }}
      >
        Select a conversation or start a new chat.
      </div>
    )
  }

  const turnCount = chat.messages.filter((m) => m.role === 'user').length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#242424' }}>{chat.title}</div>
          <div style={{ fontSize: 11, color: '#8a8a8a', marginTop: 1 }}>
            {domain.name}
            {' · '}
            <span style={{ color: chat.memoryOn ? '#107C10' : '#8a8a8a' }}>
              memory {chat.memoryOn ? 'on' : 'off'}
            </span>
            {' · '}
            {turnCount} turn{turnCount !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={() => setAutoRoute(!autoRoute)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 12px',
            background: autoRoute ? '#EBF3FB' : '#f5f5f5',
            border: `1px solid ${autoRoute ? '#BDD7FF' : '#d0d0d0'}`,
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: autoRoute ? '#0078d4' : '#616161',
          }}
        >
          Auto-route{' '}
          <span style={{ fontSize: 10 }}>▾</span>
        </button>
      </div>

      {/* ── Messages ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
        }}
      >
        {chat.messages.length === 0 && !streaming && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 8,
              color: '#8a8a8a',
            }}
          >
            <div style={{ fontSize: 28 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#424242' }}>
              Ask anything in {domain.name}
            </div>
            <div style={{ fontSize: 12 }}>Switch domain on the left to change scope</div>
          </div>
        )}

        {chat.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streaming && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Composer ── */}
      <div
        style={{
          borderTop: '1px solid #e8e8e8',
          padding: '10px 20px 14px',
          flexShrink: 0,
        }}
      >
        {/* hint */}
        <div
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#ababab',
            marginBottom: 8,
          }}
        >
          Ask anything in {domain.name} — switch domain on the left to change scope
        </div>

        {/* text area */}
        <textarea
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${domain.name}…`}
          disabled={streaming}
          rows={2}
          style={{
            width: '100%',
            resize: 'none',
            border: '1px solid #d0d0d0',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
            background: streaming ? '#f9f9f9' : '#fff',
            marginBottom: 8,
          }}
        />

        {/* tools row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 2 }}>
            {(
              [
                ['documents', 'Documents'],
                ['web',       'Web'],
                ['tools',     'Tools'],
                ['memory',    'Memory'],
              ] as const
            ).map(([key, lbl]) => (
              <ToolToggle
                key={key}
                label={lbl}
                active={toolsEnabled[key]}
                onClick={() => toggleTool(key)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setAutoRoute(!autoRoute)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: '#f5f5f5',
                border: '1px solid #d0d0d0',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#424242',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Auto-route <span style={{ fontSize: 9 }}>▾</span>
            </button>
            <button
              disabled={!composerText.trim() || streaming}
              onClick={() => composerText.trim() && sendMessage(composerText.trim())}
              style={{
                padding: '6px 18px',
                fontSize: 13,
                fontWeight: 600,
                background: composerText.trim() && !streaming ? '#0078d4' : '#c8e1f7',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: composerText.trim() && !streaming ? 'pointer' : 'not-allowed',
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
