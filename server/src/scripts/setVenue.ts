/**
 * Manual venue correction — `npm run setvenue -- --placeId <id> --type CAFE|RESTAURANT`
 *
 * Google's taxonomy is wrong often enough to need an override: Dubai brunch
 * spots and all-day diners are routinely typed `cafe`, and a few genuine coffee
 * shops are typed `restaurant`.
 *
 * The change is also recorded in `imports/venue-overrides.json` so
 * `npm run classify:cafes` stops proposing it back. Bulk classification should
 * never overrule a human who has looked at the place.
 *
 * `--list` prints every override recorded so far.
 */
import 'dotenv/config'
import path from 'node:path'
import prisma from '../lib/prisma'
import { displayArea } from '../lib/areaName'
import {
  VENUE_OVERRIDES_PATH,
  flag,
  parseArgs,
  readVenueOverrides,
  setVenueOverride,
} from '../lib/importFiles'

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (flag(args.list)) {
    const overrides = readVenueOverrides()
    const entries = Object.entries(overrides.types)
    if (!entries.length) {
      console.log(`No overrides recorded in ${path.basename(VENUE_OVERRIDES_PATH)}.`)
      return
    }
    console.log(`\n${entries.length} hand-set venue type(s):\n`)
    for (const [placeId, type] of entries) {
      const note = overrides.notes?.[placeId]
      console.log(`  ${type.padEnd(11)}${placeId}${note ? `  — ${note}` : ''}`)
    }
    console.log()
    return
  }

  const placeId = typeof args.placeId === 'string' ? args.placeId.trim() : ''
  const typeArg = typeof args.type === 'string' ? args.type.trim().toUpperCase() : ''

  if (!placeId || (typeArg !== 'CAFE' && typeArg !== 'RESTAURANT')) {
    console.error(
      'Usage: npm run setvenue -- --placeId <id> --type CAFE|RESTAURANT   (or --list)',
    )
    process.exitCode = 1
    return
  }
  const type = typeArg as 'CAFE' | 'RESTAURANT'

  const row = await prisma.restaurant.findUnique({ where: { googlePlaceId: placeId } })
  if (!row) {
    console.error(`✗ No restaurant has googlePlaceId ${placeId}.`)
    process.exitCode = 1
    return
  }

  if (row.venueType === type) {
    console.log(`· "${row.name}" is already ${type}.`)
  } else {
    await prisma.restaurant.update({ where: { id: row.id }, data: { venueType: type } })
    console.log(
      `✓ "${row.name}" (${displayArea(row)}) ${row.venueType} → ${type}\n` +
        (type === 'CAFE'
          ? '  Parked: removed from the engine, Food Tinder, /nearby and the Daily Top 3.'
          : '  Servable again: it can now appear in results.'),
    )
  }

  // Recorded either way, so re-running the tool is idempotent and the override
  // survives even when the row already had the right value.
  setVenueOverride(placeId, type, `${row.name} — set by hand`)
  console.log(
    `📝 Recorded in ${path.basename(VENUE_OVERRIDES_PATH)} — classify:cafes will leave it alone.`,
  )

  if (type === 'RESTAURANT' && !row.isActive) {
    console.log(
      '\n⚠️  This row is also INACTIVE, so it still will not appear in results.\n' +
        `   Reactivate it with: npm run prune -- --restore --placeId ${placeId}`,
    )
  }
}

main()
  .catch((err) => {
    console.error('\n✗ setvenue failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
