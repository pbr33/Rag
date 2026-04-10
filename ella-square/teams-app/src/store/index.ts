import { create } from 'zustand'
import type { Chat, Domain, KnowledgeFile, KnowledgeStats, Message } from '../types'

// ─── Demo data matching the mockups exactly ───────────────────────────────────

export const DOMAINS: Domain[] = [
  { id: 'finance', name: 'Finance & treasury', color: '#107C10', abbr: 'FT' },
  { id: 'hr',      name: 'HR policies',        color: '#C43501', abbr: 'HR' },
  { id: 'legal',   name: 'Legal',              color: '#8764B8', abbr: 'LG' },
]

const now = new Date()
const todayMinus = (m: number) => new Date(now.getTime() - m * 60_000)
const dayMinus  = (d: number) => new Date(now.getTime() - d * 86_400_000)

const CHATS: Chat[] = [
  {
    id: 'q3-hedge',
    title: 'Q3 hedge book review',
    domainId: 'finance',
    memoryOn: true,
    createdAt: todayMinus(2),
    updatedAt: todayMinus(2),
    messages: [
      {
        id: 'm1',
        role: 'user',
        content:
          'Walk me through our EUR exposure for Q3 and flag anything that breaches policy. Use internal docs and the latest ECB guidance.',
        timestamp: todayMinus(2),
      },
      {
        id: 'm2',
        role: 'assistant',
        content:
          'Net EUR exposure for Q3 stands at €148m, down from €172m in Q2, driven by the unwind of two cross-currency swaps on 12 Sep. Forward cover ratio improved from 64 percent to 71 percent.\n\n- Within the 80 percent ceiling — no policy breach.\n- BNP concentration at 38 percent — under the 40 percent limit.\n- ECB held rates this week, data-dependent into Q1.',
        timestamp: todayMinus(1),
        meta: {
          latencyMs: 3100,
          model: 'gpt-4o',
          docCount: 4,
          webCount: 2,
          safetyPassed: true,
          isPrivate: true,
          sources: [
            { name: 'Treasury_Q3.pdf',       kind: 'document' },
            { name: 'Hedge_book_oct.xlsx',   kind: 'document' },
            { name: 'FX_policy_v4.docx',     kind: 'document' },
            { name: 'ECB statement',         kind: 'web' },
            { name: 'Reuters report',        kind: 'web' },
          ],
        },
      },
    ],
  },
  {
    id: 'fx-summary',
    title: 'FX exposure summary',
    domainId: 'finance',
    memoryOn: false,
    createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 18),
    updatedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 18),
    messages: [],
  },
  {
    id: 'sox-gaps',
    title: 'SOX control gaps',
    domainId: 'finance',
    memoryOn: false,
    createdAt: new Date(dayMinus(1).setHours(16, 2, 0, 0)),
    updatedAt: new Date(dayMinus(1).setHours(16, 2, 0, 0)),
    messages: [],
  },
  {
    id: 'liquidity',
    title: 'Liquidity policy v4',
    domainId: 'finance',
    memoryOn: false,
    createdAt: new Date(dayMinus(1).setHours(11, 30, 0, 0)),
    updatedAt: new Date(dayMinus(1).setHours(11, 30, 0, 0)),
    messages: [],
  },
  {
    id: 'new-joiner',
    title: 'New joiner forms',
    domainId: 'hr',
    memoryOn: false,
    createdAt: dayMinus(3),
    updatedAt: dayMinus(3),
    messages: [],
  },
  {
    id: 'vendor-nda',
    title: 'Vendor NDA template',
    domainId: 'legal',
    memoryOn: false,
    createdAt: dayMinus(4),
    updatedAt: dayMinus(4),
    messages: [],
  },
]

const FILES: KnowledgeFile[] = [
  {
    id: 'f1',
    name: 'Hedge_book_oct.xlsx',
    type: 'xlsx',
    source: 'sharepoint',
    sourcePath: '/Treasury',
    sizeBytes: 2.4 * 1024 * 1024,
    status: 'ready',
    chunks: 164,
    label: 'confidential',
    updatedAt: todayMinus(2),
  },
  {
    id: 'f2',
    name: 'FX_policy_v4.pdf',
    type: 'pdf',
    source: 'manual',
    sizeBytes: 8.1 * 1024 * 1024,
    status: 'indexing',
    progressCurrent: 38,
    progressTotal: 64,
    progressStage: 'chunking',
    updatedAt: todayMinus(0.1),
  },
  {
    id: 'f3',
    name: 'Counterparty_register_2026.pdf',
    type: 'pdf',
    source: 'blob',
    sourcePath: 'treasury-fy26',
    sizeBytes: 14.2 * 1024 * 1024,
    status: 'indexing',
    progressCurrent: 240,
    progressTotal: 412,
    progressStage: 'embedding',
    label: 'internal',
    updatedAt: todayMinus(0.1),
  },
  {
    id: 'f4',
    name: 'Treasury_Q3_commentary.docx',
    type: 'docx',
    source: 'manual',
    sizeBytes: 340 * 1024,
    status: 'ready',
    chunks: 22,
    updatedAt: todayMinus(9),
  },
  {
    id: 'f5',
    name: 'Q3_treasurer_review.pptx',
    type: 'pptx',
    source: 'blob',
    sourcePath: 'treasury-fy26',
    sizeBytes: 6.7 * 1024 * 1024,
    status: 'queued',
    updatedAt: todayMinus(12),
  },
]

