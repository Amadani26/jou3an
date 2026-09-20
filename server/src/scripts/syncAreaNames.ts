/**
 * Area-name backfill — `npm run sync:areas`
 *
 * Fills `Restaurant.areaName` with the real Dubai neighbourhood from Google's
 * address components ("Al Satwa", "Mirdif", "Motor City"), replacing what the
 * five-value `LocationArea` enum could never express.
 *
 * ADDRESS DATA ONLY. The field mask is `addressComponents,formattedAddress`,
 * which keeps the call on the cheap Places SKU and leaves photos, hours,
 * ratings and coordinates completely untouched — this is a backfill, not a
 * re-sync.
 *
 * Flags:
 *   --force   refresh rows that already have an areaName
 *   --only <id | name fragment>
 *   --dry-run resolve and print, write nothing
 */
import 'dotenv/config'
import prisma from '../lib/prisma'
import { PlacesConfigError, getPlaceAddress } from '../services/googlePlaces'
import { resolveAreaName } from '../lib/areaName'
import { col, parseArgs, sleep } from '../lib/importFiles'

/** Polite gap between calls. */
const DELAY_MS = 250

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const force = args.force === true || args.force === 'true'
  const dryRun = args['dry-run'] === true || args['dry-run'] === 'true'
  const only = typeof args.only === 'string' ? args.only.trim() : ''

  const restaurants = await prisma.restaurant.findMany({
    where: {
      // Without a place id there is nothing to look up.
      googlePlaceId: { not: null },
      ...(force ? {} : { areaName: null }),
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
        : 'Every Places-synced restaurant already has an areaName. (Use --force to refresh.)',
    )
    return
  }

  console.log(
    `\n🗺️  Resolving area names for ${restaurants.length} restaurant(s) — address fields only${
      dryRun ? ' (DRY RUN)' : ''
    }\n`,
  )

  const rows: { name: string; before: string; after: string; source: string }[] = []
  let apiCalls = 0
  let changed = 0
  let unresolved = 0

  for (const r of restaurants) {
    try {
      const details = await getPlaceAddress(r.googlePlaceId as string)
      apiCalls++

      const fromComponents = resolveAreaName(details.addressComponents, null)
      const areaName = fromComponents ?? resolveAreaName(null, details.formattedAddress)
      const source = fromComponents ? 'components' : areaName ? 'address' : '—'

      if (!areaName) {
        unresolved++
        rows.push({ name: r.name, before: r.areaName ?? '—', after: '—', source })
        console.log(`  ? ${r.name} — could not resolve an area from "${details.formattedAddress ?? ''}"`)
      } else {
        if (!dryRun && areaName !== r.areaName) {
          await prisma.restaurant.update({ where: { id: r.id }, data: { areaName } })
        }
        if (areaName !== r.areaName) changed++
        rows.push({ name: r.name, before: r.areaName ?? '—', after: areaName, source })
        console.log(`  ✓ ${r.name} → ${areaName}  (${source}, enum says ${r.area})`)
      }
    } catch (err) {
      if (err instanceof PlacesConfigError) throw err
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  ! ${r.name} — ${message}`)
      rows.push({ name: r.name, before: r.areaName ?? '—', after: 'error', source: '—' })
    }

    await sleep(DELAY_MS)
  }

  console.log('\n' + '─'.repeat(88))
  console.log(`${col('RESTAURANT', 26)}${col('WAS', 20)}${col('NOW', 26)}SOURCE`)
  console.log('─'.repeat(88))
  for (const row of rows) {
    console.log(`${col(row.name, 26)}${col(row.before, 20)}${col(row.after, 26)}${row.source}`)
  }
  console.log('─'.repeat(88))

  console.log(
    `\n${changed} updated · ${unresolved} unresolved · ${rows.length} examined${
      dryRun ? ' (nothing written)' : ''
    }`,
  )
  console.log(`📊 Places API calls: ${apiCalls} (address fields only)`)
  if (unresolved) {
    console.log(
      '\n⚠️  Unresolved rows keep their old areaName (or null) and fall back to the\n' +
        '   deprecated enum label in the app. Nothing breaks.',
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
      console.error('\n✗ Area sync failed:', err instanceof Error ? err.message : err)
    }
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
