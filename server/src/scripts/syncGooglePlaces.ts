/**
 * Google Places sync — `npm run sync:places`
 *
 * For every restaurant in the DB: Text Search "{name} {area} Dubai" to resolve a
 * place id, then Place Details for photos / coordinates / rating / hours.
 *
 * A restaurant that already has a `googlePlaceId` is treated as PINNED: the
 * text search is skipped entirely and details are fetched for that id. This is
 * how we lock a specific branch when search picks the wrong one (e.g. Ravi
 * Satwa vs Ravi Al Nahda). Clear the column to let search decide again.
 *
 * The per-row work lives in `services/placesSync.ts` so the import pipeline can
 * run exactly the same enrichment on just the rows it creates.
 *
 * Restaurants Google can't match are skipped, left untouched, and listed at the
 * end. The API key is read from the environment and never printed.
 *
 * Flags:
 *   --only <id | name fragment>   sync a single restaurant
 */
import 'dotenv/config'
import prisma from '../lib/prisma'
import { PlacesConfigError } from '../services/googlePlaces'
import { syncRestaurantPlaces } from '../services/placesSync'
import { col, parseArgs, sleep } from '../lib/importFiles'

/** Polite gap between restaurants. */
const DELAY_MS = 300

interface Row {
  name: string
  status: 'matched' | 'pinned' | 'no match' | 'error'
  photos: number
  rating: number | null
  coords: string
  /** Number of opening periods stored, or null when Google had none. */
  hours: number | null
  note?: string
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const only = typeof args.only === 'string' ? args.only.trim() : ''

  const restaurants = await prisma.restaurant.findMany({
    where: only
      ? { OR: [{ id: only }, { name: { contains: only, mode: 'insensitive' } }] }
      : undefined,
    orderBy: { name: 'asc' },
  })

  if (!restaurants.length) {
    console.log(
      only
        ? `No restaurant matched "${only}".`
        : 'No restaurants in the database — nothing to sync.',
    )
    return
  }

  console.log(`🔎 Syncing ${restaurants.length} restaurant(s) with Google Places…\n`)

  const rows: Row[] = []
  const unmatched: string[] = []
  let apiCalls = 0

  for (const r of restaurants) {
    try {
      const outcome = await syncRestaurantPlaces(r)
      apiCalls += outcome.apiCalls

      if (outcome.status === 'no match') {
        console.log(`  ✗ ${r.name} — no match`)
        rows.push({
          name: r.name,
          status: 'no match',
          photos: 0,
          rating: null,
          coords: '—',
          hours: null,
        })
        unmatched.push(r.name)
        continue
      }

      console.log(
        `  ${outcome.status === 'pinned' ? '📌' : '✓'} ${r.name} → "${outcome.placeName}" · ${
          outcome.photos
        } photo(s) · rating ${outcome.rating ?? '—'} · ${
          outcome.hours ? `${outcome.hours} period(s)` : 'no hours'
        } · ${outcome.coords}`,
      )

      rows.push({
        name: r.name,
        status: outcome.status,
        photos: outcome.photos,
        rating: outcome.rating,
        coords: outcome.coords,
        hours: outcome.hours,
        // Only search results need a name sanity check — pins are deliberate.
        note:
          outcome.status === 'matched' && outcome.placeName !== r.name
            ? `matched "${outcome.placeName}"`
            : undefined,
      })
    } catch (err) {
      if (err instanceof PlacesConfigError) throw err
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  ! ${r.name} — ${message}`)
      rows.push({
        name: r.name,
        status: 'error',
        photos: 0,
        rating: null,
        coords: '—',
        hours: null,
        note: message,
      })
      unmatched.push(r.name)
    }

    await sleep(DELAY_MS)
  }

  // ---- Summary table ----
  console.log('\n' + '─'.repeat(86))
  console.log(
    `${col('RESTAURANT', 24)}${col('STATUS', 10)}${col('PHOTOS', 8)}${col('RATING', 8)}${col('HOURS', 8)}LAT, LNG`,
  )
  console.log('─'.repeat(86))
  for (const row of rows) {
    console.log(
      `${col(row.name, 24)}${col(row.status, 10)}${col(String(row.photos), 8)}${col(
        row.rating == null ? '—' : row.rating.toFixed(1),
        8,
      )}${col(row.hours == null ? '—' : String(row.hours), 8)}${row.coords}`,
    )
  }
  console.log('─'.repeat(86))

  const matched = rows.filter((r) => r.status === 'matched' || r.status === 'pinned').length
  const withPhotos = rows.filter((r) => r.photos > 0).length
  const withHours = rows.filter((r) => (r.hours ?? 0) > 0).length
  console.log(
    `\n${matched}/${rows.length} matched · ${withPhotos} with photos · ${withHours} with hours · ${unmatched.length} needing attention`,
  )
  console.log(`📊 Places API calls: ${apiCalls}`)

  const pinnedCount = rows.filter((r) => r.status === 'pinned').length
  if (pinnedCount) console.log(`📌 ${pinnedCount} pinned by googlePlaceId (search skipped)`)

  if (unmatched.length) {
    console.log(`\n⚠️  Not synced: ${unmatched.join(', ')}`)
    console.log('   Adjust the name/area in the DB (or set googlePlaceId by hand) and re-run.')
  }

  const renamed = rows.filter((r) => r.note?.startsWith('matched "'))
  if (renamed.length) {
    console.log('\nℹ️  Matched under a different Google name — worth a sanity check:')
    for (const r of renamed) console.log(`   ${r.name}: ${r.note}`)
  }
}

main()
  .catch((err) => {
    if (err instanceof PlacesConfigError) {
      console.error(`\n✗ ${err.message}`)
      console.error('  Add GOOGLE_PLACES_API_KEY to server/.env and re-run.')
    } else {
      console.error('\n✗ Sync failed:', err instanceof Error ? err.message : err)
    }
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
