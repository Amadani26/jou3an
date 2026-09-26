/**
 * Venue classification.
 *
 * Google's Text Search returns coffee shops, bakeries and juice bars alongside
 * restaurants — they are food, but they are not a dinner decision. Rather than
 * delete them (their photos, hours and ratings cost API calls to gather) they
 * are marked CAFE and PARKED: kept in the catalogue, invisible to every
 * decision surface, ready for a future Cafes feature.
 *
 * Pure and dependency-free so a bad mapping shows up in a test rather than in
 * production data. Classification reads ONLY the stored Google taxonomy
 * (`googlePrimaryType` / `googleTypes`), so re-classifying the whole catalogue
 * costs nothing.
 */
import type { Prisma, VenueType } from '@prisma/client'

/**
 * Google place types that make a row a cafe rather than a restaurant.
 *
 * Deliberately narrow. `brunch_restaurant` and `breakfast_restaurant` are NOT
 * here: a Dubai brunch spot is a full sit-down meal and belongs in the engine.
 * Those are exactly the rows that need `npm run setvenue` when Google's
 * primary type misreads them.
 */
export const CAFE_TYPES = new Set([
  'cafe',
  'cafeteria',
  'coffee_shop',
  'bakery',
  'bagel_shop',
  'dessert_shop',
  'dessert_restaurant',
  'donut_shop',
  'ice_cream_shop',
  'juice_shop',
  'tea_house',
  'chocolate_shop',
  'candy_store',
  'confectionery',
])

/**
 * Types that outrank a cafe signal in the SECONDARY list.
 *
 * Half of Dubai's restaurants carry `cafe` somewhere in `types` as well as a
 * real cuisine type, so a bare `types.includes('cafe')` would reclassify the
 * catalogue. A secondary cafe signal therefore only counts when nothing in the
 * list says "this is a place you eat a meal".
 */
const MEAL_TYPES = new Set([
  'fine_dining_restaurant',
  'steak_house',
  'seafood_restaurant',
  'pizza_restaurant',
  'hamburger_restaurant',
  'sushi_restaurant',
  'ramen_restaurant',
  'barbecue_restaurant',
  'buffet_restaurant',
  'brunch_restaurant',
  'breakfast_restaurant',
  'fast_food_restaurant',
  'sandwich_shop',
  'afghani_restaurant',
  'african_restaurant',
  'american_restaurant',
  'asian_restaurant',
  'brazilian_restaurant',
  'chinese_restaurant',
  'french_restaurant',
  'greek_restaurant',
  'indian_restaurant',
  'indonesian_restaurant',
  'italian_restaurant',
  'japanese_restaurant',
  'korean_restaurant',
  'lebanese_restaurant',
  'mediterranean_restaurant',
  'mexican_restaurant',
  'middle_eastern_restaurant',
  'spanish_restaurant',
  'thai_restaurant',
  'turkish_restaurant',
  'vegan_restaurant',
  'vegetarian_restaurant',
  'vietnamese_restaurant',
])

/**
 * RESTAURANT unless Google says otherwise.
 *
 * `primaryType` is authoritative: Google picked it as the single best label.
 * The `types` array is only consulted when the primary type is missing or
 * uninformative, and then only if nothing in it indicates a meal.
 */
export function classifyVenue(
  primaryType?: string | null,
  types?: string[] | null,
): VenueType {
  const primary = primaryType?.trim()
  if (primary) {
    if (CAFE_TYPES.has(primary)) return 'CAFE'
    // A real restaurant type settles it — don't let a secondary 'cafe' win.
    if (MEAL_TYPES.has(primary)) return 'RESTAURANT'
  }

  const list = types ?? []
  if (list.some((t) => MEAL_TYPES.has(t))) return 'RESTAURANT'
  if (list.some((t) => CAFE_TYPES.has(t))) return 'CAFE'

  return 'RESTAURANT'
}

/** The cafe signals that justified a CAFE verdict — shown in the confirm list. */
export function cafeSignals(
  primaryType?: string | null,
  types?: string[] | null,
): string[] {
  const hits = new Set<string>()
  const primary = primaryType?.trim()
  if (primary && CAFE_TYPES.has(primary)) hits.add(primary)
  for (const t of types ?? []) if (CAFE_TYPES.has(t)) hits.add(t)
  return [...hits]
}

/* ------------------------------------------------------------------ */
/* What a decision surface is allowed to serve                         */
/* ------------------------------------------------------------------ */

/**
 * The single definition of "servable", shared by every decision surface:
 * the decision engine's Stage 1, the legacy keyword matcher, Food Tinder's
 * `/api/restaurants/nearby`, the tinder suggester and the Daily Top 3.
 *
 * ⚠️ NOT applied to `/api/restaurants/:id` or decision history — a restaurant
 * the user picked last month must still render after it is pruned or
 * reclassified, or their history silently loses rows.
 */
export const SERVEABLE_WHERE = {
  isActive: true,
  venueType: 'RESTAURANT',
} satisfies Prisma.RestaurantWhereInput

/** In-memory form of SERVEABLE_WHERE, for pools already loaded from the DB. */
export function isServeable(r: { isActive: boolean; venueType: VenueType }): boolean {
  return r.isActive && r.venueType === 'RESTAURANT'
}
