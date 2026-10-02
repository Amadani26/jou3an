/**
 * Dietary needs as a Stage-1 filter.
 *
 * ⚠️⚠️ READ THIS BEFORE TRUSTING IT. This filter is EXCLUSION-ONLY and it is
 * only as good as the data behind it. It CANNOT promise that a surviving
 * restaurant serves anything a vegan can eat; it can only remove rows that are
 * positively known to conflict.
 *
 * WHY. The signals actually available per row are:
 *   · `cuisineType`       — 100% coverage, but ~63% of the catalogue is the
 *                           literal string "International", which says nothing.
 *   · `googlePrimaryType` — 100% coverage, and genuinely informative for about
 *                           half the catalogue (the other half is the generic
 *                           "restaurant").
 *   · `tags`              — only 10 of 664 rows carry ANY tag, all of them the
 *                           original seed rows. The vocabulary that exists is
 *                           `vegetarian-friendly`, `healthy`, `quick`,
 *                           `date-night`, `comfort`, `cheap`, `high-protein`,
 *                           `late-night`. There is NO `vegan`, NO `no-pork`,
 *                           NO `gluten-free` tag — not thin coverage, none.
 *
 * So a POSITIVE filter ("keep only rows tagged vegetarian-friendly") would cut
 * the pool to six restaurants, forever, for every vegetarian — and the engine
 * throws below three. An exclusion filter removes a small, well-defined set
 * (~36 rows for vegetarian) and leaves ~630, which is why it is safe to apply
 * as a near-absolute gate without starving the "always exactly 3" rule.
 *
 * WHAT THAT MEANS FOR THE USER. Declaring "vegetarian" guarantees they are
 * never sent a steakhouse. It does not guarantee the Italian place they do get
 * has a meatless main. That is a catalogue problem (per-restaurant dietary
 * tags), not a filter problem, and no amount of logic here fixes it.
 *
 * `no-pork` currently filters NOTHING, deliberately — see NO_PORK below.
 *
 * Pure and dependency-free so a bad mapping shows up in a test rather than in
 * someone's dinner.
 */

/** The four needs the quiz collects. Anything else is stored but ignored here. */
export const DIETARY_NEEDS = ['vegetarian', 'vegan', 'no-pork', 'gluten-free'] as const
export type DietaryNeed = (typeof DIETARY_NEEDS)[number]

const NEEDS = new Set<string>(DIETARY_NEEDS)

/** Needs arrive from user input and old rows — normalise hard. */
export const normalizeNeed = (n: string) =>
  n.trim().toLowerCase().replace(/\s+/g, '-').replace(/^no_/, 'no-')

/** Keeps only the needs this module actually knows how to act on. */
export function knownNeeds(needs: readonly string[] | null | undefined): DietaryNeed[] {
  const seen = new Set<DietaryNeed>()
  for (const raw of needs ?? []) {
    const key = normalizeNeed(String(raw))
    if (NEEDS.has(key)) seen.add(key as DietaryNeed)
  }
  return [...seen]
}

/**
 * Google primary types that are definitionally built on meat or fish.
 *
 * Narrow on purpose. A `restaurant` or a `family_restaurant` is not excluded —
 * most of them have something meatless, and guessing otherwise would delete
 * most of the catalogue for a vegetarian.
 */
const MEAT_PRIMARY_TYPES = new Set([
  'steak_house',
  'barbecue_restaurant',
  'korean_barbecue_restaurant',
  'seafood_restaurant',
  'hamburger_restaurant',
  'chicken_restaurant',
  'chicken_wings_restaurant',
  'shawarma_restaurant',
  'bar_and_grill',
  'hot_pot_restaurant',
])

/** Our own cuisine strings whose whole premise is meat or fish. */
const MEAT_CUISINES = new Set([
  'steakhouse',
  'bbq',
  'seafood',
  'american burgers',
  'burgers',
])

/**
 * Additionally excluded for VEGAN, where dairy and eggs are the problem rather
 * than meat. Still narrow: a bakery or an ice-cream shop is a near-certain no,
 * an Italian restaurant is not.
 */
const NON_VEGAN_PRIMARY_TYPES = new Set([
  'bakery',
  'dessert_restaurant',
  'dessert_shop',
  'ice_cream_shop',
  'donut_shop',
  'cafeteria',
  'creamery',
])

const NON_VEGAN_CUISINES = new Set(['bakery', 'desserts', 'ice cream'])

/**
 * Definitionally wheat-based. Pizza, bread and wheat-noodle houses; NOT Italian
 * at large, which has risotto and salads, and not "Asian", which is mostly rice.
 */
const GLUTEN_PRIMARY_TYPES = new Set([
  'pizza_restaurant',
  'bakery',
  'bagel_shop',
  'donut_shop',
  'sandwich_shop',
  'ramen_restaurant',
  'noodle_shop',
])

