/**
 * Mapping layer for the restaurant import pipeline.
 *
 * Google's vocabulary -> ours. Kept pure and dependency-free so the whole thing
 * is unit-testable without a network or a database, and so a bad mapping shows
 * up in a test rather than in production data.
 */
import type { LocationArea } from '@prisma/client'
import { distanceKm } from './geo'
import type { PriceLevel } from '../services/googlePlaces'

/* ------------------------------------------------------------------ */
/* Cuisine                                                             */
/* ------------------------------------------------------------------ */

/** Used whenever Google's types tell us nothing useful. */
export const CUISINE_FALLBACK = 'International'

/**
 * Google place type -> the cuisine string we store.
 *
 * Values match the style already in the catalogue ("American Burgers",
 * "Levantine Street Food"): human-readable, Title Case, shown directly in the
 * app. Order matters only in that `cuisineFromTypes` prefers `primaryType`.
 */
export const TYPE_TO_CUISINE: Record<string, string> = {
  afghani_restaurant: 'Afghan',
  african_restaurant: 'African',
  american_restaurant: 'American',
  asian_restaurant: 'Asian',
  bakery: 'Bakery',
  barbecue_restaurant: 'BBQ',
  brazilian_restaurant: 'Brazilian',
  breakfast_restaurant: 'Breakfast',
  brunch_restaurant: 'Brunch',
  buffet_restaurant: 'Buffet',
  cafe: 'Café',
  chinese_restaurant: 'Chinese',
  coffee_shop: 'Coffee',
  dessert_restaurant: 'Desserts',
  dessert_shop: 'Desserts',
  fast_food_restaurant: 'Fast Food',
  fine_dining_restaurant: 'Fine Dining',
  french_restaurant: 'French',
  greek_restaurant: 'Greek',
  hamburger_restaurant: 'American Burgers',
  ice_cream_shop: 'Desserts',
  indian_restaurant: 'Indian',
  indonesian_restaurant: 'Indonesian',
  italian_restaurant: 'Italian',
  japanese_restaurant: 'Japanese',
  juice_shop: 'Healthy',
  korean_restaurant: 'Korean',
  lebanese_restaurant: 'Lebanese',
  mediterranean_restaurant: 'Mediterranean',
  mexican_restaurant: 'Mexican',
  middle_eastern_restaurant: 'Middle Eastern',
  pizza_restaurant: 'Pizza',
  ramen_restaurant: 'Japanese',
  sandwich_shop: 'Sandwiches',
  seafood_restaurant: 'Seafood',
  spanish_restaurant: 'Spanish',
  steak_house: 'Steakhouse',
  sushi_restaurant: 'Japanese',
  thai_restaurant: 'Thai',
  turkish_restaurant: 'Turkish',
  vegan_restaurant: 'Healthy',
  vegetarian_restaurant: 'Healthy',
  vietnamese_restaurant: 'Vietnamese',
}

/**
 * Generic types that are true of almost every row and therefore say nothing
 * about the food. Skipped when scanning the secondary `types` array.
 */
const UNINFORMATIVE_TYPES = new Set([
  'restaurant',
  'food',
  'point_of_interest',
  'establishment',
  'store',
  'meal_takeaway',
  'meal_delivery',
])

/**
 * Best cuisine we can infer. `primaryType` wins; otherwise the first
 * informative entry in `types`; otherwise CUISINE_FALLBACK.
 */
export function cuisineFromTypes(
  primaryType?: string | null,
  types?: string[] | null,
): string {
  if (primaryType && TYPE_TO_CUISINE[primaryType]) return TYPE_TO_CUISINE[primaryType]

  for (const t of types ?? []) {
    if (UNINFORMATIVE_TYPES.has(t)) continue
    if (TYPE_TO_CUISINE[t]) return TYPE_TO_CUISINE[t]
  }
  return CUISINE_FALLBACK
}

/* ------------------------------------------------------------------ */
/* Area                                                                */
/* ------------------------------------------------------------------ */

/**
 * Address substrings that identify one of our areas.
 *
 * Checked BEFORE coordinates, because DIFC, Downtown and Business Bay sit
 * within ~2 km of each other and a nearest-centroid guess between them is close
 * to a coin flip. A formatted address that names the district is authoritative.
 *
 * Order matters: JLT is checked before Marina since the two are adjacent and an
 * address can mention both.
 */
