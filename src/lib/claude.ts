import Anthropic from '@anthropic-ai/sdk'

// Singleton instances for Claude API clients
let sonnetClient: Anthropic | null = null
let haikuClient: Anthropic | null = null

export function getSonnetClient() {
  if (!sonnetClient) {
    sonnetClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return sonnetClient
}

export function getHaikuClient() {
  if (!haikuClient) {
    haikuClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return haikuClient
}

// Generate a structured agreement using Sonnet
export async function generateAgreement(userRequest: string) {
  const client = getSonnetClient()

  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Generate a detailed P2P agreement based on this request: "${userRequest}"

Respond with valid JSON (no markdown, no code blocks) matching this structure:
{
  "title": "Agreement Title",
  "scope": "What will be done",
  "deliverables": ["item1", "item2"],
  "timeline_days": 7,
  "milestones": [
    {"title": "Milestone 1", "description": "Description"},
    {"title": "Milestone 2", "description": "Description"}
  ],
  "amount_nim": 500,
  "completion_conditions": "What constitutes completion",
  "refund_conditions": "When a refund can be requested",
  "risk_flags": ["flag1", "flag2"]
}`,
      },
    ],
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return JSON.parse(text)
  } catch (err) {
    console.error('Failed to parse AI agreement:', err)
    return null
  }
}

// Generate AI mediator verdict using Sonnet
export async function generateMediatorVerdict(
  agreementDetails: string,
  timeline: string,
  messages: string,
  submittedWork: string,
) {
  const client = getSonnetClient()

  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Review this dispute and provide a verdict:

Agreement: ${agreementDetails}
Timeline: ${timeline}
Messages: ${messages}
Submitted Work: ${submittedWork}

Respond with valid JSON (no markdown) matching:
{
  "case_summary": "Summary of the case",
  "findings": "Your findings",
  "recommended_outcome": "release|refund|partial_refund|escalate"
}`,
      },
    ],
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return JSON.parse(text)
  } catch (err) {
    console.error('Failed to parse mediator verdict:', err)
    return null
  }
}

// Quick AI assistant chat using Haiku (lightweight)
export async function chatWithAssistant(userMessage: string) {
  const client = getHaikuClient()

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// Quick risk flag check using Haiku
export async function checkRiskFlags(agreementDetails: string) {
  const client = getHaikuClient()

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Identify key risk flags in this agreement (respond with JSON):
${agreementDetails}

Format: {"flags": ["flag1", "flag2"]}`,
      },
    ],
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text)
    return parsed.flags || []
  } catch (err) {
    console.error('Failed to parse risk flags:', err)
    return []
  }
}
