/**
 * Highlight tags — `npm run generate:tags`
 *
 * Fills `Restaurant.tags` across the servable catalogue in two passes:
 *
 *   1. RULES (free, deterministic): Google's stored taxonomy, the opening
 *      hours and the AED price band → tags, via `rulesTagsFor()`.
 *   2. LLM (Haiku-class): only for rows the rules left with fewer than
 *      `LLM_THRESHOLD` tags, choosing from the SAME closed vocabulary over
 *      STORED FACTS ONLY. A reply outside the vocabulary is rejected and
 *      re-asked once with the problem named; two strikes and the row keeps
 *      what the rules gave it.
 *
 * ⚠️ Existing tags are NEVER removed — `mergeTags` only appends. The 8
 * hand-curated rows keep every tag a human wrote, and nothing un-learns a
 * taste-vector dimension users have already trained on.
 *
 * IDEMPOTENT: both passes recompute from stored facts, and a merge that adds
 * nothing writes nothing — so a re-run after a partial run costs only the
 * remainder of the LLM rows.
 *
 * Flags:
 *   --dry-run          compute and print everything, write nothing (LLM calls
 *                      are still billed — they are the thing being previewed)
 *   --rules-only       skip the LLM pass entirely (zero API calls)
 *   --limit <n>        cap the LLM pass at n rows
 *   --only <id | name fragment>
 *   --concurrency <n>  parallel LLM requests, default 4 (capped at 8)
 *   --model <id>       override the model (default claude-haiku-4-5)
 */
import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import prisma from '../lib/prisma'
import { col, flag, parseArgs, sleep } from '../lib/importFiles'
import {
  TAGS_SYSTEM,
  TAG_VOCABULARY,
  buildTagsPrompt,
  mergeTags,
  parseTagsReply,
  rulesTagsFor,
  type TagSource,
} from '../lib/restaurantTags'
import { SERVEABLE_WHERE } from '../lib/venueType'

const DEFAULT_MODEL = 'claude-haiku-4-5'

/** USD per million tokens, Haiku 4.5. Only used for the printed estimate. */
const USD_PER_MTOK_IN = 1
const USD_PER_MTOK_OUT = 5

/** A 3-slug reply needs nothing more. */
const MAX_TOKENS = 64

const BATCH_DELAY_MS = 400
const TRANSIENT_RETRIES = 3

/** Rows with fewer tags than this after the rules pass go to the LLM. */
const LLM_THRESHOLD = 2

type Row = TagSource & { id: string }

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
 * One row, one LLM classification. Same two-strike shape as generateOne in
 * generateDescriptions.ts: the second attempt is told exactly what was wrong,
 * with the rejected reply kept in the conversation as the referent.
 */
async function classifyOne(
  client: Anthropic,
  model: string,
  r: Row,
): Promise<{ tags: string[] | null; note: string; inputTokens: number; outputTokens: number }> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildTagsPrompt(r) },
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
          system: TAGS_SYSTEM,
          messages,
        })
        break
      } catch (err) {
        if (!isTransient(err) || tries === TRANSIENT_RETRIES) throw err
        await sleep(1500 * (tries + 1))
      }
    }
    if (!message) throw new Error('no response')

    inputTokens += message.usage.input_tokens
    outputTokens += message.usage.output_tokens

    const raw = textOf(message)
    const parsed = parseTagsReply(raw)
    if (parsed.ok) {
      return {
        tags: parsed.tags,
        note: attempt === 0 ? '' : 'retried',
        inputTokens,
        outputTokens,
      }
    }

    lastProblems = parsed.problems
    messages.push(
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content:
          `That reply is not usable: ${parsed.problems.join('; ')}. ` +
          'Reply again with at most 3 tags from the allowed list, comma-separated, or "none".',
      },
    )
  }

  return { tags: null, note: lastProblems.join('; '), inputTokens, outputTokens }
}

