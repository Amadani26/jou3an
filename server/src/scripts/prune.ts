/**
 * Catalogue pruning — remove weak restaurants from the decision surfaces.
 *
 *   npm run prune -- --list                                  # propose, write nothing
 *   npm run prune -- --list --area "Dubai Marina" --max-rating 4.2
 *   npm run prune -- --file server/imports/prune.json        # deactivate, after y/N
 *   npm run prune -- --restore --placeId ChIJ…               # put one back
 *
 * Two deliberate steps, mirroring discover -> import: `--list` writes
 * `imports/prune-candidates.json` and touches nothing; a human edits that file
 * down to ONLY the rows they want gone and passes it back with `--file`.
 *
 * ⚠️ SOFT DELETE ONLY. Rows are never deleted: DecisionSession.resultIds,
 * DecisionSession.selectedResultId, DailyPick and DecisionLog all reference
 * restaurants, and a user's history must keep rendering. `isActive: false` is
 * what removes a row from every decision surface (see lib/venueType.ts).
 *
 * Each deactivated row's placeId is also appended to `imports/rejected.json`,
 * so discovery never proposes the same weak restaurant back.
 */
import 'dotenv/config'
import path from 'node:path'
import type { Restaurant } from '@prisma/client'
import prisma from '../lib/prisma'
import { displayArea } from '../lib/areaName'
import { SERVEABLE_WHERE } from '../lib/venueType'
import {
  IMPORTS_DIR,
  addRejected,
  col,
  confirm,
  flag,
  parseArgs,
  readJson,
  removeRejected,
  writeJson,
} from '../lib/importFiles'

/** Where `--list` writes its proposal, and the default input for `--file`. */
const CANDIDATES_PATH = path.join(IMPORTS_DIR, 'prune-candidates.json')

/** One row in the prune-candidates file — also the shape `--file` accepts. */
interface PruneRow {
  id: string
  placeId: string | null
  name: string
  cuisine: string
  areaName: string
  rating: number | null
  reviewCount: number | null
  price: string
}

const priceLabel = (r: Restaurant) => `${r.priceMin}–${r.priceMax}`

function toRow(r: Restaurant): PruneRow {
  return {
    id: r.id,
    placeId: r.googlePlaceId,
    name: r.name,
    cuisine: r.cuisineType,
    areaName: displayArea(r),
    rating: r.googleRating,
    reviewCount: r.googleRatingCount,
    price: priceLabel(r),
  }
}

/**
 * Worst first.
 *
 * Unrated rows sort LAST, not first: a missing Google rating is our gap in the
 * data, not evidence the place is bad, and this list is read top-down as a
 * removal queue. They are flagged in the table instead so they still get seen.
 */
function byRatingAscending(a: Restaurant, b: Restaurant): number {
  if (a.googleRating === null && b.googleRating === null) return a.name.localeCompare(b.name)
  if (a.googleRating === null) return 1
  if (b.googleRating === null) return -1
  if (a.googleRating !== b.googleRating) return a.googleRating - b.googleRating
  // Same stars: fewer reviews is the weaker signal, so it goes first.
  return (a.googleRatingCount ?? 0) - (b.googleRatingCount ?? 0)
}

/* ------------------------------------------------------------------ */
/* --list                                                              */
/* ------------------------------------------------------------------ */

