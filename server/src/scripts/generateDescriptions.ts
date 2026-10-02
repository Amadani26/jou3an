/**
 * Generated descriptions — `npm run generate:descriptions`
 *
 * Writes the two-sentence "vibe" line for every restaurant Google has no
 * `editorialSummary` for. Run `npm run sync:descriptions` FIRST: Google's own
 * copy is about the real place, and this is the fallback for the rest.
 *
 * ⚠️ STORED FACTS ONLY. The prompt carries name, cuisine, tags, price band,
 * neighbourhood, Google rating and Google's place type — nothing else — and the
 * model is told it does not know the dishes, the chef, the decor or the history.
 * A line that invents any of that is a claim about a real business that the app
 * cannot stand behind, so `validateDescription()` rejects the reply rather than
 * trimming it, and a rejected row simply keeps its null description (which
 * every surface already hides).
 *
 * IDEMPOTENT: rows that already have a description are skipped, so a re-run
 * after a partial run only costs the remainder. `--force` overrides that —
 * including over Google's own summaries, which is almost never what you want.
 *
 * Uses a Haiku-class model on purpose: this is short, heavily-constrained
 * writing over a fact list, and the per-row cost is what decides whether the
 * whole catalogue can be covered.
 *
 * Flags:
 *   --limit <n>        stop after n rows (cap the bill on a first pass)
 *   --only <id | name fragment>
 *   --concurrency <n>  parallel requests, default 4 (capped at 8)
 *   --model <id>       override the model (default claude-haiku-4-5)
 *   --force            regenerate rows that already have a description
 *   --dry-run          generate and print, write nothing
 */
import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import type { Restaurant } from '@prisma/client'
import prisma from '../lib/prisma'
import {
  DESCRIPTION_SYSTEM,
  buildDescriptionPrompt,
  sanitizeDescription,
  validateDescription,
} from '../lib/descriptions'
import { col, flag, parseArgs, sleep } from '../lib/importFiles'

/** Cheap by design — see the header. */
const DEFAULT_MODEL = 'claude-haiku-4-5'

/** USD per million tokens, Haiku 4.5. Only used for the printed estimate. */
const USD_PER_MTOK_IN = 1
const USD_PER_MTOK_OUT = 5

/** Two sentences need nothing more; a bigger cap only buys runaway replies. */
const MAX_TOKENS = 256

/** Polite gap between batches. */
const BATCH_DELAY_MS = 400

/** How many times a 429 / 5xx is retried before the row is given up on. */
const TRANSIENT_RETRIES = 3

interface Outcome {
  name: string
  status: 'written' | 'would write' | 'rejected' | 'error' | 'skipped'
  description: string
  note: string
  inputTokens: number
  outputTokens: number
}