function printDistribution(rows: { tags: string[] }[]) {
  const counts = new Map<string, number>()
  let covered = 0
  for (const r of rows) {
    if (r.tags.length) covered++
    for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  console.log(
    `\n📊 Coverage: ${covered}/${rows.length} servable rows with ≥1 tag ` +
      `(${((covered / rows.length) * 100).toFixed(1)}%)`,
  )
  console.log(`${col('TAG', 24)}${col('LABEL', 24)}ROWS`)
  for (const def of TAG_VOCABULARY) {
    console.log(`${col(def.slug, 24)}${col(def.label, 24)}${counts.get(def.slug) ?? 0}`)
  }
  const foreign = [...counts.keys()].filter(
    (t) => !TAG_VOCABULARY.some((d) => d.slug === t),
  )
  if (foreign.length) {
    console.log(
      `(plus hand-seeded tags outside the vocabulary, kept as-is: ${foreign
        .map((t) => `${t}:${counts.get(t)}`)
        .join(', ')})`,
    )
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dryRun = flag(args['dry-run'])
  const rulesOnly = flag(args['rules-only'])
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

  const rows: Row[] = await prisma.restaurant.findMany({
    where: {
      ...SERVEABLE_WHERE,
      ...(only
        ? { OR: [{ id: only }, { name: { contains: only, mode: 'insensitive' } }] }
        : {}),
    },
    select: {
      id: true,
      name: true,
      cuisineType: true,
      tags: true,
      priceMin: true,
      priceMax: true,
      googlePrimaryType: true,
      googleTypes: true,
      openingHours: true,
      description: true,
    },
    orderBy: { name: 'asc' },
  })

  if (!rows.length) {
    console.log('No servable restaurants matched.')
    return
  }

  console.log(
    `\n🏷️  Tagging ${rows.length} servable restaurant(s)` +
      `${dryRun ? ' (DRY RUN — nothing written)' : ''}\n`,
  )

  /* ----------------------------- rules pass ----------------------------- */

  const afterRules = rows.map((r) => {
    const merged = mergeTags(r.tags, rulesTagsFor(r))
    return { ...r, before: r.tags, tags: merged, changed: merged.length !== r.tags.length }
  })

  const rulesChanged = afterRules.filter((r) => r.changed)
  console.log(`⚙️  Rules pass: ${rulesChanged.length} row(s) gain tags.`)

  if (!dryRun) {
    for (const r of rulesChanged) {
      await prisma.restaurant.update({ where: { id: r.id }, data: { tags: r.tags } })
    }
    console.log(`   written.`)
  }

  /* ------------------------------ LLM pass ------------------------------ */

  const thin = afterRules.filter((r) => r.tags.length < LLM_THRESHOLD)
  const llmRows = rulesOnly ? [] : limit ? thin.slice(0, limit) : thin

  if (rulesOnly) {
    console.log(`\n⏭️  --rules-only: skipping the LLM pass (${thin.length} thin row(s) untouched).`)
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      console.error('\n✗ ANTHROPIC_API_KEY is missing or still the placeholder in server/.env.')
      console.error('  The rules pass above is unaffected; re-run with a real key, or --rules-only.\n')
      process.exitCode = 1
      return
    }

    // Same org-level-key accommodation as generateDescriptions.ts: optional
    // `ANTHROPIC_WORKSPACE_ID` (wrkspc_…) for keys not scoped to a workspace.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim()
    const client = new Anthropic({
      apiKey,
      ...(workspaceId
        ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } }
        : {}),
    })

    let perRowInput = 0
    if (llmRows.length) {
      try {
        const counted = await client.messages.countTokens({
          model,
          system: TAGS_SYSTEM,
          messages: [{ role: 'user', content: buildTagsPrompt(llmRows[0]) }],
        })
        perRowInput = counted.input_tokens
      } catch {
        // Non-fatal: the estimate is a courtesy.
      }
    }

    const estIn = (perRowInput * llmRows.length * USD_PER_MTOK_IN) / 1_000_000
    const estOut = (20 * llmRows.length * USD_PER_MTOK_OUT) / 1_000_000
    console.log(
      `\n🤖 LLM pass: ${llmRows.length} row(s) with fewer than ${LLM_THRESHOLD} tags, on ${model}.`,
    )
    if (perRowInput) {
      console.log(
        `💵 Estimated cost: ~$${(estIn + estOut).toFixed(2)} ` +
          `(~${perRowInput} input tokens/row at $${USD_PER_MTOK_IN}/M in, $${USD_PER_MTOK_OUT}/M out)\n`,
      )
    }

    let totalIn = 0
    let totalOut = 0
    let written = 0
    let none = 0
    let rejected = 0
    let errored = 0

    for (let i = 0; i < llmRows.length; i += concurrency) {
      const batch = llmRows.slice(i, i + concurrency)
      const results = await Promise.all(
        batch.map(async (r) => {
          try {
            return { r, ...(await classifyOne(client, model, r)) }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { r, tags: null, note: message.slice(0, 120), inputTokens: 0, outputTokens: 0 }
          }
        }),
      )

      for (const o of results) {
        totalIn += o.inputTokens
        totalOut += o.outputTokens
        if (o.tags === null) {
          if (o.note && !o.note.includes('vocabulary') && !o.note.includes('tags, maximum')) errored++
          else rejected++
          console.log(`  ! ${o.r.name} — rejected: ${o.note}`)
          continue
        }
        if (!o.tags.length) {
          none++
          console.log(`  · ${o.r.name} — none apply`)
          continue
        }
        const merged = mergeTags(o.r.tags, o.tags)
        if (merged.length !== o.r.tags.length) {
          o.r.tags = merged
          written++
          if (!dryRun) {
            await prisma.restaurant.update({ where: { id: o.r.id }, data: { tags: merged } })
          }
        }
        console.log(`  ✓ ${o.r.name} → ${o.tags.join(', ')}${o.note ? ` (${o.note})` : ''}`)
      }

      const done = Math.min(i + concurrency, llmRows.length)
      if (done < llmRows.length) {
        console.log(`    … ${done}/${llmRows.length}`)
        await sleep(BATCH_DELAY_MS)
      }
    }

    const actual =
      (totalIn * USD_PER_MTOK_IN) / 1_000_000 + (totalOut * USD_PER_MTOK_OUT) / 1_000_000
    console.log(
      `\n${written} ${dryRun ? 'would gain' : 'gained'} LLM tags · ${none} none-apply · ` +
        `${rejected} rejected · ${errored} errored · ${llmRows.length} examined`,
    )
    console.log(
      `📊 Tokens: ${totalIn.toLocaleString()} in / ${totalOut.toLocaleString()} out — ` +
        `$${actual.toFixed(2)} on ${model}`,
    )
  }

  printDistribution(afterRules)
  console.log()
}

main()
  .catch((err) => {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('\n✗ Anthropic rejected the API key (401). Check ANTHROPIC_API_KEY in server/.env.\n')
    } else {
      console.error('\n✗ Tag generation failed:', err instanceof Error ? err.message : err)
    }
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
