/**
 * GET /api/health   — liveness probe used by SWA and Azure Monitor.
 */

import { app, HttpRequest, HttpResponseInit } from '@azure/functions'

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (_req: HttpRequest): Promise<HttpResponseInit> => {
    return {
      status: 200,
      jsonBody: {
        status: 'ok',
        service: 'ella-square-api',
        timestamp: new Date().toISOString(),
      },
    }
  },
})
