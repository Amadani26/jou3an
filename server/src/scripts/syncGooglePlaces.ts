/**
 * Google Places sync — `npm run sync:places`
 *
 * For every restaurant in the DB: Text Search "{name} {area} Dubai" to resolve a
 * place id, then Place Details for photos / coordinates / rating. Stores up to
 * MAX_PHOTOS photo resource names (owner uploads first where detectable).
 *
 * A restaurant that already has a `googlePlaceId` is treated as PINNED: the
 * text search is skipped entirely and details are fetched for that id. This is
 * how we lock a specific branch when search picks the wrong one (e.g. Ravi
 * Satwa vs Ravi Al Nahda). Clear the column to let search decide again.
 *
 * Restaurants Google can't match are skipped, left untouched, and listed at the
 * end. The API key is read from the environment and never printed.
 */
import 'dotenv/config'
import prisma from '../lib/prisma'
import {
  getPlaceDetails,
  rankPhotos,
  searchPlace,
  PlacesConfigError,
} from '../services/googlePlaces'

const MAX_PHOTOS = 6

/** Areas are enum values (BUSINESS_BAY) — make them searchable ("Business Bay"). */
const areaLabel = (area: string) =>
  area === 'OTHER'
    ? ''
    : area
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ')

interface Row {
  name: string
  status: 'matched' | 'pinned' | 'no match' | 'error'
  photos: number
  rating: number | null
  coords: string
  note?: string
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({ orderBy: { name: 'asc' } })
  if (!restaurants.length) {
    console.log('No restaurants in the database — nothing to sync.')
    return
  }

  console.log(`🔎 Syncing ${restaurants.length} restaurants with Google Places…\n`)

  const rows: Row[] = []
  const unmatched: string[] = []

  for (const r of restaurants) {
    const query = [r.name, areaLabel(r.area), 'Dubai'].filter(Boolean).join(' ')

    try {
      // Pinned rows bypass search so a hand-picked branch is never overwritten.
      const pinned = Boolean(r.googlePlaceId)
      const match = pinned
        ? ({ id: r.googlePlaceId as string } as Awaited<ReturnType<typeof searchPlace>>)
        : await searchPlace(query)

      if (!match?.id) {
        console.log(`  ✗ ${r.name} — no match for "${query}"`)
        rows.push({ name: r.name, status: 'no match', photos: 0, rating: null, coords: '—' })
        unmatched.push(r.name)
        continue
      }

      const details = await getPlaceDetails(match.id)
      const placeName = details.displayName?.text ?? match.displayName?.text ?? r.name

      const photoRefs = rankPhotos(details.photos ?? [], placeName)
        .slice(0, MAX_PHOTOS)
        .map((p) => p.name)

      const location = details.location ?? match.location
      const rating = details.rating ?? match.rating ?? null

      await prisma.restaurant.update({
        where: { id: r.id },
        data: {
          googlePlaceId: match.id,
          photoRefs,
          lat: location?.latitude ?? null,
          lng: location?.longitude ?? null,
          googleRating: rating,
          googleSyncedAt: new Date(),
        },
      })

      const coords = location
        ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
        : '—'
      console.log(
        `  ${pinned ? '📌' : '✓'} ${r.name} → "${placeName}" · ${
          photoRefs.length
        } photo(s) · rating ${rating ?? '—'} · ${coords}`,
      )
      rows.push({
        name: r.name,
        status: pinned ? 'pinned' : 'matched',
        photos: photoRefs.length,
        rating,
        coords,
        // Only search results need a name sanity check — pins are deliberate.
        note: !pinned && placeName !== r.name ? `matched "${placeName}"` : undefined,
      })
    } catch (err) {
      if (err instanceof PlacesConfigError) throw err
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  ! ${r.name} — ${message}`)
      rows.push({ name: r.name, status: 'error', photos: 0, rating: null, coords: '—', note: message })
      unmatched.push(r.name)
    }
  }

  // ---- Summary table ----
  const w = (s: string, n: number) => s.padEnd(n).slice(0, n)
  console.log('\n' + '─'.repeat(78))
  console.log(
    `${w('RESTAURANT', 24)}${w('STATUS', 10)}${w('PHOTOS', 8)}${w('RATING', 8)}LAT, LNG`,
  )
  console.log('─'.repeat(78))
  for (const row of rows) {
    console.log(
      `${w(row.name, 24)}${w(row.status, 10)}${w(String(row.photos), 8)}${w(
        row.rating == null ? '—' : row.rating.toFixed(1),
        8,
      )}${row.coords}`,
    )
  }
  console.log('─'.repeat(78))

  const matched = rows.filter((r) => r.status === 'matched' || r.status === 'pinned').length
  const withPhotos = rows.filter((r) => r.photos > 0).length
  console.log(
    `\n${matched}/${rows.length} matched · ${withPhotos} with photos · ${unmatched.length} needing attention`,
  )
  if (unmatched.length) {
    console.log(`\n⚠️  Not synced: ${unmatched.join(', ')}`)
    console.log('   Adjust the name/area in the DB (or set googlePlaceId by hand) and re-run.')
  }

  const pinnedCount = rows.filter((r) => r.status === 'pinned').length
  if (pinnedCount) console.log(`📌 ${pinnedCount} pinned by googlePlaceId (search skipped)`)

  const renamed = rows.filter((r) => r.note && r.status === 'matched')
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
