import { GoogleGenAI } from '@google/genai'
import type { AgreementGenerated, MediatorVerdict } from './types'

// Google Gemini powers every AI feature in NimTrust.
//
// Two tiers, mirroring how the app uses the model:
//   REASONING — agreement drafting and dispute mediation. Real judgement,
//               worth the tokens and the thinking budget.
//   FAST      — assistant chat and quick risk-flag passes. High volume, cheap.
//
// Both are overridable by env var so a model can be swapped without a deploy.
const REASONING_MODEL = process.env.GEMINI_REASONING_MODEL || 'gemini-3.8-flash'
const FAST_MODEL = process.env.GEMINI_FAST_MODEL || 'gemini-3.5-flash-lite'

let client: GoogleGenAI | null = null

export function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return client
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY)
}

// Schemas are enforced by the API, not merely requested in the prompt. This is
// the main reliability win over asking for "valid JSON, no markdown" — the
// model cannot return prose, a code fence, or a missing field.
const AGREEMENT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short title for the agreement' },
    scope: { type: 'string', description: 'What will be done, in full sentences' },
    deliverables: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concrete artifacts the provider hands over',
    },
    timeline_days: { type: 'integer', description: 'Total working days to completion' },
    milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['title', 'description'],
      },
    },
    amount_nim: { type: 'number', description: 'Total payment in NIM' },
    completion_conditions: { type: 'string' },
    refund_conditions: { type: 'string' },
    risk_flags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concrete risks either party should know about before funding',
    },
  },
  required: [
    'title',
    'scope',
    'deliverables',
    'timeline_days',
    'milestones',
    'amount_nim',
    'completion_conditions',
    'refund_conditions',
    'risk_flags',
  ],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    case_summary: { type: 'string', description: 'Neutral summary of what each side claims' },
    findings: {
      type: 'string',
      description: 'Reasoning from the evidence to the outcome, citing specific events',
    },
    recommended_outcome: {
      type: 'string',
      enum: ['release', 'refund', 'partial_refund', 'escalate'],
    },
  },
  required: ['case_summary', 'findings', 'recommended_outcome'],
}

const RISK_FLAGS_SCHEMA = {
  type: 'object',
  properties: {
    flags: { type: 'array', items: { type: 'string' } },
  },
  required: ['flags'],
}

// One place where a schema-constrained call is made and its JSON read back.
async function generateJson<T>(
  model: string,
  prompt: string,
  schema: Record<string, unknown>,
  opts: { maxOutputTokens: number; thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' },
): Promise<T> {
  const interaction = await getGeminiClient().interactions.create({
    model,
    input: prompt,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema,
    },
    generation_config: {
      max_output_tokens: opts.maxOutputTokens,
      ...(opts.thinkingLevel ? { thinking_level: opts.thinkingLevel } : {}),
    },
  })

  const text = interaction.output_text
  if (!text) {
    throw new Error(`Gemini (${model}) returned no text output`)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Gemini (${model}) returned unparseable JSON: ${text.slice(0, 300)}`)
  }
}

// Turn a plain-English request into a structured agreement.
export async function generateAgreement(userRequest: string) {
  return generateJson<AgreementGenerated>(
    REASONING_MODEL,
    `You are drafting a peer-to-peer service agreement for NimTrust, where payment is
locked in a Nimiq HTLC escrow and released when the buyer approves the work.

Draft the agreement for this request:
"${userRequest}"

Be concrete and even-handed. Split the work into milestones that can each be
judged done or not done. If the request leaves the amount or the timeline
unstated, choose a reasonable figure and flag the assumption in risk_flags.`,
    AGREEMENT_SCHEMA,
    { maxOutputTokens: 4000, thinkingLevel: 'medium' },
  )
}

// The AI mediator: review a stalled deal and issue a reasoned verdict.
export async function generateMediatorVerdict(
  agreementDetails: string,
  timeline: string,
  messages: string,
  submittedWork: string,
) {
  return generateJson<MediatorVerdict>(
    REASONING_MODEL,
    `You are the neutral mediator for a disputed escrow agreement on NimTrust.
Funds are locked in a Nimiq HTLC. Your recommendation decides where they go:
  release        — the provider delivered; pay them
  refund         — the provider did not deliver; return funds to the buyer
  partial_refund — the work was partly delivered; split the escrow
  escalate       — the evidence is too thin or contradictory to call

Weigh only the evidence below. Cite specific milestones, dates, and messages in
your findings, and do not invent facts that are not present.

=== AGREEMENT ===
${agreementDetails}

=== TIMELINE ===
${timeline}

=== MESSAGES ===
${messages}

=== SUBMITTED WORK ===
${submittedWork}`,
    VERDICT_SCHEMA,
    { maxOutputTokens: 4000, thinkingLevel: 'high' },
  )
}

// Lightweight assistant chat.
export async function chatWithAssistant(userMessage: string) {
  const interaction = await getGeminiClient().interactions.create({
    model: FAST_MODEL,
    input: `You are the NimTrust assistant. NimTrust is a Nimiq Pay mini app where
strangers agree on work, lock payment in an HTLC escrow, and settle by approval
or AI mediation. Answer briefly and practically.

${userMessage}`,
    generation_config: { max_output_tokens: 800, thinking_level: 'minimal' },
  })

  return interaction.output_text ?? ''
}

// Quick second-pass risk check over a drafted agreement.
export async function checkRiskFlags(agreementDetails: string): Promise<string[]> {
  try {
    const parsed = await generateJson<{ flags: string[] }>(
      FAST_MODEL,
      `Identify concrete risks in this escrow agreement — vague acceptance criteria,
an unrealistic timeline, a payment that does not match the scope, missing
ownership terms. Return an empty list if nothing stands out. Do not pad it.

${agreementDetails}`,
      RISK_FLAGS_SCHEMA,
      { maxOutputTokens: 800, thinkingLevel: 'minimal' },
    )
    return parsed.flags ?? []
  } catch (err) {
    // A failed risk pass must not sink an otherwise good agreement — the main
    // draft already carries its own risk_flags.
    console.error('Risk flag check failed:', err)
    return []
  }
}
