/**
 * Restaurant discovery — `npm run discover -- --area "Dubai Marina" [--cuisine "Japanese"]`
 *
 * Text-searches Places for an area (optionally narrowed by cuisine), filters to
 * places worth a human's attention, and writes a candidates file for curation.
 *
 * It NEVER writes to the database. The output is a proposal; importing is a
 * separate, deliberate step after a person has deleted the rows they don't want.
 *
 * Flags:
 *   --area        (required) e.g. "Dubai Marina"
 *   --cuisine     (optional) e.g. "Japanese"
 *   --min-rating  default 3.8
 *   --min-reviews default 400
 *   --max-pages   default 3   (20 results per page)
 *   --out         override the output path
 */
import 'dotenv/config'
import path from 'node:path'
import prisma from '../lib/prisma'
import {
  discoverPlaces,
  PlacesConfigError,
  type DiscoveryPlace,
} from '../services/googlePlaces'
import {
  IMPORTS_DIR,
  col,
  ensureImportsDir,
  parseArgs,
  readRejected,
  sleep,
  writeJson,
  type Candidate,
} from '../lib/importFiles'
import { slugify } from '../lib/importMapping'

const DEFAULT_MIN_RATING = 3.8
const DEFAULT_MIN_REVIEWS = 400
const DEFAULT_MAX_PAGES = 3

/** Gap between page requests. Google is fine with faster; we are not in a hurry. */
const PAGE_DELAY_MS = 1200

/** Why a place did not make the cut — counted so the run explains itself. */
type DropReason = 'rating' | 'reviews' | 'status' | 'in-db' | 'rejected' | 'duplicate'

