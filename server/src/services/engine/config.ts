/**
 * DecisionEngine v2 — every scoring constant, in ONE place.
 *
 * Nothing in the engine may spell a scoring number inline. This file exists so
 * that re-tuning the ranking — or replacing these hand-set numbers with a
 * fitted model's coefficients — is a one-line change here rather than a hunt
 * through four files, and so the current balance can be read at a glance by
 * anyone asking "why did it pick that?".
 */
import type { Namespace } from '../tasteDimensions'
import type { MealContext } from '../tasteDimensions'

/**
 * The three top-level components. MUST sum to 1 (asserted in the tests) — the
 * weights are meant to read as percentages of the final score, and a set that
 * does not sum to 1 silently rescales every score instead.
 *
 * ⚠️ REBALANCED from 0.4 / 0.4 / 0.2 to 0.3 / 0.4 / 0.3, for two reasons that
 * are worth keeping:
 *
 *   - QUALITY IS A TIE-BREAKER, NOT A RANKER. The catalogue is pre-curated:
 *     discovery imports at a >= 4.2 Google rating and `npm run prune` removes
 *     the weak tail by hand. Every candidate the engine sees is already good,
 *     so spending 40% of the score re-deciding a question curation has already
 *     answered mostly ranks by how many tourists reviewed a place.
 *   - EXPLICIT CONTEXT DESERVES REAL POWER. Vibe and budget are things the user
 *     TOLD us, this query, two taps ago. At 0.2 — split between two sub-terms —
 *     a "Fancy" tap could move a score by at most 0.1, which is less than the
 *     gap between a 4.4 and a 4.8 rating. That is not a preference being
 *     honoured, it is a preference being noted.
 *
 * Taste keeps the largest share: it is the only component that knows anything
 * about THIS user, and it is now a vector over several dimensions rather than
 * a single cuisine lookup.
 */
export const WEIGHTS = { quality: 0.3, taste: 0.4, context: 0.3 } as const

/** Neutral score for a component we have no evidence for. */
export const NEUTRAL = 0.5

/* ------------------------------------------------------------------ */
/* Quality                                                             */
/* ------------------------------------------------------------------ */

/**
 * Real restaurant ratings cluster hard between these two, so mapping that band
 * across the full [0,1] range preserves the differences that matter instead of
 * squeezing every candidate into 0.6–1.0.
 */
export const QUALITY_RATING_FLOOR = 3
export const QUALITY_RATING_CEILING = 5

/** The seeded 0–10 `ratingScore`, used only when Google has no rating. */
export const QUALITY_FALLBACK_MAX = 10

/* ------------------------------------------------------------------ */
/* Taste                                                               */
/* ------------------------------------------------------------------ */

/**
 * How loudly each namespace speaks inside the taste term.
 *
 * ⚠️ This is the ONLY place the namespaces are weighted. Event ingestion
 * deliberately credits every dimension at the same strength (see
 * applyEventToVector) so that the ranking decision lives here, where it can be
 * read and tuned, rather than being baked irreversibly into stored data.
 *
 * Cuisine still leads — it is the single most reliable thing we know about a
 * restaurant. Tags carry the finer signal the old profile could not express
 * (steakhouse, date-night, quick). Price is real but weakest: it is also
 * represented in the context term, where the user's EXPLICIT budget lives, and
 * double-counting it would let a learned spend quietly override a stated one.
 *
 * These do NOT need to sum to 1: the taste term re-normalises over whichever
 * namespaces the candidate actually has evidence for.
 */
export const TASTE_NAMESPACE_WEIGHTS: Record<Namespace, number> = {
  cuisine: 0.55,
  tag: 0.3,
  price: 0.15,
}

/**
 * The floor the taste term divides by — the single loudest namespace's weight.
 *
 * ⚠️ WITHOUT THIS, KNOWING LESS SCORED HIGHER. The term re-normalises over the
 * namespaces a candidate actually has evidence for, so a restaurant matching
 * ONLY `price:LOW` had that one weight read at full volume, while a restaurant
 * matching a mildly-liked cuisine AND the same price band had the two averaged
 * — and came out lower. Measured on the live catalogue, where `price:LOW`
 * covers 530 of 580 rows and was therefore the one dimension nearly every
 * candidate matched: a +0.98 Japanese place scored 0.581 against 0.698 for a
 * cuisine the user had never expressed anything about.
 *
 * Dividing by at least this much means a lone weak namespace speaks at ITS
 * share of the vote rather than for the whole profile, while the cuisine — the
 * most reliable thing we know about a restaurant — still speaks at full
 * strength on its own, which is what keeps the quiz's ±2 worth exactly what it
 * was worth before the vector existed.
 */
export const TASTE_NORMALISATION_FLOOR = Math.max(
  ...Object.values(TASTE_NAMESPACE_WEIGHTS),
)

/** How many contributing dimensions the breakdown records per candidate. */
export const TOP_TASTE_DIMENSIONS = 3

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

/**
 * The context term's three parts. Vibe and price are what the user said this
 * query; meal-fit is the engine noticing what time it is.
 *
 * Meal-fit is deliberately the smallest: it is inferred, not stated, and a
 * brunch place at 9pm should be nudged down the list, never kept off it.
 */
export const CONTEXT_WEIGHTS = { vibe: 0.45, price: 0.35, meal: 0.2 } as const

/** Price at which `vibeFit` considers a restaurant maximally "fancy". */
export const VIBE_PRICE_CEILING = 250

/**
 * HIGH is open-ended, so `priceFit` borrows this width to decay over rather
 * than dividing by Infinity (which would score everything cheap a perfect 1).
 */
export const OPEN_BAND_WIDTH = 100

/**
 * How far meal-fit moves off NEUTRAL. ±0.35 of the 0.2-weighted context term is
 * at most ±0.021 of a final score — a nudge, as intended. It is enough to break
 * a tie between a brunch spot and a steakhouse at 21:00 and nowhere near enough
 * to keep either off the list.
 */
export const MEAL_FIT_BONUS = 0.35

/**
 * Signals that a place belongs to one meal rather than the other.
 *
 * Matched SUBSTRING-wise against each tag and against `googlePrimaryType`, so
 * Google's own `brunch_restaurant` and `bar` land here without a mapping table
 * of their own. A restaurant carrying signals for both meals is treated as
 * neutral — plenty of places genuinely do both, and guessing between them is
 * worse than not guessing.
 */
export const MEAL_TAGS: Record<MealContext, readonly string[]> = {
  lunch: ['breakfast', 'brunch', 'lunch', 'quick', 'cafe', 'coffee', 'bakery', 'deli'],
  dinner: ['dinner', 'date-night', 'late-night', 'fine-dining', 'rooftop', 'bar', 'shisha'],
}
