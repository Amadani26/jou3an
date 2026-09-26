/**
 * Venue-taxonomy backfill — `npm run sync:types`
 *
 * Fills `googlePrimaryType`, `googleTypes` and `googleRatingCount` from Google.
 * Those three columns are what the catalogue-management tools read:
 *   · `npm run classify:cafes` classifies from the stored taxonomy
 *   · `npm run prune -- --list` prints the review count behind each rating
 * Neither makes a Places call of its own, so this is the one place that bill is
 * paid — and only for rows that are missing the data.
 *
 * ⚠️ It does NOT change `venueType`. Fetching data and deciding what a place is
 * are separate steps on purpose: classification is a judgement a human confirms
 * (`classify:cafes`) or overrides (`setvenue`), and a backfill silently
 * reclassifying 600 rows is exactly what that confirm exists to prevent.
 *
 * TAXONOMY + RATING FIELDS ONLY. Photos, hours, coordinates, area names and
 * `googleRating` are left untouched — this is a backfill, not a re-sync, and
 * the field mask stays off the expensive hours SKU.
 *
 * Flags:
 *   --force   refresh rows that already have a stored primaryType
 *   --only <id | name fragment>
 *   --dry-run fetch and print, write nothing
 */
import 'dotenv/config'
import prisma from '../lib/prisma'
import { PlacesConfigError, getPlaceTaxonomy } from '../services/googlePlaces'
import { classifyVenue } from '../lib/venueType'
import { col, flag, parseArgs, sleep } from '../lib/importFiles'

/** Polite gap between calls. */
const DELAY_MS = 250

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const force = flag(args.force)
  const dryRun = flag(args['dry-run'])
  const only = typeof args.only === 'string' ? args.only.trim() : ''

  const restaurants = await prisma.restaurant.findMany({
    where: {
      // Without a place id there is nothing to look up.
      googlePlaceId: { not: null },
      ...(force ? {} : { googlePrimaryType: null }),
      ...(only
        ? { OR: [{ id: only }, { name: { contains: only, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: { name: 'asc' },
  })

  if (!restaurants.length) {
    console.log(
      force
        ? 'No restaurants with a googlePlaceId to refresh.'
        : 'Every Places-synced restaurant already has a stored primaryType. (Use --force to refresh.)',
    )
    return
  }

  console.log(
    `\n🏷️  Fetching Google taxonomy for ${restaurants.length} restaurant(s)` +
      ` — types + review count only${dryRun ? ' (DRY RUN)' : ''}\n`,
  )

  const rows: { name: string; primaryType: string; reviews: string; would: string }[] = []
  let apiCalls = 0
  let updated = 0
  let blank = 0
  let wouldPark = 0

  for (const r of restaurants) {
    try {
      const details = await getPlaceTaxonomy(r.googlePlaceId as string)
      apiCalls++

      const primaryType = details.primaryType ?? null
      const types = details.types ?? []
      const ratingCount = details.userRatingCount ?? null

      if (!primaryType && !types.length && ratingCount === null) {
        blank++
        rows.push({ name: r.name, primaryType: '—', reviews: '—', would: '—' })
        console.log(`  ? ${r.name} — Google returned no taxonomy or review count`)
      } else {
        if (!dryRun) {
          await prisma.restaurant.update({
            where: { id: r.id },
            data: {
              // Never overwrite something we have with nothing: a transient gap
              // in Google's payload must not wipe a stored label.
              ...(primaryType ? { googlePrimaryType: primaryType } : {}),
              ...(types.length ? { googleTypes: types } : {}),
              ...(ratingCount !== null ? { googleRatingCount: ratingCount } : {}),
            },
          })
        }
        updated++

        // Reported, not applied — `classify:cafes` is what actually decides.
        const verdict = classifyVenue(primaryType, types)
        const would = verdict === r.venueType ? '—' : `${r.venueType} → ${verdict}`
        if (verdict === 'CAFE' && r.venueType !== 'CAFE') wouldPark++

        rows.push({
          name: r.name,
          primaryType: primaryType ?? '—',
          reviews: ratingCount === null ? '—' : String(ratingCount),
          would,
        })
        console.log(
          `  ✓ ${r.name} → ${primaryType ?? '(no primary type)'}` +
            `${ratingCount === null ? '' : ` · ${ratingCount} reviews`}${
              would === '—' ? '' : `  [${would}]`
            }`,
        )
      }
    } catch (err) {
      if (err instanceof PlacesConfigError) throw err
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  ! ${r.name} — ${message}`)
      rows.push({ name: r.name, primaryType: 'error', reviews: '—', would: '—' })
    }

    await sleep(DELAY_MS)
  }

  console.log('\n' + '─'.repeat(96))
  console.log(`${col('RESTAURANT', 34)}${col('PRIMARY TYPE', 28)}${col('REVIEWS', 10)}WOULD RECLASSIFY`)
  console.log('─'.repeat(96))
  for (const row of rows) {
    console.log(
      `${col(row.name, 34)}${col(row.primaryType, 28)}${col(row.reviews, 10)}${row.would}`,
    )
  }
  console.log('─'.repeat(96))

  console.log(
    `\n${updated} row(s) ${dryRun ? 'would be updated' : 'updated'} · ${blank} with no data · ` +
      `${rows.length} examined`,
  )
  console.log(`📊 Places API calls: ${apiCalls} (taxonomy + review count only)`)
  if (wouldPark) {
    console.log(
      `\n☕ ${wouldPark} row(s) look like cafes. Nothing was reclassified — review and apply with:\n` +
        '   npm run classify:cafes',
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
      console.error('\n✗ Taxonomy sync failed:', err instanceof Error ? err.message : err)
    }
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
