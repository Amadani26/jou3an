/**
 * Google Places API (New) client — plain fetch, no SDK.
 *
 * The API key lives ONLY on the server (GOOGLE_PLACES_API_KEY). It is never
 * logged and never sent to clients: photos reach the app through the
 * /api/photos proxy, which attaches the key server-side.
 */

const PLACES_BASE = 'https://places.googleapis.com/v1'

/** Photo resource name, e.g. "places/ChIJ.../photos/AelY_Cs...". */
export type PhotoName = string

export interface PlacePhoto {
  name: PhotoName
  widthPx?: number
  heightPx?: number
  authorAttributions?: { displayName?: string; uri?: string; photoUri?: string }[]
}

/** One end of an opening period; `day` is 0=Sunday..6=Saturday, place-local. */
export interface PlaceHoursPoint {
  day: number
  hour: number
  minute?: number
}

/** A period with no `close` means the place is open 24/7. */
export interface PlaceHoursPeriod {
  open: PlaceHoursPoint
  close?: PlaceHoursPoint
}

export interface PlaceOpeningHours {
  periods?: PlaceHoursPeriod[]
  weekdayDescriptions?: string[]
}

/** One entry from Places' structured address breakdown. */
export interface PlaceAddressComponent {
  longText?: string
  shortText?: string
  types?: string[]
  languageCode?: string
}

export interface PlaceDetails {
  id: string
  displayName?: { text?: string }
  location?: { latitude: number; longitude: number }
  rating?: number
  photos?: PlacePhoto[]
  regularOpeningHours?: PlaceOpeningHours
  addressComponents?: PlaceAddressComponent[]
  formattedAddress?: string
}

export class PlacesConfigError extends Error {}

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    throw new PlacesConfigError(
      'GOOGLE_PLACES_API_KEY is not set in the environment',
    )
  }
  return key
}

/**
 * Error text from Google can echo the request URL (which may carry the key on
 * the photo endpoint), so scrub anything key-shaped before it reaches a log.
 */
