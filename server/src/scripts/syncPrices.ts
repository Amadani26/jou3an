/**
 * Price backfill — `npm run sync:prices`
 *
 * Corrects the rows the old import DEFAULT invented a price for. Until the
 * `price_optional` migration, a candidate with no Google `priceLevel` was
 * written as AED 45–100 ("the middle of the market") and the app displayed
 * that guess as if real — 75 live rows. This script re-asks Google for just
 * `priceLevel` on exactly those rows and writes either the REAL band's range
 * or NULL (price unknown — hidden by the UI, neutral to the engine).
 *
 * ⚠️ TARGETING: only rows whose range is exactly the old fallback (45–100),
 * with a `googlePlaceId`, and NOT hand-seeded (`phone` is the seed-only
 * column — a human typed those prices). No real Google band maps to 45–100,
 * so the signature is unambiguous.
 *
 * 💵 `priceLevel` is the Places "Pro" SKU (~$17/1,000 calls). The row count
 * and estimate print before the first call; `--dry-run` still bills (Google is
 * being asked) but writes nothing.
 *
 * Flags: --dry-run, --limit <n>, --only <id | name fragment>
 */
import 'dotenv/config'
import prisma from '../lib/prisma'
import { getPlacePrice } from '../services/googlePlaces'
import { priceRangeFor } from '../lib/importMapping'
import { col, flag, parseArgs, sleep } from '../lib/importFiles'

/** The old import default — the signature of a guessed price. */
const FALLBACK_MIN = 45
const FALLBACK_MAX = 100

/** Pro SKU, per call — for the printed estimate only. */
const USD_PER_CALL = 0.017

const CALL_GAP_MS = 300

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dryRun = flag(args['dry-run'])
  const only = typeof args.only === 'string' ? args.only.trim() : ''
  const limit =
    typeof args.limit === 'string' && Number.isFinite(Number(args.limit))
      ? Math.max(1, Math.floor(Number(args.limit)))
      : undefined

  const rows = await prisma.restaurant.findMany({
    where: {
      priceMin: FALLBACK_MIN,
      priceMax: FALLBACK_MAX,
      googlePlaceId: { not: null },
      phone: null, // hand-seeded rows keep what a human typed
      ...(only
        ? { OR: [{ id: only }, { name: { contains: only, mode: 'insensitive' } }] }
        : {}),
    },
    select: { id: true, name: true, googlePlaceId: true },
    orderBy: { name: 'asc' },
    ...(limit ? { take: limit } : {}),
  })

  if (!rows.length) {
    console.log('No rows carry the old 45–100 fallback — nothing to correct.')
    return
  }

  console.log(
    `\n💰 Re-asking Google for the price band of ${rows.length} row(s)` +
      `${dryRun ? ' (DRY RUN — nothing written, calls still billed)' : ''}`,
  )
  console.log(
    `💵 Estimated cost: ~$${(rows.length * USD_PER_CALL).toFixed(2)} ` +
      `(Place Details Pro SKU, ~$${(USD_PER_CALL * 1000).toFixed(0)}/1,000 calls)\n`,
  )

  let calls = 0
  let repriced = 0
  let nulled = 0
  let errored = 0

  for (const r of rows) {
    try {
      const details = await getPlacePrice(r.googlePlaceId!)
      calls++
      const range = priceRangeFor(details.priceLevel)
      if (!dryRun) {
        await prisma.restaurant.update({
          where: { id: r.id },
          data: { priceMin: range?.min ?? null, priceMax: range?.max ?? null },
        })
      }
      if (range) {
        repriced++
        console.log(
          `  ✓ ${col(r.name, 44)} ${details.priceLevel} → AED ${range.min}–${range.max}`,
        )
      } else {
        nulled++
        console.log(`  · ${col(r.name, 44)} no price signal → null (hidden)`)
      }
    } catch (err) {
      errored++
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  ! ${col(r.name, 44)} ${message.slice(0, 80)}`)
    }
    await sleep(CALL_GAP_MS)
  }

  console.log(
    `\n${repriced} repriced from a real Google band · ${nulled} set to null · ` +
      `${errored} errored · ${calls} API call(s), ~$${(calls * USD_PER_CALL).toFixed(2)}`,
  )
  if (dryRun) console.log('(dry run — nothing was written)')
  console.log()
}

main()
  .catch((err) => {
    console.error('\n✗ Price backfill failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
