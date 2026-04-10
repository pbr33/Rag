/**
 * Azure Content Safety wrapper.
 * Screens both user inputs and LLM outputs for hate, self-harm, sexual,
 * and violent content.  Thresholds are configurable per domain policy.
 */

import { ContentSafetyClient, isUnexpected } from '@azure/ai-content-safety'
import { AzureKeyCredential } from '@azure/core-auth'

const client = new ContentSafetyClient(
  process.env.AZURE_CONTENT_SAFETY_ENDPOINT!,
  new AzureKeyCredential(process.env.AZURE_CONTENT_SAFETY_KEY!)
)

export interface SafetyResult {
  passed: boolean
  categories: {
    hate: number
    selfHarm: number
    sexual: number
    violence: number
  }
  blocked: string[]
}

// Severity threshold per category (0–6 scale).
const THRESHOLD = 2

export async function screenText(text: string): Promise<SafetyResult> {
  const response = await client.analyzeText({ text })

  if (isUnexpected(response)) {
    throw new Error(`Content Safety API error: ${response.body.error.message}`)
  }

  const cats = response.categoriesAnalysis ?? []

  const score = (name: string) =>
    cats.find((c) => c.category.toLowerCase() === name)?.severity ?? 0

  const hate      = score('hate')
  const selfHarm  = score('self-harm')
  const sexual    = score('sexual')
  const violence  = score('violence')

  const blocked = [
    hate     >= THRESHOLD ? 'Hate'      : '',
    selfHarm >= THRESHOLD ? 'Self-harm' : '',
    sexual   >= THRESHOLD ? 'Sexual'    : '',
    violence >= THRESHOLD ? 'Violence'  : '',
  ].filter(Boolean)

  return {
    passed: blocked.length === 0,
    categories: { hate, selfHarm: selfHarm, sexual, violence },
    blocked,
  }
}
