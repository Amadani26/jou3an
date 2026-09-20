/**
 * Per-restaurant Google Places sync.
 *
 * Extracted from `scripts/syncGooglePlaces.ts` so the import pipeline can run
 * exactly the same enrichment on just the rows it created, rather than
 * re-syncing the whole catalogue (and re-billing every Place Details call).
 */
import { Prisma, type Restaurant } from '@prisma/client'
import prisma from '../lib/prisma'
import { extractPeriods, getPlaceDetails, rankPhotos, searchPlace } from './googlePlaces'
import { resolveAreaName } from '../lib/areaName'

export const MAX_PHOTOS = 6

/** Areas are enum values (BUSINESS_BAY) — make them searchable ("Business Bay"). */
export const areaLabel = (area: string) =>
  area === 'OTHER'
    ? ''
    : area
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ')

export interface SyncOutcome {
  status: 'matched' | 'pinned' | 'no match'
  placeName?: string
  photos: number
  rating: number | null
  hours: number | null
  coords: string
  /** Real neighbourhood from Google's address, or null when unresolvable. */
  areaName: string | null
  /** How many Places calls this row cost. */
  apiCalls: number
}

/**
 * Resolves one restaurant against Places and writes the Places columns.
 *
 * A row that already has a `googlePlaceId` is PINNED: Text Search is skipped
 * entirely and details are fetched for that id. Imported rows are always
 * pinned, since the id is exactly what discovery found.
 */
export async function syncRestaurantPlaces(r: Restaurant): Promise<SyncOutcome> {
  const pinned = Boolean(r.googlePlaceId)
  let apiCalls = 0

  let placeId = r.googlePlaceId ?? null
  let searchName: string | undefined

  if (!placeId) {
    const query = [r.name, areaLabel(r.area), 'Dubai'].filter(Boolean).join(' ')
    const match = await searchPlace(query)
    apiCalls++
    if (!match?.id) {
      return {
      status: 'no match',
      photos: 0,
      rating: null,
      hours: null,
      coords: '—',
      areaName: null,
      apiCalls,
    }
    }
    placeId = match.id
    searchName = match.displayName?.text
  }

  const details = await getPlaceDetails(placeId)
  apiCalls++

  const placeName = details.displayName?.text ?? searchName ?? r.name
  const photoRefs = rankPhotos(details.photos ?? [], placeName)
    .slice(0, MAX_PHOTOS)
    .map((p) => p.name)

  const location = details.location
  const rating = details.rating ?? null
  const periods = extractPeriods(details)
  // Components first, formatted address as the fallback. Never overwrite a
  // resolved name with null: a transient gap in Google's data should not wipe
  // a neighbourhood we already had.
  const areaName = resolveAreaName(details.addressComponents, details.formattedAddress)

  await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      googlePlaceId: placeId,
      photoRefs,
      lat: location?.latitude ?? null,
      lng: location?.longitude ?? null,
      googleRating: rating,
      ...(areaName ? { areaName } : {}),
      // Prisma.DbNull (not JS null) is how a Json column is set back to SQL
      // NULL; plain null would be rejected by the generated type.
      openingHours: (periods ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      googleSyncedAt: new Date(),
    },
  })

  return {
    status: pinned ? 'pinned' : 'matched',
    placeName,
    photos: photoRefs.length,
    rating,
    hours: periods?.length ?? null,
    areaName,
    coords: location
      ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
      : '—',
    apiCalls,
  }
}