/** Google's price enum is far too long for a column; $ signs read instantly. */
function priceGlyph(level?: string | null): string {
  switch (level) {
    case 'PRICE_LEVEL_FREE':
      return 'free'
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$'
    case 'PRICE_LEVEL_MODERATE':
      return '$$'
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$'
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$'
    default:
      return '—'
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const area = typeof args.area === 'string' ? args.area.trim() : ''
  if (!area) {
    console.error('Usage: npm run discover -- --area "Dubai Marina" [--cuisine "Japanese"]')
    process.exitCode = 1
    return
  }

  const cuisine = typeof args.cuisine === 'string' ? args.cuisine.trim() : ''
  const minRating = Number(args['min-rating'] ?? DEFAULT_MIN_RATING)
  const minReviews = Number(args['min-reviews'] ?? DEFAULT_MIN_REVIEWS)
  const maxPages = Number(args['max-pages'] ?? DEFAULT_MAX_PAGES)

  if (!Number.isFinite(minRating) || !Number.isFinite(minReviews)) {
    console.error('--min-rating and --min-reviews must be numbers')
    process.exitCode = 1
    return
  }

  const query = cuisine
    ? `${cuisine} restaurants in ${area}, Dubai`
    : `restaurants in ${area}, Dubai`

  console.log(`\n🔎 Discovering: "${query}"`)
  console.log(
    `   filters: rating ≥ ${minRating} · reviews ≥ ${minReviews} · OPERATIONAL only · max ${maxPages} page(s)\n`,
  )

  // Everything already known, so discovery only ever proposes something new.
  const [existing, rejected] = await Promise.all([
    prisma.restaurant.findMany({
      where: { googlePlaceId: { not: null } },
      select: { googlePlaceId: true, name: true },
    }),
    Promise.resolve(readRejected()),
  ])
  const existingIds = new Map(
    existing.flatMap((r) => (r.googlePlaceId ? [[r.googlePlaceId, r.name] as const] : [])),
  )
  const rejectedIds = new Set(rejected.placeIds)

  let result
  try {
    result = await discoverPlaces(query, {
      maxPages,
      onPage: async (i, n) => {
        console.log(`   page ${i + 1}: ${n} result(s)`)
        await sleep(PAGE_DELAY_MS)
      },
    })
  } catch (err) {
    if (err instanceof PlacesConfigError) {
      console.error(`\n✗ ${err.message}`)
      process.exitCode = 1
      return
    }
    throw err
  }

  const drops: Record<DropReason, number> = {
    rating: 0,
    reviews: 0,
    status: 0,
    'in-db': 0,
    rejected: 0,
    duplicate: 0,
  }
  const skipped: { name: string; why: string }[] = []
  const seen = new Set<string>()
  const candidates: Candidate[] = []

  for (const p of result.places as DiscoveryPlace[]) {
    const name = p.displayName?.text?.trim() || '(unnamed)'

    if (!p.id || seen.has(p.id)) {
      drops.duplicate++
      continue
    }
    seen.add(p.id)

    if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') {
      drops.status++
      skipped.push({ name, why: p.businessStatus })
      continue
    }
    if (existingIds.has(p.id)) {
      drops['in-db']++
      skipped.push({ name, why: `already in DB as "${existingIds.get(p.id)}"` })
      continue
    }
    if (rejectedIds.has(p.id)) {
      drops.rejected++
      skipped.push({ name, why: 'previously rejected' })
      continue
    }
    // Missing signals are treated as failing, not passing: an unrated place is
    // exactly what the thresholds exist to keep out.
    if ((p.rating ?? 0) < minRating) {
      drops.rating++
      continue
    }
    if ((p.userRatingCount ?? 0) < minReviews) {
      drops.reviews++
      continue
    }

    candidates.push({
      name,
      placeId: p.id,
      rating: p.rating ?? null,
      ratingCount: p.userRatingCount ?? null,
      priceLevel: p.priceLevel ?? null,
      address: p.formattedAddress ?? null,
      primaryType: p.primaryType ?? null,
    })
  }

  candidates.sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))

  ensureImportsDir()
  const base = cuisine ? `${slugify(area)}-${slugify(cuisine)}` : slugify(area)
  const outPath =
    typeof args.out === 'string' ? args.out : path.join(IMPORTS_DIR, `${base}.candidates.json`)

  writeJson(outPath, {
    query,
    area,
    cuisine: cuisine || null,
    filters: { minRating, minReviews },
    generatedAt: new Date().toISOString(),
    candidates,
  })

  /* ---- Table ---- */
  const WIDTH = 118
  console.log(`\n${'─'.repeat(WIDTH)}`)
  console.log(
    `${col('RESTAURANT', 44)}${col('RATING', 8)}${col('REVIEWS', 9)}${col('AED', 7)}${col('TYPE', 20)}ADDRESS`,
  )
  console.log('─'.repeat(WIDTH))

  if (!candidates.length) {
    console.log('  (nothing cleared the filters)')
  }
  for (const c of candidates) {
    const type = (c.primaryType ?? '—').replace(/_restaurant$/, '')
    // The address is long; show the leading district-ish part rather than wrap.
    const areaBit = (c.address ?? '').split(' - ').slice(0, 2).join(' - ').slice(0, 30)
    console.log(
      `${col(c.name, 44)}${col(c.rating?.toFixed(1) ?? '—', 8)}${col(
        String(c.ratingCount ?? '—'),
        9,
      )}${col(priceGlyph(c.priceLevel), 7)}${col(type, 20)}${areaBit}`,
    )
  }
  console.log('─'.repeat(WIDTH))

  /* ---- Summary ---- */
  const totalDropped = Object.values(drops).reduce((a, b) => a + b, 0)
  console.log(
    `\n${candidates.length} candidate(s) from ${result.places.length} result(s) · ${totalDropped} filtered out`,
  )
  console.log(
    `   below rating: ${drops.rating} · below reviews: ${drops.reviews} · not operational: ${drops.status} · ` +
      `already in DB: ${drops['in-db']} · previously rejected: ${drops.rejected} · duplicates: ${drops.duplicate}`,
  )
  if (skipped.length) {
    console.log('\n   Known/closed places skipped:')
    for (const s of skipped.slice(0, 12)) console.log(`     · ${s.name} — ${s.why}`)
    if (skipped.length > 12) console.log(`     … and ${skipped.length - 12} more`)
  }
  if (result.truncated) {
    console.log(
      `\n⚠️  Google had more pages at the --max-pages limit (${maxPages}). Raise it to go deeper.`,
    )
  }

  console.log(`\n📊 Places API calls: ${result.apiCalls}`)
  console.log(`📝 Wrote ${path.relative(process.cwd(), outPath)}`)
  console.log(
    `\nNext: copy it to ${base}.approved.json, delete the rows you don't want, then\n` +
      `   npm run import -- --file server/imports/${base}.approved.json\n`,
  )
}

main()
  .catch((err) => {
    console.error('\n✗ Discovery failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