/** True for the errors worth waiting out rather than abandoning a row for. */
function isTransient(err: unknown): boolean {
  if (err instanceof Anthropic.RateLimitError) return true
  if (err instanceof Anthropic.APIConnectionError) return true
  if (err instanceof Anthropic.APIError) return (err.status ?? 0) >= 500
  return false
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

/**
 * One row, one description.
 *
 * Asks once; if the reply breaks a rule the second attempt is told exactly
 * which rule, because "two sentences" fails far more often than anything about
 * content and a nudge fixes it. Two strikes and the row is left alone.
 */
async function generateOne(
  client: Anthropic,
  model: string,
  r: Restaurant,
): Promise<{ text: string | null; note: string; inputTokens: number; outputTokens: number }> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildDescriptionPrompt(r) },
  ]
  let inputTokens = 0
  let outputTokens = 0
  let lastProblems: string[] = []

  for (let attempt = 0; attempt < 2; attempt++) {
    let message: Anthropic.Message | null = null

    for (let tries = 0; tries <= TRANSIENT_RETRIES; tries++) {
      try {
        message = await client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          system: DESCRIPTION_SYSTEM,
          messages,
        })
        break
      } catch (err) {
        if (!isTransient(err) || tries === TRANSIENT_RETRIES) throw err
        // Linear backoff — this is a background batch, not a user waiting.
        await sleep(1500 * (tries + 1))
      }
    }
    if (!message) throw new Error('no response')

    inputTokens += message.usage.input_tokens
    outputTokens += message.usage.output_tokens

    const raw = textOf(message)
    const text = sanitizeDescription(raw)
    const check = validateDescription(text)
    if (check.ok) {
      return {
        text,
        note: attempt === 0 ? '' : 'retried',
        inputTokens,
        outputTokens,
      }
    }

    lastProblems = check.problems
    // Keep the rejected attempt in the conversation: the model needs to see
    // what it wrote to understand what the complaint refers to.
    messages.push(
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content:
          `That reply is not usable: ${check.problems.join('; ')}. ` +
          'Rewrite it as exactly two plain sentences using only the facts above.',
      },
    )
  }

  return { text: null, note: lastProblems.join('; '), inputTokens, outputTokens }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const force = flag(args.force)
  const dryRun = flag(args['dry-run'])
  const only = typeof args.only === 'string' ? args.only.trim() : ''
  const model = typeof args.model === 'string' ? args.model.trim() : DEFAULT_MODEL
  const limit =
    typeof args.limit === 'string' && Number.isFinite(Number(args.limit))
      ? Math.max(1, Math.floor(Number(args.limit)))
      : undefined
  const concurrency =
    typeof args.concurrency === 'string' && Number.isFinite(Number(args.concurrency))
      ? Math.min(8, Math.max(1, Math.floor(Number(args.concurrency))))
      : 4

  // The key is the whole reason this script exists as a separate step, so say
  // so plainly rather than letting the SDK throw a 401 four hundred times.
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    console.error('\n✗ ANTHROPIC_API_KEY is not set.')
    console.error('  Add it to server/.env and re-run:')
    console.error('    ANTHROPIC_API_KEY=sk-ant-...\n')
    console.error('  Google-sourced descriptions do not need it — that is')
    console.error('    npm run sync:descriptions\n')
    process.exitCode = 1
    return
  }
  if (!apiKey.startsWith('sk-ant-')) {
    console.error(
      `\n✗ ANTHROPIC_API_KEY does not look like a real key (starts with "${apiKey.slice(0, 8)}").`,
    )
    console.error('  server/.env still has the placeholder value. Replace it with a')
    console.error('  real key from console.anthropic.com and re-run.\n')
    process.exitCode = 1
    return
  }

  const restaurants = await prisma.restaurant.findMany({
    where: {
      ...(force ? {} : { description: null }),
      ...(only
        ? { OR: [{ id: only }, { name: { contains: only, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: { name: 'asc' },
    ...(limit ? { take: limit } : {}),
  })

  if (!restaurants.length) {
    console.log(
      force
        ? 'No restaurants matched.'
        : 'Every restaurant already has a description. (Use --force to regenerate.)',
    )
    return
  }

  const client = new Anthropic({ apiKey })

  // One free count_tokens call on a real prompt beats guessing from character
  // counts — the per-row input is near-identical across the catalogue.
  let perRowInput = 0
  try {
    const counted = await client.messages.countTokens({
      model,
      system: DESCRIPTION_SYSTEM,
      messages: [{ role: 'user', content: buildDescriptionPrompt(restaurants[0]) }],
    })
    perRowInput = counted.input_tokens
  } catch {
    // Non-fatal: the estimate is a courtesy, the run is not blocked on it.
  }

  const estIn = (perRowInput * restaurants.length * USD_PER_MTOK_IN) / 1_000_000
  // Two sentences land around 60 output tokens; budget generously.
  const estOut = (90 * restaurants.length * USD_PER_MTOK_OUT) / 1_000_000

  console.log(
    `\n✍️  Generating descriptions for ${restaurants.length} restaurant(s) with ${model}` +
      `${dryRun ? ' (DRY RUN — nothing written)' : ''}\n`,
  )
  if (perRowInput) {
    console.log(
      `💵 Estimated cost: ~$${(estIn + estOut).toFixed(2)} ` +
        `(~${perRowInput} input tokens/row at $${USD_PER_MTOK_IN}/M in, ` +
        `$${USD_PER_MTOK_OUT}/M out)\n`,
    )
  }

  const outcomes: Outcome[] = []
  let totalIn = 0
  let totalOut = 0

  // Small batches rather than one flat fan-out: polite to the API, and it keeps
  // a failing run from racing hundreds of requests out the door before the
  // first error is visible.
  for (let i = 0; i < restaurants.length; i += concurrency) {
    const batch = restaurants.slice(i, i + concurrency)

    const results = await Promise.all(
      batch.map(async (r): Promise<Outcome> => {
        try {
          const { text, note, inputTokens, outputTokens } = await generateOne(
            client,
            model,
            r,
          )
          if (!text) {
            return {
              name: r.name,
              status: 'rejected',
              description: '—',
              note,
              inputTokens,
              outputTokens,
            }
          }
          if (!dryRun) {
            await prisma.restaurant.update({
              where: { id: r.id },
              data: { description: text },
            })
          }
          return {
            name: r.name,
            status: dryRun ? 'would write' : 'written',
            description: text,
            note,
            inputTokens,
            outputTokens,
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return {
            name: r.name,
            status: 'error',
            description: '—',
            note: message.slice(0, 120),
            inputTokens: 0,
            outputTokens: 0,
          }
        }
      }),
    )

    for (const o of results) {
      outcomes.push(o)
      totalIn += o.inputTokens
      totalOut += o.outputTokens
      const mark = o.status === 'written' || o.status === 'would write' ? '✓' : '!'
      console.log(
        `  ${mark} ${o.name}` +
          (o.status === 'written' || o.status === 'would write'
            ? ` → ${o.description}`
            : ` — ${o.status}: ${o.note}`),
      )
    }

    const done = Math.min(i + concurrency, restaurants.length)
    if (done < restaurants.length) {
      console.log(`    … ${done}/${restaurants.length}`)
      await sleep(BATCH_DELAY_MS)
    }
  }

  const written = outcomes.filter(
    (o) => o.status === 'written' || o.status === 'would write',
  ).length
  const rejected = outcomes.filter((o) => o.status === 'rejected').length
  const errored = outcomes.filter((o) => o.status === 'error').length
  const retried = outcomes.filter((o) => o.note === 'retried').length

  console.log('\n' + '─'.repeat(110))
  console.log(`${col('RESTAURANT', 30)}${col('STATUS', 13)}DESCRIPTION`)
  console.log('─'.repeat(110))
  for (const o of outcomes) {
    console.log(
      `${col(o.name, 30)}${col(o.status, 13)}${col(
        o.description === '—' ? o.note : o.description,
        65,
      )}`,
    )
  }
  console.log('─'.repeat(110))

  const actual =
    (totalIn * USD_PER_MTOK_IN) / 1_000_000 + (totalOut * USD_PER_MTOK_OUT) / 1_000_000
  console.log(
    `\n${written} ${dryRun ? 'would be written' : 'written'} · ${rejected} rejected · ` +
      `${errored} errored · ${retried} needed a second attempt · ${outcomes.length} examined`,
  )
  console.log(
    `📊 Tokens: ${totalIn.toLocaleString()} in / ${totalOut.toLocaleString()} out — ` +
      `$${actual.toFixed(2)} on ${model}`,
  )
  if (rejected) {
    console.log(
      `\n⚠️  ${rejected} row(s) were rejected and keep a null description — the app\n` +
        '   hides the line entirely, so nothing is broken. Re-run to try them again.',
    )
  }
  console.log()
}

main()
  .catch((err) => {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('\n✗ Anthropic rejected the API key (401).')
      console.error('  Check ANTHROPIC_API_KEY in server/.env.\n')
    } else {
      console.error(
        '\n✗ Description generation failed:',
        err instanceof Error ? err.message : err,
      )
    }
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
