/**
 * ELLA Square Teams Bot (Bot Framework v4).
 *
 * Responds to @mentions in Teams channels.  Each team/channel is associated
 * with a domain via a mapping stored in environment variables.
 *
 * Commands:
 *   @ELLA Square <question>             — RAG answer from domain knowledge base
 *   @ELLA Square domain: hr <question>  — override domain for this turn
 *   @ELLA Square help                   — show available commands
 *
 * The bot calls the same /api/chat endpoint the personal tab uses,
 * so the full safety + RAG pipeline runs identically.
 */

import {
  ActivityHandler,
  BotState,
  ConversationState,
  MemoryStorage,
  MessageFactory,
  TurnContext,
  TeamsInfo,
  CardFactory,
} from 'botbuilder'

// Channel ID → domain mapping (configure per team via bot settings)
const TEAM_DOMAIN_MAP: Record<string, string> = JSON.parse(
  process.env.TEAM_DOMAIN_MAP ?? '{"default":"finance"}'
)

function domainForChannel(channelId: string): string {
  return TEAM_DOMAIN_MAP[channelId] ?? TEAM_DOMAIN_MAP['default'] ?? 'finance'
}

async function callChatApi(
  message: string,
  domainId: string,
  chatId: string
): Promise<{ answer: string; sources: { name: string; kind: string }[] }> {
  const apiBase = process.env.ELLA_API_BASE ?? 'http://localhost:7071/api'
  const response = await fetch(`${apiBase}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      message,
      domainId,
      chatId,
      memoryOn: false,
      tools: { documents: true, web: false },
    }),
  })

  if (!response.ok) throw new Error(`API error ${response.status}`)

  // Collect SSE stream into full answer
  const text = await response.text()
  let answer = ''
  const sources: { name: string; kind: string }[] = []

  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const chunk = JSON.parse(line.slice(6))
      if (chunk.type === 'token')   answer += chunk.data as string
      if (chunk.type === 'sources') sources.push(...(chunk.data as { name: string; kind: string }[]))
      if (chunk.type === 'error')   throw new Error(chunk.data as string)
    } catch { /* skip */ }
  }

  return { answer, sources }
}

function buildAdaptiveCard(
  answer: string,
  sources: { name: string; kind: string }[],
  domainName: string
) {
  const docSources  = sources.filter((s) => s.kind === 'document')
  const webSources  = sources.filter((s) => s.kind === 'web')

  const body: object[] = [
    {
      type: 'TextBlock',
      text: `**ELLA Square** · ${domainName}`,
      size: 'Small',
      color: 'Accent',
      spacing: 'None',
    },
    { type: 'TextBlock', text: answer, wrap: true, spacing: 'Small' },
  ]

  if (sources.length > 0) {
    body.push({
      type: 'TextBlock',
      text: [
        docSources.length > 0 ? `📄 ${docSources.map((s) => s.name).join('  ')}` : '',
        webSources.length > 0 ? `🌐 ${webSources.map((s) => s.name).join('  ')}` : '',
      ]
        .filter(Boolean)
        .join('  |  '),
      size: 'Small',
      color: 'Good',
      wrap: true,
      spacing: 'Small',
    })
  }

  return CardFactory.adaptiveCard({
    type: 'AdaptiveCard',
    version: '1.5',
    body,
  })
}

export class EllaBot extends ActivityHandler {
  private conversationState: ConversationState

  constructor() {
    super()
    this.conversationState = new ConversationState(new MemoryStorage())

    this.onMessage(async (context: TurnContext, next) => {
      // Strip @mention text
      let text = (context.activity.text ?? '')
        .replace(/<at>[^<]+<\/at>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim()

      // Help command
      if (/^help$/i.test(text)) {
        await context.sendActivity(
          MessageFactory.text(
            '**ELLA Square** is your enterprise RAG assistant.\n\n' +
            '**Usage:**\n' +
            '- `@ELLA Square <question>` — answer from this channel\'s knowledge base\n' +
            '- `@ELLA Square domain:hr <question>` — query a different domain\n' +
            '- `@ELLA Square help` — show this message'
          )
        )
        await next()
        return
      }

      // Domain override: "domain:hr <question>"
      let domainId = domainForChannel(context.activity.channelData?.channel?.id ?? 'default')
      const domainMatch = text.match(/^domain:(\w+)\s+(.+)/i)
      if (domainMatch) {
        domainId = domainMatch[1].toLowerCase()
        text     = domainMatch[2]
      }

      // Show typing indicator
      await context.sendActivities([{ type: 'typing' }])

      try {
        const chatId = `bot-${context.activity.conversation.id}`
        const { answer, sources } = await callChatApi(text, domainId, chatId)

        const DOMAIN_NAMES: Record<string, string> = {
          finance: 'Finance & treasury',
          hr:      'HR policies',
          legal:   'Legal',
        }

        const card = buildAdaptiveCard(answer, sources, DOMAIN_NAMES[domainId] ?? domainId)
        await context.sendActivity(MessageFactory.attachment(card))
      } catch (err) {
        await context.sendActivity(
          MessageFactory.text(`⚠️ ELLA Square encountered an error: ${String(err)}`)
        )
      }

      await next()
    })
  }

  async run(context: TurnContext) {
    await super.run(context)
    await this.conversationState.saveChanges(context, false)
  }
}
