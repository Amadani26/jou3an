/**
 * Taste Vector v2 — the representation.
 *
 * A taste profile used to be one flat map of `cuisine -> weight`. That could
 * only ever learn one thing about a restaurant, and it was the coarsest thing
 * on the row: a user who right-swipes six steakhouses across four different
 * "cuisines" had told us something the old profile could not write down.
 *
 * A profile is now a VECTOR over namespaced dimensions:
 *
 *   cuisine:japanese   +3.0     the cuisine, as before
 *   tag:steakhouse     +1.8     every tag the restaurant carries
 *   price:MID          +0.9     the band its own price range falls in
 *
 * ...held in three maps — a shared `base` plus one per MEAL CONTEXT:
 *
 *   { base: {...}, lunch: {...}, dinner: {...} }
 *
 * ⚠️ WHY A SHARED BASE AND NOT JUST TWO MAPS. Lunch-you and dinner-you really
 * do differ (a salad bar at 13:00, a steakhouse at 21:00), but splitting the
 * evidence in two halves the data behind every weight and doubles how long the
 * profile takes to mean anything. So an event writes BOTH: the base at full
 * strength, the active context at half (CONTEXT_EVENT_SCALE), and scoring reads
 * base + active context. A user with one meal pattern ends up with a strong
 * base and two weak, agreeing context maps — the same answer the old flat
 * profile gave. A user whose lunches and dinners genuinely diverge grows two
 * context maps that pull in different directions, and gets a different answer
 * at 13:00 than at 21:00. The split costs nothing when it is not needed.
 *
 * ⚠️ PURE — no Prisma, no engine imports. `tasteProfile.ts` owns the event
 * maths and the database; the engine's score.ts reads these keys. Keeping the
 * representation here is what lets both sides share it without a cycle.
 */

import { bandFor } from '../lib/priceBands'
import { dubaiHour } from '../lib/hours'

/* ------------------------------------------------------------------ */
/* Dimension keys                                                      */
/* ------------------------------------------------------------------ */

/**
 * The namespaces a weight can live in. Adding one is deliberately cheap — that
 * is the point of namespacing the keys rather than adding more columns — but
 * anything new must also be emitted by `dimensionsFor` or nothing will ever
 * match it.
 */
export const NAMESPACES = ['cuisine', 'tag', 'price'] as const
export type Namespace = (typeof NAMESPACES)[number]

/** `cuisine:japanese`. Chosen because ':' never appears in a cuisine or tag. */
export const DIMENSION_SEPARATOR = ':'

/** Values arrive from Google, seed data and user input — normalise hard. */
export const normalizeDimensionValue = (v: string) => String(v).trim().toLowerCase()

export function dimensionKey(namespace: Namespace, value: string): string {
  return `${namespace}${DIMENSION_SEPARATOR}${normalizeDimensionValue(value)}`
}

export const cuisineDimension = (c: string) => dimensionKey('cuisine', c)
export const tagDimension = (t: string) => dimensionKey('tag', t)
/** Price bands are an enum, so the value is upper-case: `price:MID`. */
export const priceDimension = (band: string) =>
  `price${DIMENSION_SEPARATOR}${String(band).trim().toUpperCase()}`

export interface ParsedDimension {
  namespace: Namespace
  value: string
}

/** Splits a key back apart. Returns null for anything unnamespaced. */
export function parseDimension(key: string): ParsedDimension | null {
  const i = key.indexOf(DIMENSION_SEPARATOR)
  if (i <= 0) return null
  const namespace = key.slice(0, i) as Namespace
  if (!NAMESPACES.includes(namespace)) return null
  return { namespace, value: key.slice(i + 1) }
}

export const isNamespaced = (key: string) => parseDimension(key) !== null

/** The shape `dimensionsFor` needs — a Restaurant, or anything that looks like one. */
export interface DimensionSource {
  cuisineType?: string | null
  tags?: readonly string[] | null
  priceMin?: number | null
  priceMax?: number | null
}

/**
 * Every dimension key a restaurant matches: its cuisine, each of its tags, and
 * its price band.
 *
 * This is the ONE definition used by both sides — event ingestion credits
 * exactly these keys, and scoring looks up exactly these keys. If the two ever
 * disagreed, the profile would learn dimensions nothing could ever read.
 *
 * De-duplicated, because a tag that repeats a cuisine ("Japanese" tagged
 * `japanese`) must not count twice.
 */
export function dimensionsFor(r: DimensionSource): string[] {
  const keys: string[] = []

  const cuisine = normalizeDimensionValue(r.cuisineType ?? '')
  if (cuisine) keys.push(cuisineDimension(cuisine))

  for (const tag of r.tags ?? []) {
    const value = normalizeDimensionValue(tag)
    if (value) keys.push(tagDimension(value))
  }

  if (typeof r.priceMin === 'number' && typeof r.priceMax === 'number') {
    keys.push(priceDimension(bandFor({ priceMin: r.priceMin, priceMax: r.priceMax })))
  }

  return [...new Set(keys)]
}

/* ------------------------------------------------------------------ */
/* Meal context                                                        */
/* ------------------------------------------------------------------ */

export const MEAL_CONTEXTS = ['lunch', 'dinner'] as const
export type MealContext = (typeof MEAL_CONTEXTS)[number]

/**
 * The Dubai-local lunch window: `[LUNCH_FROM_HOUR, DINNER_FROM_HOUR)`.
 * Everything else — including the small hours — is dinner.
 *
 * Two boundaries, not three meals: breakfast is a small enough share of
 * decisions in this catalogue that a third map would be mostly empty, and an
 * empty map teaches nothing. 17:00 is late enough that a long lunch still
 * counts as lunch and early enough to catch an early dinner.
 *
 * ⚠️ 02:00 IS DINNER, not lunch. A naive `hour < 17` would file a 2am shawarma
 * run under lunch, which is the one thing it is definitely not — the small
 * hours belong to the night that produced them. This is also what keeps the
 * engine's late-night meal-fit bonus pointing the right way.
 */
