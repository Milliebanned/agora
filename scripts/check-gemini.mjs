// Preflight for the AI layer: proves GEMINI_API_KEY works and that both
// configured models answer, without going through the app.
//
//   node scripts/check-gemini.mjs
//
// Reads .env.local the same way Next.js does.
import { readFileSync } from 'node:fs'
import { GoogleGenAI } from '@google/genai'

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  }
} catch {
  console.log('No .env.local found — falling back to the shell environment.')
}

const key = process.env.GEMINI_API_KEY
if (!key) {
  console.error('✗ GEMINI_API_KEY is not set. Add it to .env.local and re-run.')
  process.exit(1)
}
console.log(`✓ GEMINI_API_KEY present (${key.slice(0, 6)}…${key.slice(-4)})`)

const reasoning = process.env.GEMINI_REASONING_MODEL || 'gemini-3.8-flash'
const fast = process.env.GEMINI_FAST_MODEL || 'gemini-3.5-flash-lite'
const ai = new GoogleGenAI({ apiKey: key })

let failed = false
for (const [label, model] of [
  ['reasoning', reasoning],
  ['fast', fast],
]) {
  try {
    const interaction = await ai.interactions.create({
      model,
      input: 'Reply with JSON: {"ok": true}',
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
          required: ['ok'],
        },
      },
      generation_config: { max_output_tokens: 200, thinking_level: 'minimal' },
    })
    const parsed = JSON.parse(interaction.output_text)
    console.log(`✓ ${label} model "${model}" responded: ${JSON.stringify(parsed)}`)
  } catch (err) {
    failed = true
    console.error(`✗ ${label} model "${model}" failed: ${err.message}`)
  }
}

process.exit(failed ? 1 : 0)
