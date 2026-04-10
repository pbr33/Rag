/**
 * GET /api/domains   — list domains the calling user has access to.
 * In production this reads from a Cosmos DB or Azure Table that maps
 * Teams user IDs → domains, respecting group membership.
 */

import { app, HttpRequest, HttpResponseInit } from '@azure/functions'

const DOMAINS = [
  { id: 'finance', name: 'Finance & treasury', color: '#107C10', abbr: 'FT' },
  { id: 'hr',      name: 'HR policies',        color: '#C43501', abbr: 'HR' },
  { id: 'legal',   name: 'Legal',              color: '#8764B8', abbr: 'LG' },
]

app.http('domains', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'domains',
  handler: async (_req: HttpRequest): Promise<HttpResponseInit> => {
    // TODO: filter by Teams user claims from SWA auth header
    return { status: 200, jsonBody: { domains: DOMAINS } }
  },
})