function scrub(text: string): string {
  return text.replace(/key=[^&"\s]+/gi, 'key=***')
}

async function placesFetch<T>(
  path: string,
  fieldMask: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${PLACES_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': fieldMask,
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Places ${res.status} ${res.statusText}: ${scrub(body).slice(0, 300)}`)
  }
  return (await res.json()) as T
}

/**
 * Text Search — resolves a free-text query ("{name} {area} Dubai") to a place.
 * Returns null when Google has no match.
 */
export async function searchPlace(textQuery: string): Promise<PlaceDetails | null> {
  const data = await placesFetch<{ places?: PlaceDetails[] }>(
    '/places:searchText',
    'places.id,places.displayName,places.location,places.rating',
    {
      method: 'POST',
      body: JSON.stringify({
        textQuery,
        maxResultCount: 1,
        regionCode: 'AE',
        languageCode: 'en',
      }),
    },
  )
  return data.places?.[0] ?? null
}

/**
 * Dubai bounding box, used to RESTRICT area search so the picker can never
 * return a place outside the city Jou3an covers.
 */
const DUBAI_BOUNDS = {
  low: { latitude: 24.75, longitude: 54.85 },
  high: { latitude: 25.4, longitude: 55.65 },
}

export interface AreaSuggestion {
  name: string
  area: string
  lat: number
  lng: number
}

interface AreaSearchPlace extends PlaceDetails {
  formattedAddress?: string
  shortFormattedAddress?: string
}

/**
 * Text Search for the "Pick an area" picker — neighbourhoods, landmarks or
 * venues, restricted to Dubai. Returns at most `limit` slimmed-down results;
 * nothing from Google's payload is passed through untouched.
 */
export async function searchAreas(
  query: string,
  limit = 5,
): Promise<AreaSuggestion[]> {
  const data = await placesFetch<{ places?: AreaSearchPlace[] }>(
    '/places:searchText',
    'places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location',
    {
      method: 'POST',
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: limit,
        regionCode: 'AE',
        languageCode: 'en',
        locationRestriction: { rectangle: DUBAI_BOUNDS },
      }),
    },
  )

  return (data.places ?? []).flatMap((p) => {
    const name = p.displayName?.text?.trim()
    const loc = p.location
    if (!name || !loc) return []
    return [
      {
        name,
        // Short address is the closest thing Places gives to a neighbourhood.
        area: (p.shortFormattedAddress ?? p.formattedAddress ?? 'Dubai').trim(),
        lat: loc.latitude,
        lng: loc.longitude,
      },
    ]
  })
}

/* ------------------------------------------------------------------ */
/* Discovery — paged Text Search for the import pipeline               */
/* ------------------------------------------------------------------ */

/** Google's price band enum (Places API New). */
export type PriceLevel =
  | 'PRICE_LEVEL_FREE'
  | 'PRICE_LEVEL_INEXPENSIVE'
  | 'PRICE_LEVEL_MODERATE'
  | 'PRICE_LEVEL_EXPENSIVE'
  | 'PRICE_LEVEL_VERY_EXPENSIVE'

/** One Text Search hit, slimmed to what the import pipeline actually needs. */
export interface DiscoveryPlace {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  businessStatus?: string
  priceLevel?: PriceLevel
  primaryType?: string
  primaryTypeDisplayName?: { text?: string }
  types?: string[]
}

/** Google caps a Text Search page at 20. */
export const DISCOVERY_PAGE_SIZE = 20

const DISCOVERY_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.priceLevel',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'nextPageToken',
].join(',')

export interface DiscoveryResult {
  places: DiscoveryPlace[]
  /** How many HTTP calls this took — surfaced so billing stays visible. */
  apiCalls: number
  /** True when Google still had more pages when we stopped. */
  truncated: boolean
}

/**
 * Paged Text Search, restricted to Dubai.
 *
 * `onPage` fires after each page so the caller can show progress and apply its
 * own pacing between requests — this function deliberately does NOT sleep, so
 * the rate-limiting policy lives with the script that owns the run.
 */
export async function discoverPlaces(
  textQuery: string,
  opts: {
    maxPages?: number
    onPage?: (pageIndex: number, count: number) => Promise<void> | void
  } = {},
): Promise<DiscoveryResult> {
  const maxPages = opts.maxPages ?? 3
  const places: DiscoveryPlace[] = []
  let pageToken: string | undefined
  let apiCalls = 0
  let truncated = false

  for (let page = 0; page < maxPages; page++) {
    const data = await placesFetch<{
      places?: DiscoveryPlace[]
      nextPageToken?: string
    }>('/places:searchText', DISCOVERY_FIELD_MASK, {
      method: 'POST',
      body: JSON.stringify({
        textQuery,
        pageSize: DISCOVERY_PAGE_SIZE,
        regionCode: 'AE',
        languageCode: 'en',
        // Keeps a loosely-worded query from drifting to another emirate.
        locationRestriction: { rectangle: DUBAI_BOUNDS },
        // Text alone surfaces hotels and malls that merely contain a
        // restaurant; this keeps the result set to actual eateries.
        includedType: 'restaurant',
        ...(pageToken ? { pageToken } : {}),
      }),
    })
    apiCalls++

    const batch = data.places ?? []
    places.push(...batch)
    await opts.onPage?.(page, batch.length)

    pageToken = data.nextPageToken
    if (!pageToken) break
    if (page === maxPages - 1) truncated = true
  }

  return { places, apiCalls, truncated }
}


/**
 * Place Details — photos, coordinates, rating and opening hours for one id.
 *
 * `regularOpeningHours` is billed on the Places "Advanced" SKU, so it is worth
 * knowing this call costs more than the plain fields. We store the periods
 * verbatim and interpret them in src/lib/hours.ts.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  return placesFetch<PlaceDetails>(
    `/places/${encodeURIComponent(placeId)}`,
    'id,displayName,location,rating,photos,regularOpeningHours,addressComponents,formattedAddress',
    { method: 'GET' },
  )
}

/**
 * Address-only Place Details — the cheap call.
 *
 * Used by the areaName backfill, which needs nothing but the address. Keeping
 * the field mask this narrow keeps the request on the Places "Essentials" SKU
 * instead of dragging in the Advanced fields (photos, hours) we already have.
 */
export async function getPlaceAddress(placeId: string): Promise<PlaceDetails> {
  return placesFetch<PlaceDetails>(
    `/places/${encodeURIComponent(placeId)}`,
    'id,displayName,addressComponents,formattedAddress',
    { method: 'GET' },
  )
}

/**
 * Just the periods array, or null when Google has no hours for the place.
 *
 * Normalised to drop entries without a usable `open`, so a malformed period can
 * never reach `isOpenNow()` and be mistaken for "closed".
 */
export function extractPeriods(
  details: PlaceDetails,
): PlaceHoursPeriod[] | null {
  const periods = details.regularOpeningHours?.periods
  if (!Array.isArray(periods) || !periods.length) return null

  const usable = periods.filter(
    (p) =>
      p?.open &&
      Number.isFinite(p.open.day) &&
      Number.isFinite(p.open.hour) &&
      p.open.day >= 0 &&
      p.open.day <= 6,
  )
  return usable.length ? usable : null
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Order photos so likely owner-uploaded ones come first.
 *
 * The Places API exposes no explicit "owner" flag, so this is a heuristic: a
 * photo whose authorAttribution displayName matches the place name is almost
 * always the business's own upload rather than a customer's. Everything else
 * keeps Google's original order (which is roughly quality-ranked).
 */
export function rankPhotos(photos: PlacePhoto[], placeName: string): PlacePhoto[] {
  const target = normalize(placeName)
  if (!target) return photos

  const isOwner = (p: PlacePhoto) =>
    (p.authorAttributions ?? []).some((a) => {
      const author = normalize(a.displayName ?? '')
      if (!author) return false
      return author === target || author.includes(target) || target.includes(author)
    })

  const owner = photos.filter(isOwner)
  const rest = photos.filter((p) => !isOwner(p))
  return [...owner, ...rest]
}

/** Places photo media URL. Contains the API key — server-side use only. */
export function photoMediaUrl(name: PhotoName, maxWidthPx = 800): string {
  const params = new URLSearchParams({
    maxWidthPx: String(maxWidthPx),
    key: apiKey(),
  })
  return `${PLACES_BASE}/${name}/media?${params.toString()}`
}

/** Photo resource names are "places/{placeId}/photos/{photoId}" — validate before proxying. */
export const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/

export function isValidPhotoName(name: string): boolean {
  return PHOTO_NAME_RE.test(name)
}
