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
    // The outcome names the direction; this names the amount. Requiring it on
    // every verdict rather than only on a partial means the payout code reads
    // one field instead of branching, and the model has to state a number it
    // can be held to even when that number is 100 or 0.
    freelancer_percent: {
      type: 'integer',
      description:
        'Share of the escrow the freelancer has earned, 0-100. 100 for release, 0 for refund, the reasoned split for partial_refund, and your best estimate for escalate (it is not paid out).',
    },
  },
  required: ['case_summary', 'findings', 'recommended_outcome', 'freelancer_percent'],
}

const RISK_FLAGS_SCHEMA = {
  type: 'object',
  properties: {
    flags: { type: 'array', items: { type: 'string' } },
  },
  required: ['flags'],
}

// Failures worth trying again: the model was busy, rate-limited, or the
// connection died. A bad request or a missing key will fail identically every
// time, and retrying those just makes the user wait longer to read the same
// message.
function isTransient(err: unknown): boolean {
  const status = (err as { status?: number; code?: number } | null)?.status ??
    (err as { code?: number } | null)?.code
  if (typeof status === 'number') {
    return status === 429 || status === 408 || (status >= 500 && status < 600)
  }
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return /429|rate.?limit|quota|timeout|timed out|overloaded|unavailable|503|502|504|econnreset|socket hang up|fetch failed/.test(
    message,
  )
}

// One place where a schema-constrained call is made and its JSON read back.
//
// Retried on transient failures, because the first call after a quiet period is
// the one most likely to hit a cold connection or a burst limit, and a mediator
// that works only on the second click reads as a broken mediator.
async function generateJson<T>(
  model: string,
  prompt: string,
  schema: Record<string, unknown>,
  opts: {
    maxOutputTokens: number
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high'
    attempts?: number
    /** Stop starting new attempts past this many ms. Must sit inside the
     *  route's maxDuration, or the retry itself becomes the timeout. */
    budgetMs?: number
  },
): Promise<T> {
  const attempts = opts.attempts ?? 3
  const budgetMs = opts.budgetMs ?? 45_000
  const startedAt = Date.now()
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
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
      // An empty completion is a transient failure wearing a success's clothes —
      // usually a truncated or filtered response — so it is retried rather than
      // reported as though the model had nothing to say.
      if (!text) throw new Error(`Gemini (${model}) returned no text output`)

      try {
        return JSON.parse(text) as T
      } catch {
        // The schema is enforced server-side, so unparseable output means a
        // truncated stream rather than a model that ignored instructions.
        throw new Error(`Gemini (${model}) returned unparseable JSON: ${text.slice(0, 300)}`)
      }
    } catch (err) {
      lastError = err
      const retryable = isTransient(err) || /returned no text output|unparseable JSON/.test(
        err instanceof Error ? err.message : '',
      )
      if (!retryable || attempt === attempts) break

      // Retrying into a request that is about to be killed anyway just replaces
      // a readable error with a gateway timeout.
      const elapsed = Date.now() - startedAt
      if (elapsed > budgetMs) {
        console.warn(`[gemini] ${model} out of retry budget after ${elapsed}ms — surfacing the error`)
        break
      }

      // Back off a little between tries; a burst limit clears in about a second.
      const waitMs = 700 * attempt
      console.warn(
        `[gemini] ${model} attempt ${attempt}/${attempts} failed (${
          err instanceof Error ? err.message : String(err)
        }) — retrying in ${waitMs}ms`,
      )
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
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
The budget is held in NimTrust's escrow account, already paid out of the
client's wallet. Your verdict is a recommendation: it moves money only if both
parties accept it, so write findings that could persuade the side it goes
against.

  release        — the freelancer delivered what was agreed; pay them in full
  refund         — the freelancer did not deliver; return the escrow to the client
  partial_refund — partly delivered; split the escrow between them
  escalate       — the evidence is too thin or contradictory to call

State freelancer_percent on every verdict: 100 for release, 0 for refund, and
for a partial, the share the delivered work actually earned. Anchor that number
to the deliverables — if three were promised and two arrived complete and on
time, say so and let the number follow from it.

Weigh only the evidence below. Cite specific deliverables, dates, and messages
in your findings, and do not invent facts that are not present. Late delivery
of complete work and on-time delivery of incomplete work are different failures
— do not treat them alike.

=== AGREEMENT ===
${agreementDetails}

=== TIMELINE ===
${timeline}

=== MESSAGES ===
${messages}

=== SUBMITTED WORK ===
${submittedWork}`,
    VERDICT_SCHEMA,
    // Two attempts, not three: a mediation call with a thinking budget is slow
    // enough that a third would outlive the route.
    { maxOutputTokens: 1800, thinkingLevel: 'low', attempts: 2, budgetMs: 30_000 },
  )
}

// Lightweight assistant chat.
export async function chatWithAssistant(userMessage: string) {
  const interaction = await getGeminiClient().interactions.create({
    model: FAST_MODEL,
    input: `You are the NimTrust assistant. NimTrust is a Nimiq Pay mini app where
strangers agree on work, lock payment in escrow, and settle by approval or by
AI mediation that both parties accept. Answer briefly and practically.

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
