/**
 * Self-healing photo proxy — the I/O half.
 *
 * When Google rejects a stored photo name (they expire — see
 * `photoHealPolicy.ts` for the whole story), this re-fetches the restaurant's
 * CURRENT photo names via the free photos-only Place Details call, writes
 * them back to the row, and hands the proxy a fresh name to retry with.
 *
 * ⚠️ DB-GATED ON PURPOSE: a heal only runs for a placeId that exists in our
 * catalogue. The proxy's path parameter is attacker-controlled, and without
 * this check anyone could use /api/photos/places/<any-id>/photos/x to make
 * the server fire Place Details calls for arbitrary places.
 *
 * Every heal logs one `[photo-heal]` line (place, restaurant, disposition,
 * refs, ms) so Railway logs show how often Google expires the names — that
 * frequency is an input to the pending place-ID-only architecture decision.
 */
import prisma from '../lib/prisma'
import { getPlacePhotos, rankPhotos } from './googlePlaces'
import { MAX_PHOTOS } from './placesSync'
import { HealGate, type HealOutcome } from '../lib/photoHealPolicy'

export const photoHealGate = new HealGate({
  // Worst case — the whole catalogue expiring at once — is also the normal
  // case, so the cap is deliberately small: three Details calls in flight,
  // everyone else gets the placeholder now and fresh names within minutes.
  maxConcurrent: 3,
  // A healed place answers stragglers (clients still holding the old URLs)
  // from the remap; after this window they would re-heal, but by then every
  // API response is already carrying the new URLs.
  okTtlMs: 10 * 60_000,
  // After a failed heal, leave Google (and the DB lookup) alone for a while.
  failTtlMs: 5 * 60_000,
})

async function runHeal(placeId: string): Promise<HealOutcome | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { googlePlaceId: placeId },
    select: { id: true, name: true, photoRefs: true },
  })
  if (!restaurant) return null // not our place — never bill Google for it

  const details = await getPlacePhotos(placeId)
  const freshRefs = rankPhotos(details.photos ?? [], restaurant.name)
    .slice(0, MAX_PHOTOS)
    .map((p) => p.name)

  // Same rule as areaName/description/phoneNumber: Google answering with no
  // photos must not wipe the refs we hold — stale names at least keep the
  // remap/fallback story coherent and the row re-syncs later.
  if (freshRefs.length) {
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { photoRefs: freshRefs },
    })
  }

  return { oldRefs: restaurant.photoRefs, freshRefs }
}

/**
 * Fresh photo name for one Google rejected, or null → serve the placeholder.
 * Never throws — a heal failure must cost the user a placeholder, not a 500.
 */
export async function healPhotoName(photoName: string): Promise<string | null> {
  const started = Date.now()
  const { fresh, disposition } = await photoHealGate.resolve(photoName, runHeal)

  // 'cached' answers are the steady state once a place has healed — logging
  // each would turn one expiry into hundreds of identical lines.
  if (disposition !== 'cached') {
    const placeId = placeIdFromLog(photoName)
    console.log(
      `[photo-heal] place=${placeId} disposition=${disposition} ` +
        `fresh=${fresh ? 'yes' : 'no'} ms=${Date.now() - started}`,
    )
  }
  return fresh
}

const placeIdFromLog = (name: string) => name.split('/')[1] ?? '?'
