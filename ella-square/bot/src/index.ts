/**
 * Azure Functions v4 HTTP trigger entry point for the Bot Framework bot.
 * Teams sends all bot activity to POST /api/messages.
 */

import { app, HttpRequest, HttpResponseInit } from '@azure/functions'
import { CloudAdapter, ConfigurationBotFrameworkAuthentication } from 'botbuilder'
import { EllaBot } from './ellaBot'

const auth = new ConfigurationBotFrameworkAuthentication({
  MicrosoftAppId:       process.env.BOT_APP_ID,
  MicrosoftAppPassword: process.env.BOT_APP_PASSWORD,
  MicrosoftAppTenantId: process.env.BOT_TENANT_ID,
  MicrosoftAppType:     'MultiTenant',
})

const adapter = new CloudAdapter(auth)

adapter.onTurnError = async (context, error) => {
  console.error('Bot turn error:', error)
  await context.sendTraceActivity('OnTurnError', String(error), 'https://www.botframework.com/schemas/error', 'TurnError')
  await context.sendActivity('ELLA Square encountered an unexpected error. Please try again.')
}

const bot = new EllaBot()

app.http('messages', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'messages',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const body    = await req.text()
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => { headers[key] = value })

    return new Promise((resolve) => {
      const nodeReq = {
        body,
        headers,
        method: 'POST',
      }

      const nodeRes = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: '',
        status(code: number) { this.statusCode = code; return this },
        setHeader(k: string, v: string) { this.headers[k] = v; return this },
        end(b?: string) {
          this.body = b ?? ''
          resolve({ status: this.statusCode, headers: this.headers, body: this.body })
        },
      }

      adapter.process(nodeReq as any, nodeRes as any, (ctx) => bot.run(ctx))
    })
  },
})