export const AREA_PATTERNS: { area: LocationArea; patterns: RegExp[] }[] = [
  {
    area: 'JLT',
    patterns: [/\bjlt\b/i, /jumeirah lakes? towers?/i],
  },
  {
    area: 'MARINA',
    patterns: [
      /dubai marina/i,
      /\bmarina\b/i,
      /\bjbr\b/i,
      /jumeirah beach residence/i,
      /bluewaters/i,
    ],
  },
  {
    area: 'DIFC',
    patterns: [/\bdifc\b/i, /dubai international financial cent(re|er)/i],
  },
  {
    area: 'DOWNTOWN',
    patterns: [/downtown dubai/i, /burj khalifa/i, /dubai mall/i, /\bdowntown\b/i],
  },
  {
    area: 'BUSINESS_BAY',
    patterns: [/business bay/i],
  },
]

/**
 * Fallback centroids, each with the radius inside which we will claim it.
 *
 * Radii are deliberately tight: labelling a restaurant with the wrong area is
 * worse than labelling it OTHER, because area drives both the Decide flow's
 * filtering and what the card says.
 */
export const AREA_CENTROIDS: {
  area: LocationArea
  lat: number
  lng: number
  radiusKm: number
}[] = [
  { area: 'MARINA', lat: 25.0805, lng: 55.1403, radiusKm: 2.2 },
  { area: 'JLT', lat: 25.0693, lng: 55.1413, radiusKm: 1.3 },
  { area: 'DIFC', lat: 25.211, lng: 55.2796, radiusKm: 1.1 },
  { area: 'DOWNTOWN', lat: 25.1972, lng: 55.2744, radiusKm: 1.3 },
  { area: 'BUSINESS_BAY', lat: 25.1857, lng: 55.265, radiusKm: 1.6 },
]

/** Address text first, then coordinates, then OTHER. */
export function areaFromPlace(
  address?: string | null,
  coords?: { lat: number; lng: number } | null,
): LocationArea {
  if (address) {
    for (const { area, patterns } of AREA_PATTERNS) {
      if (patterns.some((re) => re.test(address))) return area
    }
  }

  if (coords) {
    let best: { area: LocationArea; km: number } | null = null
    for (const c of AREA_CENTROIDS) {
      const km = distanceKm(coords, { lat: c.lat, lng: c.lng })
      if (km <= c.radiusKm && (!best || km < best.km)) best = { area: c.area, km }
    }
    if (best) return best.area
  }

  return 'OTHER'
}

/* ------------------------------------------------------------------ */
/* Price                                                               */
/* ------------------------------------------------------------------ */

/**
 * Google's price band -> an AED-per-head range.
 *
 * Calibrated against the seeded catalogue (cheap shawarma ~15–30, mid-range
 * ~45–90, fine dining 150+). These are estimates by construction: Google gives
 * a bucket, not a number, so a hand-corrected row should never be clobbered by
 * a re-import.
 */
export const PRICE_BANDS: Record<PriceLevel, { min: number; max: number }> = {
  PRICE_LEVEL_FREE: { min: 0, max: 20 },
  PRICE_LEVEL_INEXPENSIVE: { min: 20, max: 55 },
  PRICE_LEVEL_MODERATE: { min: 50, max: 120 },
  PRICE_LEVEL_EXPENSIVE: { min: 120, max: 280 },
  PRICE_LEVEL_VERY_EXPENSIVE: { min: 280, max: 600 },
}

/** Used when Google has no price signal — the middle of the market. */
export const PRICE_FALLBACK = { min: 45, max: 100 }

export function priceRangeFor(priceLevel?: PriceLevel | string | null): {
  min: number
  max: number
} {
  if (priceLevel && priceLevel in PRICE_BANDS) {
    return PRICE_BANDS[priceLevel as PriceLevel]
  }
  return PRICE_FALLBACK
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/**
 * Internal 0–10 score for a freshly imported row.
 *
 * Neutral on purpose. `ratingScore` is our own editorial ranking signal and is
 * never shown to users; seeding it from Google's stars would double-count
 * quality, which the engine already reads from `googleRating`.
 */
export const NEUTRAL_RATING_SCORE = 7.5

/** Filesystem-safe slug for the candidates filename. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
