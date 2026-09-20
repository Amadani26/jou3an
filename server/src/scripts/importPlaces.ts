/**
 * Restaurant import — `npm run import -- --file server/imports/<area>.approved.json`
 *
 * Creates a Restaurant per approved row, pinned to its Google place id, then
 * runs the normal Places sync (photos / rating / coords / hours) on just those
 * new rows.
 *
 * IDEMPOTENT: a place id already in the database is skipped, so re-running the
 * same approved file is safe and costs nothing extra.
 *
 * REJECTION MEMORY: afterwards the matching candidates file is diffed against
 * the approved one, and everything the curator deleted is appended to
 * `imports/rejected.json` so future discovery runs stop proposing it.
 *
 * Flags:
 *   --file       (required) the approved file
 *   --candidates override the candidates file used for the rejection diff
 *   --dry-run    report what would happen, write nothing
 *   --no-sync    create rows but skip the Places enrichment
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import prisma from '../lib/prisma'
import { PlacesConfigError } from '../services/googlePlaces'
import { syncRestaurantPlaces } from '../services/placesSync'
import {
  IMPORTS_DIR,
  addRejected,
  col,
  parseArgs,
  readCandidates,
  sleep,
  type Candidate,
} from '../lib/importFiles'
import {
  NEUTRAL_RATING_SCORE,
  areaFromPlace,
  cuisineFromTypes,
  priceRangeFor,
} from '../lib/importMapping'
import { areaNameFromFormattedAddress } from '../lib/areaName'

/** Gap between Places calls during enrichment. */
const SYNC_DELAY_MS = 400

type RowStatus = 'created' | 'skipped (exists)' | 'error'

interface ResultRow {
  name: string
  status: RowStatus
  cuisine: string
  /** Real neighbourhood once known, else the coarse enum. */
  area: string
  price: string
  photos: number
  hours: number | null
  note?: string
}

/**
 * Finds the candidates file that produced an approved file, so the rejection
 * diff works without the curator having to name it.
 *
 * "marina.approved.json" -> "marina.candidates.json", and failing that any
 * "marina-*.candidates.json" (the cuisine-scoped form).
 */
