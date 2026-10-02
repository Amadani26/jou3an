/**
 * Description backfill — `npm run sync:descriptions`
 *
 * Fills `Restaurant.description` with Google's own `editorialSummary`: the
 * one-or-two-sentence blurb it writes for places it has one for. That is the
 * best possible source for the "vibe" line, because it is real copy about the
 * real place rather than anything we inferred.
 *
 * ⚠️ COST. `editorialSummary` is an "Enterprise + Atmosphere" field, the most
 * expensive Places band (~$25 / 1,000 Place Details calls at the time of
 * writing). Narrowing the field mask does NOT make the call cheap — a single
 * Atmosphere field prices the whole request — so the mask is narrow only to
 * avoid *also* paying for data already stored. The estimate is printed before
 * the first call; `--dry-run` still makes the calls (it is Google that is being
 * asked), it just writes nothing.
 *
 * ⚠️ Google has NO summary for most places. A row that comes back empty is the
 * normal case, not a failure — `npm run generate:descriptions` is what covers
 * the remainder.
 *
 * Never overwrites a stored description with null: a transient gap in Google's
 * payload, or a re-run after `generate:descriptions`, must not wipe copy we
 * already have.
 *
 * Flags:
 *   --force   re-fetch rows that already have a description
 *   --only <id | name fragment>
 *   --limit <n>   stop after n rows (cap the bill on a first pass)
 *   --dry-run fetch and print, write nothing
 */
import 'dotenv/config'
import prisma from '../lib/prisma'
import {
  PlacesConfigError,
  extractEditorialSummary,
  getPlaceDescription,
} from '../services/googlePlaces'
import { col, flag, parseArgs, sleep } from '../lib/importFiles'

/** Polite gap between calls. */
const DELAY_MS = 250

/** USD per 1,000 Place Details calls on the Enterprise + Atmosphere SKU. */
const USD_PER_1K_CALLS = 25

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const force = flag(args.force)
  const dryRun = flag(args['dry-run'])
  const only = typeof args.only === 'string' ? args.only.trim() : ''
  const limit =
    typeof args.limit === 'string' && Number.isFinite(Number(args.limit))
      ? Math.max(1, Math.floor(Number(args.limit)))
      : undefined

  const restaurants = await prisma.restaurant.findMany({
    where: {
      // Without a place id there is nothing to look up.
      googlePlaceId: { not: null },
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
        ? 'No restaurants with a googlePlaceId to refresh.'
        : 'Every Places-synced restaurant already has a description. (Use --force to refresh.)',
    )
    return
  }

  const estimate = (restaurants.length * USD_PER_1K_CALLS) / 1000
  console.log(
    `\n📝 Fetching Google editorial summaries for ${restaurants.length} restaurant(s)` +
      `${dryRun ? ' (DRY RUN — calls still billed, nothing written)' : ''}\n`,
  )
  console.log(
    `💵 Estimated Places cost: ~$${estimate.toFixed(2)} ` +
      `(${restaurants.length} × Enterprise + Atmosphere Place Details)\n`,
  )

  const rows: { name: string; summary: string; outcome: string }[] = []
  let apiCalls = 0
  let filled = 0
  let none = 0
  let unchanged = 0

  for (const r of restaurants) {
    try {
      const details = await getPlaceDescription(r.googlePlaceId as string)
      apiCalls++

      const summary = extractEditorialSummary(details)

      if (!summary) {
        none++
        rows.push({ name: r.name, summary: '—', outcome: 'no summary' })
        console.log(`  · ${r.name} — Google has no editorial summary`)
      } else if (summary === r.description) {
        unchanged++
        rows.push({ name: r.name, summary, outcome: 'unchanged' })
        console.log(`  = ${r.name} — unchanged`)
      } else {
        if (!dryRun) {
          await prisma.restaurant.update({
            where: { id: r.id },
            data: { description: summary },
          })
        }
        filled++
        rows.push({
          name: r.name,
          summary,
          outcome: r.description ? 'replaced' : 'filled',
        })
        console.log(`  ✓ ${r.name} → ${summary}`)
      }
    } catch (err) {
      if (err instanceof PlacesConfigError) throw err
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  ! ${r.name} — ${message}`)
      rows.push({ name: r.name, summary: '—', outcome: 'error' })
    }

    await sleep(DELAY_MS)
  }

  console.log('\n' + '─'.repeat(110))
  console.log(`${col('RESTAURANT', 32)}${col('OUTCOME', 12)}SUMMARY`)
  console.log('─'.repeat(110))
  for (const row of rows) {
    console.log(`${col(row.name, 32)}${col(row.outcome, 12)}${col(row.summary, 64)}`)
  }
  console.log('─'.repeat(110))

  console.log(
    `\n${filled} ${dryRun ? 'would be written' : 'written'} · ${unchanged} unchanged · ` +
      `${none} with no Google summary · ${rows.length} examined`,
  )
  console.log(
    `📊 Places API calls: ${apiCalls} (editorial summary only) — ` +
      `~$${((apiCalls * USD_PER_1K_CALLS) / 1000).toFixed(2)}`,
  )
  if (none) {
    console.log(
      `\n✍️  ${none} row(s) have no Google summary. Write those with:\n` +
        '   npm run generate:descriptions',
    )
  }
  console.log()
}

main()
  .catch((err) => {
    if (err instanceof PlacesConfigError) {
      console.error(`\n✗ ${err.message}`)
      console.error('  Add GOOGLE_PLACES_API_KEY to server/.env and re-run.')
    } else {
      console.error(
        '\n✗ Description sync failed:',
        err instanceof Error ? err.message : err,
      )
    }
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
