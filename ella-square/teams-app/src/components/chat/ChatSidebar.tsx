import { useState } from 'react'
import { useStore, DOMAINS } from '../../store'
import type { Chat } from '../../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

type Group = { label: string; chats: Chat[]; showTime: boolean }

function groupByDate(chats: Chat[]): Group[] {
  const now = new Date()
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const todayTs     = sod(now)
  const yesterdayTs = todayTs - 86_400_000
  const weekTs      = todayTs - 6 * 86_400_000

  const today: Chat[]     = []
  const yesterday: Chat[] = []
  const week: Chat[]      = []

  for (const c of chats) {
    const t = sod(new Date(c.updatedAt))
    if      (t >= todayTs)     today.push(c)
    else if (t >= yesterdayTs) yesterday.push(c)
    else if (t >= weekTs)      week.push(c)
  }

  return [
    { label: 'Today',     chats: today,     showTime: true  },
    { label: 'Yesterday', chats: yesterday, showTime: true  },
    { label: 'This week', chats: week,      showTime: false },
  ].filter((g) => g.chats.length > 0)
}

// ─── Domain pill ──────────────────────────────────────────────────────────────

function DomainBadge({ domainId }: { domainId: string }) {
  const d = DOMAINS.find((x) => x.id === domainId)
  if (!d) return null
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: '#fff',
        background: d.color,
        borderRadius: 3,
        padding: '1px 5px',
        flexShrink: 0,
        letterSpacing: 0.3,
      }}
    >
      {d.abbr}
    </span>
  )
}

// ─── Chat row ─────────────────────────────────────────────────────────────────

function ChatRow({
  chat,
  active,
  showTime,
  onSelect,
}: {
  chat: Chat
  active: boolean
  showTime: boolean
  onSelect: () => void
}) {
  const { activeDomainId } = useStore()
  const crossDomain = chat.domainId !== activeDomainId

  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: '7px 12px',
        background: active ? '#EBF3FB' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        borderLeft: active ? '2px solid #0078d4' : '2px solid transparent',
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: active ? '#0078d4' : '#242424',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: active ? 600 : 400,
        }}
      >
        {chat.title}
      </span>
      {showTime && !crossDomain ? (
        <span style={{ fontSize: 10, color: '#8a8a8a', flexShrink: 0 }}>
          {fmtTime(new Date(chat.updatedAt))}
        </span>
      ) : crossDomain ? (
        <DomainBadge domainId={chat.domainId} />
      ) : null}
    </button>
  )
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function ChatSidebar() {
  const { domains, chats, activeDomainId, activeChatId, setActiveDomain, setActiveChat, newChat } =
    useStore()
  const [domainOpen, setDomainOpen] = useState(false)

  const activeDomain = domains.find((d) => d.id === activeDomainId)!
  const groups = groupByDate(chats)

  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
        overflow: 'hidden',
      }}
    >
      {/* Domain selector */}
      <div style={{ padding: '16px 12px 6px', position: 'relative' }}>
        <div style={{ fontSize: 11, color: '#8a8a8a', marginBottom: 5, fontWeight: 600 }}>
          Active domain
        </div>
        <button
          onClick={() => setDomainOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: activeDomain.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#242424', flex: 1 }}>
            {activeDomain.name}
          </span>
          <span style={{ fontSize: 11, color: '#616161' }}>▾</span>
        </button>

        {domainOpen && (
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: 12,
              right: 12,
              background: '#fff',
              border: '1px solid #d0d0d0',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              zIndex: 100,
              overflow: 'hidden',
            }}
          >
            {domains.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setActiveDomain(d.id)
                  setDomainOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '9px 12px',
                  background: d.id === activeDomainId ? '#EBF3FB' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  color: '#242424',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: d.color,
                    flexShrink: 0,
                  }}
                />
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New chat */}
      <div style={{ padding: '4px 12px 10px' }}>
        <button
          onClick={newChat}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: '#fff',
            border: '1px solid #d0d0d0',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            color: '#242424',
            width: '100%',
          }}
        >
          <span style={{ fontSize: 17, lineHeight: 1, color: '#0078d4' }}>+</span>
          <span>New chat</span>
        </button>
      </div>

      {/* History groups */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.map((g) => (
          <div key={g.label}>
            <div
              style={{
                padding: '8px 12px 3px',
                fontSize: 11,
                fontWeight: 600,
                color: '#8a8a8a',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {g.label}
            </div>
            {g.chats.map((c) => (
              <ChatRow
                key={c.id}
                chat={c}
                active={c.id === activeChatId}
                showTime={g.showTime}
                onSelect={() => setActiveChat(c.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