async function list(args: Record<string, string | true>) {
  const areaFilter = typeof args.area === 'string' ? args.area.trim().toLowerCase() : ''
  const maxRatingArg = args['max-rating']
  const maxRating = maxRatingArg !== undefined ? Number(maxRatingArg) : null

  if (maxRating !== null && !Number.isFinite(maxRating)) {
    console.error('--max-rating must be a number')
    process.exitCode = 1
    return
  }

  // Only what a decision surface can currently serve — an already-pruned row or
  // a parked cafe is not a pruning candidate.
  const all = await prisma.restaurant.findMany({ where: SERVEABLE_WHERE })

  let rows = all
  if (areaFilter) {
    // Matches the real neighbourhood OR the coarse enum, so both "Dubai Marina"
    // and "MARINA" find the same rows.
    rows = rows.filter(
      (r) =>
        displayArea(r).toLowerCase().includes(areaFilter) ||
        r.area.toLowerCase().replace(/_/g, ' ').includes(areaFilter),
    )
  }
  if (maxRating !== null) {
    // An unrated row cannot be shown to be below the threshold, so it is not
    // offered up for removal — same "missing data fails the filter" rule the
    // discovery script uses, pointed the other way.
    rows = rows.filter((r) => r.googleRating !== null && r.googleRating <= maxRating)
  }

  rows.sort(byRatingAscending)

  /* ---- Table, grouped by area ---- */
  const groups = new Map<string, Restaurant[]>()
  for (const r of rows) {
    const key = displayArea(r)
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
  }
  // Worst-rated group first, so the areas most worth pruning lead.
  const ordered = [...groups.entries()].sort(
    (a, b) => byRatingAscending(a[1][0], b[1][0]) || a[0].localeCompare(b[0]),
  )

  const WIDTH = 116
  console.log(
    `\n🌿 Prune candidates — ${rows.length} of ${all.length} servable restaurant(s)` +
      `${areaFilter ? ` · area ~ "${args.area}"` : ''}` +
      `${maxRating !== null ? ` · rating ≤ ${maxRating}` : ''}`,
  )

  for (const [area, group] of ordered) {
    console.log(`\n${area}  (${group.length})`)
    console.log('─'.repeat(WIDTH))
    console.log(
      `${col('RESTAURANT', 34)}${col('CUISINE', 20)}${col('RATING', 9)}${col('REVIEWS', 9)}${col('AED', 12)}ID`,
    )
    console.log('─'.repeat(WIDTH))
    for (const r of group) {
      const rating = r.googleRating === null ? 'unrated' : r.googleRating.toFixed(1)
      console.log(
        `${col(r.name, 34)}${col(r.cuisineType, 20)}${col(rating, 9)}${col(
          String(r.googleRatingCount ?? '—'),
          9,
        )}${col(priceLabel(r), 12)}${r.id}`,
      )
    }
  }
  if (!rows.length) console.log('\n  (nothing matched)')

  const unrated = rows.filter((r) => r.googleRating === null).length
  if (unrated) {
    console.log(
      `\n⚠️  ${unrated} row(s) have no Google rating — listed last, not first. ` +
        'Run `npm run sync:places` before judging them.',
    )
  }
  const noReviews = rows.filter((r) => r.googleRatingCount === null).length
  if (noReviews) {
    console.log(
      `⚠️  ${noReviews} row(s) have no review count, so a 4.9 from six reviews is
` +
        '   indistinguishable from a 4.9 from six thousand. Fill it in with: npm run sync:types',
    )
  }

  writeJson(CANDIDATES_PATH, rows.map(toRow))
  console.log(`\n📝 Wrote ${path.relative(process.cwd(), CANDIDATES_PATH)} (${rows.length} row(s))`)
  console.log(
    '\nNext: copy it to imports/prune.json, DELETE every row you want to KEEP, then\n' +
      '   npm run prune -- --file server/imports/prune.json\n',
  )
}

/* ------------------------------------------------------------------ */
/* --file                                                              */
/* ------------------------------------------------------------------ */

/**
 * Accepts a bare array or `{ rows: [...] }`, and each entry may be a plain
 * string (an id or a placeId) or an object carrying `id` / `placeId`. The
 * curated file is hand-edited, so the parser is forgiving about its shape but
 * strict about finding an actual identifier.
 */
function readIdentifiers(file: string): string[] {
  const raw = readJson<unknown>(file, null)
  if (raw === null) throw new Error(`No such file: ${file}`)

  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { rows?: unknown }).rows)
      ? (raw as { rows: unknown[] }).rows
      : null
  if (!arr) throw new Error(`${path.basename(file)} is neither an array nor { rows: [...] }`)

  const ids = new Set<string>()
  for (const entry of arr) {
    if (typeof entry === 'string' && entry.trim()) {
      ids.add(entry.trim())
      continue
    }
    const row = entry as { id?: unknown; placeId?: unknown }
    if (row && typeof row.id === 'string' && row.id.trim()) ids.add(row.id.trim())
    else if (row && typeof row.placeId === 'string' && row.placeId.trim()) {
      ids.add(row.placeId.trim())
    }
  }
  return [...ids]
}

