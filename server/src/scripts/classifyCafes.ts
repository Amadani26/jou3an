/**
 * Venue classification — `npm run classify:cafes`
 *
 * Re-derives `venueType` from the Google taxonomy already stored on each row
 * (`googlePrimaryType` / `googleTypes`), lists every proposed change, and asks
 * for a y/N before writing anything.
 *
 * Costs NOTHING: it reads the stored types, never Places. If a row has no
 * taxonomy yet, fill it in first with `npm run sync:types`.
 *
 * Cafes are PARKED, not deleted — kept in the catalogue with their photos and
 * hours, invisible to every decision surface until a Cafes feature exists.
 *
 * ⚠️ Rows a human has corrected with `npm run setvenue` are SKIPPED, using the
 * memory in `imports/venue-overrides.json`. Google labels plenty of Dubai brunch
 * places `cafe`, and re-proposing the same correction every run is how a
 * curation tool becomes noise someone stops reading.
 *
 * Flags:
 *   --dry-run   list the changes and exit without asking
 *   --force     ignore the override memory and re-propose corrected rows
 */
import 'dotenv/config'
import prisma from '../lib/prisma'
import { displayArea } from '../lib/areaName'
import { cafeSignals, classifyVenue } from '../lib/venueType'
import { col, confirm, flag, parseArgs, readVenueOverrides } from '../lib/importFiles'

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dryRun = flag(args['dry-run'])
  const force = flag(args.force)

  const overrides = readVenueOverrides()
  const all = await prisma.restaurant.findMany({ orderBy: { name: 'asc' } })

  const noTaxonomy = all.filter((r) => !r.googlePrimaryType && !r.googleTypes.length)

  const changes: {
    id: string
    name: string
    area: string
    from: string
    to: string
    signals: string
  }[] = []
  const skipped: { name: string; to: string }[] = []

  for (const r of all) {
    if (!r.googlePrimaryType && !r.googleTypes.length) continue

    const verdict = classifyVenue(r.googlePrimaryType, r.googleTypes)
    if (verdict === r.venueType) continue

    const override = r.googlePlaceId ? overrides.types[r.googlePlaceId] : undefined
    if (override && !force) {
      skipped.push({ name: r.name, to: verdict })
      continue
    }

    changes.push({
      id: r.id,
      name: r.name,
      area: displayArea(r),
      from: r.venueType,
      to: verdict,
      signals:
        verdict === 'CAFE'
          ? cafeSignals(r.googlePrimaryType, r.googleTypes).join(', ')
          : r.googlePrimaryType ?? r.googleTypes[0] ?? '—',
    })
  }

  const cafeCount = all.filter((r) => r.venueType === 'CAFE').length
  console.log(
    `\n☕ Venue classification — ${all.length} row(s) in the catalogue, ` +
      `${cafeCount} currently CAFE`,
  )
  if (noTaxonomy.length) {
    console.log(
      `   ${noTaxonomy.length} row(s) have no stored Google types and were skipped — ` +
        'fetch them with `npm run sync:types`.',
    )
  }

  if (skipped.length) {
    console.log(`\n🔒 ${skipped.length} row(s) skipped — set by hand with setvenue:`)
    for (const s of skipped) console.log(`     · ${s.name} (Google says ${s.to})`)
    console.log('   Re-propose them with --force.')
  }

  if (!changes.length) {
    console.log('\n✓ Nothing to reclassify — every row already matches its Google taxonomy.\n')
    return
  }

  const WIDTH = 112
  console.log(`\n${'─'.repeat(WIDTH)}`)
  console.log(
    `${col('RESTAURANT', 34)}${col('AREA', 20)}${col('FROM', 12)}${col('TO', 12)}GOOGLE SIGNALS`,
  )
  console.log('─'.repeat(WIDTH))
  for (const c of changes) {
    console.log(
      `${col(c.name, 34)}${col(c.area, 20)}${col(c.from, 12)}${col(c.to, 12)}${c.signals}`,
    )
  }
  console.log('─'.repeat(WIDTH))

  const toCafe = changes.filter((c) => c.to === 'CAFE').length
  const toRestaurant = changes.length - toCafe
  console.log(
    `\n${changes.length} change(s): ${toCafe} → CAFE (parked, removed from all results)` +
      `${toRestaurant ? `, ${toRestaurant} → RESTAURANT (returned to results)` : ''}`,
  )

  if (dryRun) {
    console.log('\nDRY RUN — nothing was written.\n')
    return
  }

  if (!(await confirm('\nApply these changes?'))) {
    console.log('Aborted — nothing was changed.')
    return
  }

  // Grouped into two updateMany calls rather than one per row: the verdict is
  // only ever one of two values.
  let written = 0
  for (const to of ['CAFE', 'RESTAURANT'] as const) {
    const ids = changes.filter((c) => c.to === to).map((c) => c.id)
    if (!ids.length) continue
    const { count } = await prisma.restaurant.updateMany({
      where: { id: { in: ids } },
      data: { venueType: to },
    })
    written += count
  }

  console.log(`\n✓ ${written} row(s) reclassified`)
  console.log(
    'Wrong call on one of them? npm run setvenue -- --placeId <id> --type RESTAURANT\n',
  )
}

main()
  .catch((err) => {
    console.error('\n✗ Classification failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
