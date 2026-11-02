/**
 * Photo-name refresh — `npm run sync:photorefs`
 *
 * Replaces every stored `photoRefs` entry with the CURRENT photo resource
 * names from Google. Places photo names EXPIRE — the Sep 2026 batch started
 * answering 400 "The photo resource in the request is invalid" — so stored
 * refs are a short-lived cache, this script is the bulk refresh, and the
 * proxy's self-heal (services/photoHeal.ts) is the per-request repair
 * between runs.
 *
 * 💰 FREE: the field mask is exactly `id,photos`, which keeps the request on
 * the Place Details "Essentials (IDs Only)" SKU — $0.00, unlimited cap
 * (verified against Google's pricing + field-mask docs, 2026-11-02). Do NOT
 * widen the mask: one Pro field (even `displayName`) bills the whole call at
 * $17/1k.
 *
 * ⚠️ Never writes an empty list over refs we hold — same rule as `areaName`,
 * `description` and `phoneNumber`. A place whose photos Google momentarily
 * drops keeps its (stale) refs and the proxy's placeholder covers the gap.
 *
 * Flags:
 *   --only <id | name fragment>
 *   --limit <n>
 *   --dry-run  fetch and report, write nothing (the calls are free anyway)
 */
import 'dotenv/config'
import prisma from '../lib/prisma'
import { PlacesConfigError, getPlacePhotos, rankPhotos } from '../services/googlePlaces'
import { MAX_PHOTOS } from '../services/placesSync'
import { parseArgs, sleep } from '../lib/importFiles'

/** Polite gap between calls — the SKU is free but the quota is not infinite. */
const DELAY_MS = 150

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dryRun = args['dry-run'] === true || args['dry-run'] === 'true'
  const only = typeof args.only === 'string' ? args.only.trim() : ''
  const limitRaw = Number(args.limit)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : undefined

  const restaurants = await prisma.restaurant.findMany({
    where: {
      // Without a place id there is nothing to look up.
      googlePlaceId: { not: null },
      ...(only
        ? { OR: [{ id: only }, { name: { contains: only, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: { name: 'asc' },
    ...(limit ? { take: limit } : {}),
    select: { id: true, name: true, googlePlaceId: true, photoRefs: true },
  })

  if (!restaurants.length) {
    console.log('No Places-synced restaurants matched.')
    return
  }

  console.log(
    `\n📸 Refreshing photo names for ${restaurants.length} restaurant(s)${
      dryRun ? ' (DRY RUN — writes nothing)' : ''
    }`,
  )
  console.log(
    '   Estimated cost: $0.00 — field mask `id,photos` stays on the Place\n' +
      '   Details "Essentials (IDs Only)" SKU (free, unlimited cap).\n',
  )

  let apiCalls = 0
  let refreshed = 0
  let unchanged = 0
  let emptyOnGoogle = 0
  let errors = 0

  for (const r of restaurants) {
    try {
      const details = await getPlacePhotos(r.googlePlaceId as string)
      apiCalls++

      const freshRefs = rankPhotos(details.photos ?? [], r.name)
        .slice(0, MAX_PHOTOS)
        .map((p) => p.name)

      if (!freshRefs.length) {
        emptyOnGoogle++
        console.log(`  ? ${r.name} — Google lists no photos (stored refs kept)`)
      } else if (
        freshRefs.length === r.photoRefs.length &&
        freshRefs.every((ref, i) => ref === r.photoRefs[i])
      ) {
        unchanged++
      } else {
        if (!dryRun) {
          await prisma.restaurant.update({
            where: { id: r.id },
            data: { photoRefs: freshRefs },
          })
        }
        refreshed++
        console.log(`  ✓ ${r.name} → ${freshRefs.length} photo(s)`)
      }
    } catch (err) {
      if (err instanceof PlacesConfigError) throw err
      errors++
      console.log(`  ! ${r.name} — ${err instanceof Error ? err.message : err}`)
    }

    await sleep(DELAY_MS)
  }

  console.log(
    `\n${refreshed} refreshed · ${unchanged} already current · ${emptyOnGoogle} with no photos on Google · ` +
      `${errors} error(s) · ${restaurants.length} examined${dryRun ? ' (nothing written)' : ''}`,
  )
  console.log(`📞 Places API calls: ${apiCalls} (photos field only — IDs Only SKU, $0.00)\n`)
}

main()
  .catch((err) => {
    if (err instanceof PlacesConfigError) {
      console.error(`\n✗ ${err.message}`)
      console.error('  Add GOOGLE_PLACES_API_KEY to server/.env and re-run.')
    } else {
      console.error('\n✗ Photo-name sync failed:', err instanceof Error ? err.message : err)
    }
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