export const LUNCH_FROM_HOUR = 5
export const DINNER_FROM_HOUR = 17

export function mealContextFor(date: Date): MealContext {
  const hour = dubaiHour(date)
  return hour >= LUNCH_FROM_HOUR && hour < DINNER_FROM_HOUR ? 'lunch' : 'dinner'
}

/* ------------------------------------------------------------------ */
/* The vector                                                          */
/* ------------------------------------------------------------------ */

/** A flat map of dimension key -> weight. */
export type TasteWeights = Record<string, number>

export interface TasteVector {
  /** Learned from every event, at full strength. */
  base: TasteWeights
  /** Learned from events that happened before DINNER_FROM_HOUR, at half. */
  lunch: TasteWeights
  /** Learned from events at or after DINNER_FROM_HOUR, at half. */
  dinner: TasteWeights
}

/** Weights are clamped so no single dimension can run away with the score. */
export const WEIGHT_MIN = -5
export const WEIGHT_MAX = 10

/**
 * Applied to every weight in a map before each delta lands, so a dimension the
 * user has stopped engaging with drifts back toward neutral. Mild on purpose:
 * at 0.98 a weight keeps ~82% of its value after 10 updates, ~13% after 100.
 */
export const DECAY = 0.98

/** Below this a weight is noise; dropping it keeps the JSON blob small. */
export const PRUNE_BELOW = 0.01

/**
 * How much of an event's delta the ACTIVE meal context gets. The base map
 * always gets the full delta — see the header note.
 */
export const CONTEXT_EVENT_SCALE = 0.5

export const clampWeight = (n: number) =>
  Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, n))

export const emptyVector = (): TasteVector => ({ base: {}, lunch: {}, dinner: {} })

/** Defensive read: a Json column is `unknown` as far as the type system goes. */
export function coerceWeights(raw: unknown): TasteWeights {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: TasteWeights = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}

/**
 * Namespaces a legacy flat map: `{ japanese: 3 }` -> `{ 'cuisine:japanese': 3 }`.
 *
 * ⚠️ IDEMPOTENT, and that is what makes the migration safe to run on every
 * read: a key that is ALREADY namespaced is passed through untouched, so a map
 * that has been through here once (or that came out of v2 in the first place)
 * is unchanged by a second pass.
 */
export function namespaceLegacyWeights(weights: TasteWeights): TasteWeights {
  const out: TasteWeights = {}
  for (const [key, value] of Object.entries(weights)) {
    out[isNamespaced(key) ? key : cuisineDimension(key)] = value
  }
  return out
}

/**
 * Reads a stored profile in EITHER shape.
 *
 * ⚠️ THIS IS THE WHOLE MIGRATION. v1 rows hold a flat `{ cuisine: weight }`
 * map; they are read as `{ base: <namespaced>, lunch: {}, dinner: {} }` and
 * rewritten in v2 shape the next time an event lands. Nothing is lost, nothing
 * has to be backfilled, and a row that is never touched again keeps working
 * forever. `weights` is already a Json column, so there is no schema change.
 *
 * Shape detection is by VALUE type, not by key name: a v2 vector's context keys
 * hold objects, a v1 map's hold numbers. A v1 profile for a cuisine literally
 * called "base" would therefore be read as v2 — which is why the object branch
 * additionally requires at least one recognised context key.
 */
export function coerceVector(raw: unknown): TasteVector {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyVector()
  const obj = raw as Record<string, unknown>

  const looksLikeVector = ['base', ...MEAL_CONTEXTS].some(
    (k) => obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k]),
  )

  if (looksLikeVector) {
    return {
      base: namespaceLegacyWeights(coerceWeights(obj.base)),
      lunch: namespaceLegacyWeights(coerceWeights(obj.lunch)),
      dinner: namespaceLegacyWeights(coerceWeights(obj.dinner)),
    }
  }

  // v1: one flat cuisine map, which becomes the base.
  return { base: namespaceLegacyWeights(coerceWeights(raw)), lunch: {}, dinner: {} }
}

/** True when this profile has no evidence at all — a brand-new user. */
export const isEmptyVector = (v: TasteVector) =>
  !Object.keys(v.base).length &&
  !Object.keys(v.lunch).length &&
  !Object.keys(v.dinner).length

/**
 * What scoring actually reads: base + the ACTIVE meal context, summed per
 * dimension and clamped back into range.
 *
 * Clamped on the way out as well as on the way in, because the two maps are
 * clamped independently and their sum can exceed the ceiling — a user who has
 * chosen steakhouses at dinner for a year should not be able to buy more than
 * WEIGHT_MAX of influence by doing it in two places at once.
 */
export function weightsFor(vector: TasteVector, meal: MealContext): TasteWeights {
  const ctx = vector[meal] ?? {}
  const out: TasteWeights = {}
  for (const key of new Set([...Object.keys(vector.base), ...Object.keys(ctx)])) {
    const sum = (vector.base[key] ?? 0) + (ctx[key] ?? 0)
    if (sum !== 0) out[key] = clampWeight(sum)
  }
  return out
}

/** Adds one flat map into a vector's base, clamping the sum. Pure. */
export function addToBase(vector: TasteVector, weights: TasteWeights): TasteVector {
  const base: TasteWeights = { ...vector.base }
  for (const [key, value] of Object.entries(weights)) {
    base[key] = clampWeight((base[key] ?? 0) + value)
  }
  return { ...vector, base }
}