const STATS: KnowledgeStats = {
  documentsIndexed: 1247,
  chunksKb: 18400,
  ingestingNow: 3,
  lastRefreshAt: todayMinus(2),
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface EllaStore {
  // Chat
  domains: Domain[]
  chats: Chat[]
  activeDomainId: string
  activeChatId: string
  composerText: string
  streaming: boolean
  toolsEnabled: { documents: boolean; web: boolean; tools: boolean; memory: boolean }
  autoRoute: boolean

  // Knowledge
  files: KnowledgeFile[]
  stats: KnowledgeStats
  sourceFilter: string
  searchQuery: string

  // Actions
  setActiveDomain: (id: string) => void
  setActiveChat: (id: string) => void
  setComposerText: (t: string) => void
  toggleTool: (key: keyof EllaStore['toolsEnabled']) => void
  setAutoRoute: (v: boolean) => void
  newChat: () => void
  sendMessage: (content: string) => Promise<void>
  setSourceFilter: (f: string) => void
  setSearchQuery: (q: string) => void
}

export const useStore = create<EllaStore>((set, get) => ({
  domains: DOMAINS,
  chats: CHATS,
  activeDomainId: 'finance',
  activeChatId: 'q3-hedge',
  composerText: '',
  streaming: false,
  toolsEnabled: { documents: true, web: true, tools: false, memory: true },
  autoRoute: true,

  files: FILES,
  stats: STATS,
  sourceFilter: 'all',
  searchQuery: '',

  setActiveDomain: (id) => set({ activeDomainId: id }),
  setActiveChat: (id) => set({ activeChatId: id }),
  setComposerText: (t) => set({ composerText: t }),
  toggleTool: (key) =>
    set((s) => ({ toolsEnabled: { ...s.toolsEnabled, [key]: !s.toolsEnabled[key] } })),
  setAutoRoute: (v) => set({ autoRoute: v }),

  newChat: () => {
    const id = `chat-${Date.now()}`
    const { activeDomainId } = get()
    const newChatObj: Chat = {
      id,
      title: 'New chat',
      domainId: activeDomainId,
      memoryOn: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    }
    set((s) => ({ chats: [newChatObj, ...s.chats], activeChatId: id }))
  },

  sendMessage: async (content: string) => {
    const { activeChatId, toolsEnabled } = get()

    const userMsg: Message = {
      id: `m-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }

    set((s) => ({
      composerText: '',
      streaming: true,
      chats: s.chats.map((c) =>
        c.id === activeChatId ? { ...c, messages: [...c.messages, userMsg] } : c
      ),
    }))

    // In real mode this calls /api/chat with SSE streaming.
    // In demo mode we simulate a response after a short delay.
    await new Promise((r) => setTimeout(r, 1400))

    const docs = toolsEnabled.documents ? 3 : 0
    const webs = toolsEnabled.web ? 1 : 0

    const assistantMsg: Message = {
      id: `m-${Date.now()}-a`,
      role: 'assistant',
      content:
        'Based on the documents retrieved from the Finance & treasury knowledge base and live market data, here is the analysis you requested. The key figures align with existing policy thresholds and no breaches are detected at this time.',
      timestamp: new Date(),
      meta: {
        latencyMs: 1400,
        model: 'gpt-4o',
        docCount: docs,
        webCount: webs,
        safetyPassed: true,
        isPrivate: true,
        sources: [
          ...(toolsEnabled.documents
            ? [
                { name: 'FX_policy_v4.pdf',       kind: 'document' as const },
                { name: 'Treasury_Q3.pdf',         kind: 'document' as const },
                { name: 'Hedge_book_oct.xlsx',     kind: 'document' as const },
              ]
            : []),
          ...(toolsEnabled.web
            ? [{ name: 'Reuters', kind: 'web' as const }]
            : []),
        ],
      },
    }

    set((s) => ({
      streaming: false,
      chats: s.chats.map((c) =>
        c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMsg] } : c
      ),
    }))
  },

  setSourceFilter: (f) => set({ sourceFilter: f }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}))
