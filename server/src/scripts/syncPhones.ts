/**
 * Phone-number backfill — `npm run sync:phones`
 *
 * Fills `Restaurant.phoneNumber` with Google's `internationalPhoneNumber`
 * ("+971 4 331 5353") so the app's Call button can actually dial. Before this,
 * only the 10 hand-seeded rows had a number and Call fell through to Maps.
 *
 * ⚠️ NARROW FIELD MASK, BUT NOT A CHEAP CALL. `internationalPhoneNumber` sits
 * on the Places "Advanced" SKU — the same band as `regularOpeningHours`, and a
 * tier above the address-only `sync:areas`. Narrowing the mask avoids paying
 * AGAIN for photos, coordinates and hours we already store; it does not move
 * the request to a cheaper band. The estimate prints before the first call.
 *
 * ⚠️ Never writes null over a number we already have — same rule as `areaName`
 * and `description`. A place that drops off Google's listing for one request
 * must not lose the number the app is using.
 *
 * Flags:
 *   --force    re-fetch rows that already have a phoneNumber
 *   --only <id | name fragment>
 *   --limit <n>   cap the number of rows (and therefore the bill)
 *   --dry-run  fetch and print, write nothing (⚠️ the calls are STILL billed)
 */
import 'dotenv/config'
import prisma from '../lib/prisma'
import {
  PlacesConfigError,
  extractPhoneNumber,
  getPlacePhone,
} from '../services/googlePlaces'
import { col, parseArgs, sleep } from '../lib/importFiles'

/** Polite gap between calls. */
const DELAY_MS = 250

/**
 * Rough per-call price of the Places "Advanced" Place Details SKU, in USD.
 * Only used for the up-front estimate — Google's published rate, not a bill.
 */
const USD_PER_CALL = 0.017

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const force = args.force === true || args.force === 'true'
  const dryRun = args['dry-run'] === true || args['dry-run'] === 'true'
  const only = typeof args.only === 'string' ? args.only.trim() : ''
  const limitRaw = Number(args.limit)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : undefined

  const restaurants = await prisma.restaurant.findMany({
    where: {
      // Without a place id there is nothing to look up.
      googlePlaceId: { not: null },
      ...(force ? {} : { phoneNumber: null }),
      ...(only
        ? { OR: [{ id: only }, { name: { contains: only, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: { name: 'asc' },
    ...(limit ? { take: limit } : {}),
  })

  // Coverage BEFORE, so the closing report can state what this run actually
  // moved rather than just what it wrote.
  const totalWithPlaceId = await prisma.restaurant.count({
    where: { googlePlaceId: { not: null } },
  })
  const hadPhoneBefore = await prisma.restaurant.count({
    where: { googlePlaceId: { not: null }, phoneNumber: { not: null } },
  })

  if (!restaurants.length) {
    console.log(
      force
        ? 'No restaurants with a googlePlaceId to refresh.'
        : 'Every Places-synced restaurant already has a phone number. (Use --force to refresh.)',
    )
    return
  }

  console.log(
    `\n📞 Fetching phone numbers for ${restaurants.length} restaurant(s)${
      dryRun ? ' (DRY RUN — writes nothing, but the calls are still billed)' : ''
    }`,
  )
  console.log(
    `   Estimated cost: ~$${(restaurants.length * USD_PER_CALL).toFixed(2)} ` +
      `(${restaurants.length} × Places Advanced @ ~$${USD_PER_CALL.toFixed(3)})\n`,
  )

  const rows: { name: string; before: string; after: string }[] = []
  let apiCalls = 0
  let changed = 0
  let missing = 0

  for (const r of restaurants) {
    try {
      const details = await getPlacePhone(r.googlePlaceId as string)
      apiCalls++

      const phoneNumber = extractPhoneNumber(details)

      if (!phoneNumber) {
        // Google lists no number. Leave whatever is stored alone.
        missing++
        rows.push({ name: r.name, before: r.phoneNumber ?? '—', after: '—' })
        console.log(`  ? ${r.name} — Google lists no number`)
      } else {
        if (!dryRun && phoneNumber !== r.phoneNumber) {
          await prisma.restaurant.update({
            where: { id: r.id },
            data: { phoneNumber },
          })
        }
        if (phoneNumber !== r.phoneNumber) changed++
        rows.push({ name: r.name, before: r.phoneNumber ?? '—', after: phoneNumber })
        console.log(`  ✓ ${r.name} → ${phoneNumber}`)
      }
    } catch (err) {
      if (err instanceof PlacesConfigError) throw err
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  ! ${r.name} — ${message}`)
      rows.push({ name: r.name, before: r.phoneNumber ?? '—', after: 'error' })
    }

    await sleep(DELAY_MS)
  }

  console.log('\n' + '─'.repeat(78))
  console.log(`${col('RESTAURANT', 34)}${col('WAS', 20)}NOW`)
  console.log('─'.repeat(78))
  for (const row of rows) {
    console.log(`${col(row.name, 34)}${col(row.before, 20)}${row.after}`)
  }
  console.log('─'.repeat(78))

  const hasPhoneNow = await prisma.restaurant.count({
    where: { googlePlaceId: { not: null }, phoneNumber: { not: null } },
  })
  const pct = (n: number) =>
    totalWithPlaceId ? ((n / totalWithPlaceId) * 100).toFixed(1) : '0.0'

  console.log(
    `\n${changed} updated · ${missing} with no number on Google · ${rows.length} examined${
      dryRun ? ' (nothing written)' : ''
    }`,
  )
  console.log(
    `📊 COVERAGE: ${hasPhoneNow}/${totalWithPlaceId} Places-synced rows have a number ` +
      `(${pct(hasPhoneNow)}%) — was ${hadPhoneBefore} (${pct(hadPhoneBefore)}%)`,
  )
  console.log(`📞 Places API calls: ${apiCalls} (phone field only, Advanced SKU)`)
  if (missing) {
    console.log(
      '\n⚠️  Rows with no number keep whatever they had (usually null). The app\n' +
        '   HIDES the Call button for those — it never shows one that cannot ring.',
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
      console.error('\n✗ Phone sync failed:', err instanceof Error ? err.message : err)
    }
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
