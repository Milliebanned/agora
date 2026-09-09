import { GoogleGenAI } from '@google/genai'
import type { MediatorVerdict } from './types'

// Google Gemini powers the AI features that remain in NimTrust.
//
// Agreements are no longer drafted by a model: clients fill in a structured
// opportunity form and the escrow is the source of truth. Judgement is reserved
// for the one place it belongs — reading a dispute against what was actually
// agreed.
//
// Two tiers, mirroring how the app uses the model:
//   REASONING — dispute mediation. Real judgement, worth the tokens and the
//               thinking budget.
//   FAST      — assistant chat and quick risk-flag passes. High volume, cheap.
//
// Both are overridable by env var so a model can be swapped without a deploy.
//
// The reasoning default is 3.6 Flash rather than 3.8: on Google's free tier
// 3.8 Flash is capped at 20 requests and returns 429 almost immediately, which
// is not survivable for a live demo. With billing enabled, set
// GEMINI_REASONING_MODEL=gemini-3.8-flash for the stronger model.
const REASONING_MODEL = process.env.GEMINI_REASONING_MODEL || 'gemini-3.6-flash'
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
    { maxOutputTokens: 1800, thinkingLevel: 'low' },
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