function findCandidatesFile(approvedPath: string): string | null {
  const dir = path.dirname(approvedPath)
  const base = path.basename(approvedPath).replace(/\.approved\.json$/i, '')

  const exact = path.join(dir, `${base}.candidates.json`)
  if (fs.existsSync(exact)) return exact

  if (!fs.existsSync(dir)) return null
  const prefixed = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${base}-`) && f.endsWith('.candidates.json'))
    .sort()
  return prefixed.length ? path.join(dir, prefixed[0]) : null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const fileArg = typeof args.file === 'string' ? args.file : ''
  if (!fileArg) {
    console.error('Usage: npm run import -- --file server/imports/<area>.approved.json')
    process.exitCode = 1
    return
  }

  const dryRun = args['dry-run'] === true || args['dry-run'] === 'true'
  const noSync = args['no-sync'] === true || args['no-sync'] === 'true'

  // Accept a repo-root-relative path (as the docs show) or a plain one.
  const approvedPath = path.isAbsolute(fileArg)
    ? fileArg
    : [path.resolve(process.cwd(), fileArg), path.resolve(process.cwd(), '..', fileArg)].find(
        (p) => fs.existsSync(p),
      ) ?? path.resolve(process.cwd(), fileArg)

  if (!fs.existsSync(approvedPath)) {
    console.error(`✗ No such file: ${approvedPath}`)
    process.exitCode = 1
    return
  }

  const approved = readCandidates(approvedPath)
  if (!approved.length) {
    console.log('Approved file has no usable rows (each needs a placeId). Nothing to do.')
    return
  }

  console.log(`\n📥 Importing ${approved.length} approved row(s) from ${path.basename(approvedPath)}`)
  if (dryRun) console.log('   DRY RUN — nothing will be written\n')

  // Idempotency: one query up front rather than a lookup per row.
  const known = await prisma.restaurant.findMany({
    where: { googlePlaceId: { in: approved.map((c) => c.placeId) } },
    select: { googlePlaceId: true, name: true },
  })
  const knownIds = new Map(
    known.flatMap((r) => (r.googlePlaceId ? [[r.googlePlaceId, r.name] as const] : [])),
  )

  const rows: ResultRow[] = []
  const createdIds: string[] = []
  let apiCalls = 0

  for (const c of approved) {
    const cuisine = cuisineFromTypes(c.primaryType)
    const area = areaFromPlace(c.address, null)
    // Best guess from the candidates file; the Places sync below replaces it
    // with the structured address components, which are more reliable.
    const areaNameGuess = areaNameFromFormattedAddress(c.address)
    const price = priceRangeFor(c.priceLevel)
    const priceLabel = `${price.min}–${price.max}`

    if (knownIds.has(c.placeId)) {
      rows.push({
        name: c.name,
        status: 'skipped (exists)',
        cuisine,
        area,
        price: priceLabel,
        photos: 0,
        hours: null,
        note: `already "${knownIds.get(c.placeId)}"`,
      })
      continue
    }

    if (dryRun) {
      rows.push({
        name: c.name,
        status: 'created',
        cuisine,
        area,
        price: priceLabel,
        photos: 0,
        hours: null,
        note: 'dry run',
      })
      continue
    }

    try {
      const created = await prisma.restaurant.create({
        data: {
          name: c.name,
          cuisineType: cuisine,
          area,
          priceMin: price.min,
          priceMax: price.max,
          // Pinned from the start: the id is exactly what discovery matched,
          // so Text Search must never get a chance to second-guess it.
          googlePlaceId: c.placeId,
          isActive: true,
          tags: [],
          ...(areaNameGuess ? { areaName: areaNameGuess } : {}),
          // Neutral — our editorial score is not Google's, and the engine
          // already reads quality from googleRating.
          ratingScore: NEUTRAL_RATING_SCORE,
        },
      })
      createdIds.push(created.id)

      let photos = 0
      let hours: number | null = null
      let note: string | undefined

      let resolvedArea: string = areaNameGuess ?? area

      if (!noSync) {
        const outcome = await syncRestaurantPlaces(created)
        apiCalls += outcome.apiCalls
        photos = outcome.photos
        hours = outcome.hours
        if (outcome.areaName) resolvedArea = outcome.areaName
        // The area guess came from the address; now that the sync has real
        // coordinates, let them refine an OTHER into a real district.
        if (area === 'OTHER') {
          const withCoords = await prisma.restaurant.findUnique({ where: { id: created.id } })
          if (withCoords?.lat != null && withCoords?.lng != null) {
            const refined = areaFromPlace(c.address, {
              lat: withCoords.lat,
              lng: withCoords.lng,
            })
            if (refined !== 'OTHER') {
              await prisma.restaurant.update({
                where: { id: created.id },
                data: { area: refined },
              })
              note = `area refined to ${refined} from coords`
            }
          }
        }
        await sleep(SYNC_DELAY_MS)
      }

      rows.push({
        name: c.name,
        status: 'created',
        cuisine,
        area: resolvedArea,
        price: priceLabel,
        photos,
        hours,
        note,
      })
    } catch (err) {
      if (err instanceof PlacesConfigError) throw err
      const message = err instanceof Error ? err.message : String(err)
      rows.push({
        name: c.name,
        status: 'error',
        cuisine,
        area,
        price: priceLabel,
        photos: 0,
        hours: null,
        note: message.slice(0, 60),
      })
    }
  }

  /* ---- Table ---- */
  console.log(`\n${'─'.repeat(104)}`)
  console.log(
    `${col('RESTAURANT', 30)}${col('STATUS', 18)}${col('CUISINE', 18)}${col('AREA', 14)}${col('AED', 10)}${col('PHOTOS', 8)}HOURS`,
  )
  console.log('─'.repeat(104))
  for (const r of rows) {
    console.log(
      `${col(r.name, 30)}${col(r.status, 18)}${col(r.cuisine, 18)}${col(r.area, 14)}${col(
        r.price,
        10,
      )}${col(String(r.photos), 8)}${r.hours ?? '—'}`,
    )
    if (r.note) console.log(`${' '.repeat(30)}↳ ${r.note}`)
  }
  console.log('─'.repeat(104))

  const created = rows.filter((r) => r.status === 'created').length
  const skipped = rows.filter((r) => r.status === 'skipped (exists)').length
  const errored = rows.filter((r) => r.status === 'error').length
  console.log(`\n${created} created · ${skipped} skipped · ${errored} error(s)`)
  if (apiCalls) console.log(`📊 Places API calls: ${apiCalls}`)

  /* ---- Rejection memory ---- */
  const candidatesPath =
    typeof args.candidates === 'string'
      ? path.resolve(process.cwd(), args.candidates)
      : findCandidatesFile(approvedPath)

  if (!candidatesPath || !fs.existsSync(candidatesPath)) {
    console.log(
      '\n⚠️  No matching candidates file found — skipping the rejection diff.\n' +
        `   Pass --candidates <path> to record what was dropped. (Looked next to ${path.basename(approvedPath)}.)`,
    )
  } else if (dryRun) {
    console.log(`\n(dry run) would diff against ${path.basename(candidatesPath)}`)
  } else {
    const all: Candidate[] = readCandidates(candidatesPath)
    const approvedIds = new Set(approved.map((c) => c.placeId))
    const dropped = all.filter((c) => !approvedIds.has(c.placeId))

    if (!dropped.length) {
      console.log('\n✓ Nothing was dropped during curation — rejected list unchanged.')
    } else {
      const notes = Object.fromEntries(
        dropped.map((c) => [c.placeId, `${c.name} — dropped curating ${path.basename(approvedPath)}`]),
      )
      const added = addRejected(
        dropped.map((c) => c.placeId),
        notes,
      )
      console.log(
        `\n🚫 ${dropped.length} candidate(s) dropped during curation · ${added} newly added to rejected.json`,
      )
      for (const c of dropped.slice(0, 10)) console.log(`     · ${c.name}`)
      if (dropped.length > 10) console.log(`     … and ${dropped.length - 10} more`)
      console.log('   Undo one with: npm run unreject -- --placeId <id>')
    }
  }

  if (createdIds.length && noSync) {
    console.log('\n⚠️  --no-sync: the new rows have no photos, rating, coords or hours yet.')
    console.log('   Run `npm run sync:places` to enrich them.')
  }
  console.log()
}

main()
  .catch((err) => {
    console.error('\n✗ Import failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

export { findCandidatesFile, IMPORTS_DIR }