async function prune(args: Record<string, string | true>) {
  const fileArg = args.file
  if (typeof fileArg !== 'string' || !fileArg.trim()) {
    console.error('Usage: npm run prune -- --file server/imports/prune.json')
    process.exitCode = 1
    return
  }

  // Accept a repo-root-relative path (as the docs show) or a plain one.
  const resolved = path.isAbsolute(fileArg)
    ? fileArg
    : [path.resolve(process.cwd(), fileArg), path.resolve(process.cwd(), '..', fileArg)].find(
        (p) => readJson<unknown>(p, null) !== null,
      ) ?? path.resolve(process.cwd(), fileArg)

  const identifiers = readIdentifiers(resolved)
  if (!identifiers.length) {
    console.log('That file names no restaurants (each row needs an id or a placeId).')
    return
  }

  // Ids and placeIds arrive mixed, so match on either.
  const targets = await prisma.restaurant.findMany({
    where: {
      OR: [{ id: { in: identifiers } }, { googlePlaceId: { in: identifiers } }],
    },
  })
  const found = new Set([
    ...targets.map((r) => r.id),
    ...targets.flatMap((r) => (r.googlePlaceId ? [r.googlePlaceId] : [])),
  ])
  const missing = identifiers.filter((i) => !found.has(i))

  const alreadyOff = targets.filter((r) => !r.isActive)
  const toDeactivate = targets.filter((r) => r.isActive)

  console.log(`\n🌿 Pruning from ${path.basename(resolved)}`)
  if (missing.length) {
    console.log(`\n⚠️  ${missing.length} identifier(s) matched no restaurant:`)
    for (const m of missing.slice(0, 10)) console.log(`     · ${m}`)
    if (missing.length > 10) console.log(`     … and ${missing.length - 10} more`)
  }
  if (alreadyOff.length) {
    console.log(`\n· ${alreadyOff.length} already inactive — nothing to do for those.`)
  }

  if (!toDeactivate.length) {
    console.log('\nNothing left to deactivate.')
    return
  }

  console.log(`\nAbout to DEACTIVATE ${toDeactivate.length} restaurant(s):\n`)
  for (const r of toDeactivate) {
    const rating = r.googleRating === null ? 'unrated' : r.googleRating.toFixed(1)
    console.log(
      `  · ${col(r.name, 34)}${col(r.cuisineType, 18)}${col(displayArea(r).slice(0, 20), 22)}` +
        `${rating} (${r.googleRatingCount ?? '—'} reviews)`,
    )
  }
  console.log(
    '\n  They stay in the database (soft delete) so history and logs keep working,\n' +
      '  and their place ids are added to rejected.json so discovery stops proposing them.',
  )

  // A catalogue that cannot field three servable rows makes the engine throw —
  // the product rule is exactly 3, so warn BEFORE the confirm, not after.
  const servableAfter =
    (await prisma.restaurant.count({ where: SERVEABLE_WHERE })) - toDeactivate.length
  if (servableAfter < 3) {
    console.log(
      `\n🚨 This would leave only ${servableAfter} servable restaurant(s). The engine ` +
        'needs 3\n   and throws below that — /api/decisions/query would start failing.',
    )
  } else if (servableAfter < 10) {
    console.log(`\n⚠️  Only ${servableAfter} servable restaurant(s) would remain.`)
  }

  if (!(await confirm('\nDeactivate them?'))) {
    console.log('Aborted — nothing was changed.')
    return
  }

  const ids = toDeactivate.map((r) => r.id)
  const { count } = await prisma.restaurant.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false },
  })

  const withPlaceId = toDeactivate.filter((r) => r.googlePlaceId)
  const added = addRejected(
    withPlaceId.map((r) => r.googlePlaceId as string),
    Object.fromEntries(
      withPlaceId.map((r) => [
        r.googlePlaceId as string,
        `${r.name} — pruned from ${path.basename(resolved)}`,
      ]),
    ),
  )

  console.log(`\n✓ ${count} restaurant(s) deactivated`)
  console.log(`🚫 ${added} place id(s) newly added to rejected.json`)
  const noPlaceId = toDeactivate.length - withPlaceId.length
  if (noPlaceId) {
    console.log(
      `·  ${noPlaceId} row(s) have no googlePlaceId, so there is nothing to reject — ` +
        'discovery could propose them again under a new row.',
    )
  }
  console.log('\nUndo one with: npm run prune -- --restore --placeId <id>\n')
}

/* ------------------------------------------------------------------ */
/* --restore                                                           */
/* ------------------------------------------------------------------ */

async function restore(args: Record<string, string | true>) {
  const placeId = typeof args.placeId === 'string' ? args.placeId.trim() : ''
  if (!placeId) {
    console.error('Usage: npm run prune -- --restore --placeId <id>')
    process.exitCode = 1
    return
  }

  const row = await prisma.restaurant.findUnique({ where: { googlePlaceId: placeId } })
  if (!row) {
    console.log(`· No restaurant has googlePlaceId ${placeId}.`)
    // Still worth clearing the rejection: the id may have been rejected during
    // curation and never imported at all.
    if (removeRejected(placeId)) console.log('  Removed it from rejected.json anyway.')
    return
  }

  if (row.isActive) {
    console.log(`· "${row.name}" is already active.`)
  } else {
    await prisma.restaurant.update({ where: { id: row.id }, data: { isActive: true } })
    console.log(`✓ "${row.name}" reactivated — it is servable again.`)
  }

  if (removeRejected(placeId)) {
    console.log('✓ Removed from rejected.json — discovery may propose it again.')
  }
  if (row.venueType === 'CAFE') {
    console.log(
      '⚠️  Its venueType is CAFE, so it stays parked and will NOT appear in results.\n' +
        `   Change that with: npm run setvenue -- --placeId ${placeId} --type RESTAURANT`,
    )
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (flag(args.restore)) return restore(args)
  if (typeof args.file === 'string') return prune(args)
  if (flag(args.list) || args.area !== undefined || args['max-rating'] !== undefined) {
    return list(args)
  }

  console.error(
    'Usage:\n' +
      '  npm run prune -- --list [--area "Dubai Marina"] [--max-rating 4.2]\n' +
      '  npm run prune -- --file server/imports/prune.json\n' +
      '  npm run prune -- --restore --placeId <id>',
  )
  process.exitCode = 1
}

main()
  .catch((err) => {
    console.error('\n✗ Prune failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
