/** Great-circle distance helpers. Coordinates are decimal degrees (WGS84). */

const EARTH_RADIUS_KM = 6371

export interface Coords {
  lat: number
  lng: number
}

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Haversine distance in kilometres between two points. */
export function distanceKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** One decimal place — the only precision the UI ever shows. */
export const roundKm = (km: number) => Math.round(km * 10) / 10

/**
 * True when a row has usable coordinates. Generic so narrowing keeps the rest
 * of the row's type instead of collapsing it to just lat/lng.
 */
export function hasCoords<T extends { lat: number | null; lng: number | null }>(
  r: T,
): r is T & { lat: number; lng: number } {
  return typeof r.lat === 'number' && typeof r.lng === 'number'
}

/**
 * Annotates each restaurant that has coordinates with its distance from
 * `origin`, drops those within `radiusKm`, and sorts nearest-first.
 *
 * Rows without coordinates are excluded — an unknown distance can't be claimed
 * to be nearby.
 */
export function withinRadius<T extends { lat: number | null; lng: number | null }>(
  restaurants: T[],
  origin: Coords,
  radiusKm: number,
): (T & { distanceKm: number })[] {
  return restaurants
    .flatMap((r) => {
      if (!hasCoords(r)) return []
      const km = distanceKm(origin, { lat: r.lat, lng: r.lng })
      return km <= radiusKm ? [{ ...r, distanceKm: roundKm(km) }] : []
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
}