const GLUTEN_CUISINES = new Set(['pizza', 'bakery'])

/**
 * ⚠️ NO-PORK EXCLUDES NOTHING, AND THAT IS THE CORRECT ANSWER HERE.
 *
 * Dubai's restaurant scene is overwhelmingly halal, so pork is the exception
 * rather than the rule, and NOTHING in the data marks it: there is no pork tag,
 * and Google has no pork-related place type. The only way to "implement" this
 * would be to exclude whole cuisines by stereotype — Chinese, Korean, Spanish —
 * which is both wrong (almost all of them are halal here) and offensive.
 *
 * So the preference is STORED on the user and surfaced in Profile, and it
 * filters nothing. Honest and inert beats confident and wrong. When
 * per-restaurant dietary tags exist, this is the first thing to revisit.
 */

/**
 * Types and tags that POSITIVELY clear a row, overriding a cuisine-level guess.
 *
 * An explicit signal always beats an inference: a place Google calls a
 * `vegetarian_restaurant`, or one a human tagged `vegetarian-friendly`, is not
 * excluded even if something else about it looks meaty.
 */
const VEGETARIAN_SAFE_TYPES = new Set(['vegetarian_restaurant', 'vegan_restaurant'])
const VEGAN_SAFE_TYPES = new Set(['vegan_restaurant'])
const VEGETARIAN_SAFE_TAGS = new Set(['vegetarian-friendly', 'vegan', 'vegetarian'])
const VEGAN_SAFE_TAGS = new Set(['vegan'])

/** The columns this module reads. Keeps it usable on any restaurant-shaped row. */
export interface DietaryCandidate {
  cuisineType: string
  googlePrimaryType?: string | null
  tags?: string[] | null
}

const norm = (s: string) => s.trim().toLowerCase()

function has(set: Set<string>, value: string | null | undefined): boolean {
  return Boolean(value) && set.has(norm(value as string))
}

function anyTag(set: Set<string>, tags: string[] | null | undefined): boolean {
  return (tags ?? []).some((t) => set.has(norm(t)))
}

/** Does this row conflict with ONE declared need? */
function conflictsWithNeed(r: DietaryCandidate, need: DietaryNeed): boolean {
  switch (need) {
    case 'vegetarian': {
      if (has(VEGETARIAN_SAFE_TYPES, r.googlePrimaryType)) return false
      if (anyTag(VEGETARIAN_SAFE_TAGS, r.tags)) return false
      return (
        has(MEAT_PRIMARY_TYPES, r.googlePrimaryType) || has(MEAT_CUISINES, r.cuisineType)
      )
    }
    case 'vegan': {
      if (has(VEGAN_SAFE_TYPES, r.googlePrimaryType)) return false
      if (anyTag(VEGAN_SAFE_TAGS, r.tags)) return false
      // Vegan is strictly harder than vegetarian: everything meat-based plus
      // the dairy- and egg-centric formats.
      return (
        has(MEAT_PRIMARY_TYPES, r.googlePrimaryType) ||
        has(MEAT_CUISINES, r.cuisineType) ||
        has(NON_VEGAN_PRIMARY_TYPES, r.googlePrimaryType) ||
        has(NON_VEGAN_CUISINES, r.cuisineType)
      )
    }
    case 'gluten-free':
      return (
        has(GLUTEN_PRIMARY_TYPES, r.googlePrimaryType) ||
        has(GLUTEN_CUISINES, r.cuisineType)
      )
    case 'no-pork':
      // Nothing in the data marks pork, and excluding cuisines by stereotype
      // would be both wrong and offensive — see the no-pork note above. Stored
      // on the user, surfaced in Profile, enforced nowhere.
      return false
  }
}

/**
 * True when this restaurant is positively known to conflict with any declared
 * need — i.e. when it must NOT be served to this user.
 *
 * No needs declared means nothing is excluded, so this is free for the vast
 * majority of requests.
 */
export function conflictsWithDietary(
  r: DietaryCandidate,
  needs: readonly string[] | null | undefined,
): boolean {
  const declared = knownNeeds(needs)
  if (!declared.length) return false
  return declared.some((need) => conflictsWithNeed(r, need))
}

/** Convenience inverse, for `.filter()` call sites that read better positively. */
export const satisfiesDietary = (
  r: DietaryCandidate,
  needs: readonly string[] | null | undefined,
) => !conflictsWithDietary(r, needs)

/**
 * Which declared needs this filter can actually act on, and which are inert.
 *
 * Exposed so the API can tell a client the truth rather than implying every
 * declared need is enforced.
 */
export function dietaryEnforcement(needs: readonly string[] | null | undefined): {
  enforced: DietaryNeed[]
  stored: DietaryNeed[]
} {
  const declared = knownNeeds(needs)
  return {
    stored: declared,
    enforced: declared.filter((n) => n !== 'no-pork'),
  }
}
