/**
 * DecisionEngine v2 — Stage 2: score every surviving candidate.
 *
 *   total = WEIGHTS.quality * quality
 *         + WEIGHTS.taste   * taste
 *         + WEIGHTS.context * context
 *
 * All three components are normalised to [0,1] so the weights mean what they
 * look like they mean. NEUTRAL (0.5) is the neutral value for each — "no
 * information" must not read as "bad", or a restaurant Google has not rated
 * would be punished for our own missing data.
 *
 * ⚠️ Every number this file ranks by lives in ./config.ts. Nothing here spells
 * a weight inline — see the note there.
 */
import {
  dimensionsFor,
  parseDimension,
  normalizeDimensionValue,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type MealContext,
  type Namespace,
  type TasteWeights,
} from '../tasteDimensions'
import { PRICE_BANDS, midPrice } from '../../lib/priceBands'
import {
  CONTEXT_WEIGHTS,
  MEAL_FIT_BONUS,
  MEAL_TAGS,
  NEUTRAL,
  OPEN_BAND_WIDTH,
  QUALITY_FALLBACK_MAX,
  QUALITY_RATING_CEILING,
  QUALITY_RATING_FLOOR,
  TASTE_NAMESPACE_WEIGHTS,
  TASTE_NORMALISATION_FLOOR,
  TOP_TASTE_DIMENSIONS,
  VIBE_PRICE_CEILING,
  WEIGHTS,
} from './config'
import type {
  Budget,
  Candidate,
  EngineContext,
  ReasonComponent,
  TasteContribution,
  Vibe,
} from './types'

export { WEIGHTS, NEUTRAL } from './config'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * Google's 0–5 rating, normalised across the band real ratings occupy.
 */
export function qualityScore(r: Candidate): number {
  if (typeof r.googleRating === 'number' && r.googleRating > 0) {
    return clamp01(
      (r.googleRating - QUALITY_RATING_FLOOR) /
        (QUALITY_RATING_CEILING - QUALITY_RATING_FLOOR),
    )
  }
  // Fall back to the seeded 0–10 score, which is never shown to users but is
  // still a real ranking signal.
  if (r.ratingScore > 0) return clamp01(r.ratingScore / QUALITY_FALLBACK_MAX)
  return NEUTRAL
}

/**
 * Map a raw taste weight in [WEIGHT_MIN, WEIGHT_MAX] onto [0,1], with weight
 * ZERO pinned to NEUTRAL.
 *
 * ⚠️ The two sides are scaled INDEPENDENTLY, and that matters. The clamp range
 * is [-5, 10] — not centred on zero — so the obvious linear map
 * `(w - MIN) / (MAX - MIN)` put weight 0 at 0.333 and a single SWIPE_RIGHT
 * (+1) at 0.400. Both sit BELOW the 0.5 that an unknown dimension scores, which
 * meant mild positive evidence scored strictly worse than no evidence at all:
 * one right-swipe on Thai actively demoted Thai, and the taste quiz's +2 "I
 * love this" demoted it too.
 *
 * Anchoring 0 at NEUTRAL is what makes a positive weight a promotion and a
 * negative weight a demotion, which is the only reading of those numbers
 * anybody writing them intended.
 */
export const normalizeWeight = (w: number) => {
  if (w >= 0) return clamp01(NEUTRAL + (w / WEIGHT_MAX) * (1 - NEUTRAL))
  return clamp01(NEUTRAL - (w / WEIGHT_MIN) * NEUTRAL)
}

export interface TasteDetail {
  score: number
  /** The dimensions that actually moved it, strongest first. */
  contributions: TasteContribution[]
}

/**
 * How well this restaurant matches what the user has shown they like — now
 * across every dimension of the profile, not just its cuisine.
 *
 * ⚠️ A WEIGHTED MEAN, NOT A SUM, and that is the comparability guard. A plain
 * sum of matching weights would make the term grow with (a) how many tags a
 * restaurant happens to carry and (b) how long the user has been using the app,
 * so a heavy user's every candidate would out-score a new user's every
 * candidate and the 0.4 weight would quietly stop meaning 0.4. Instead:
 *
 *   1. within a namespace, the matching weights are averaged;
 *   2. across namespaces, those means are combined by TASTE_NAMESPACE_WEIGHTS,
 *      re-normalised over the namespaces that had evidence — but never by less
 *      than TASTE_NORMALISATION_FLOOR, which is what stops a candidate we know
 *      one weak thing about from out-scoring one we know more about.
 *
 * The result always lands in [WEIGHT_MIN, WEIGHT_MAX] and maps through
 * `normalizeWeight` to [0,1] — the same range, with the same meaning, for a
 * brand-new profile and a thousand-swipe one. A restaurant with no known
 * dimension at all scores exactly NEUTRAL, which makes taste inert rather than
 * random for a new user.
 */
export function tasteDetail(r: Candidate, weights: TasteWeights): TasteDetail {
  if (!Object.keys(weights).length) return { score: NEUTRAL, contributions: [] }

  const contributions: TasteContribution[] = []
  const byNamespace = new Map<Namespace, number[]>()

  for (const key of dimensionsFor(r)) {
    const weight = weights[key]
    if (typeof weight !== 'number' || weight === 0) continue
    const parsed = parseDimension(key)
    if (!parsed) continue

    contributions.push({ key, namespace: parsed.namespace, weight })
    const bucket = byNamespace.get(parsed.namespace)
    if (bucket) bucket.push(weight)
    else byNamespace.set(parsed.namespace, [weight])
  }

  // Nothing known about this restaurant's cuisine, tags or price band.
  if (!byNamespace.size) return { score: NEUTRAL, contributions: [] }

  let weighted = 0
  let totalWeight = 0
  for (const [namespace, values] of byNamespace) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const nsWeight = TASTE_NAMESPACE_WEIGHTS[namespace] ?? 0
    weighted += nsWeight * mean
    totalWeight += nsWeight
  }

  // ⚠️ The denominator has a FLOOR — see TASTE_NORMALISATION_FLOOR. Dividing by
  // the present weight alone let a candidate we know one weak thing about
  // out-score one we know a weak thing AND a strong thing about.
  const combined = weighted / Math.max(totalWeight, TASTE_NORMALISATION_FLOOR)

  // Strongest first, by magnitude: a -4 "never again" is as diagnostic as a +4.
  contributions.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))

  return {
    score: normalizeWeight(combined),
    contributions: contributions.slice(0, TOP_TASTE_DIMENSIONS),
  }
}

/** The taste term alone, for callers that do not need the breakdown. */
export function tasteScore(r: Candidate, weights: TasteWeights): number {
  return tasteDetail(r, weights).score
}

/**
 * Vibe fit. Fancy leans expensive, casual leans cheap; VIBE_PRICE_CEILING is
 * the top of the scale, above which everything is simply "expensive".
 */
export function vibeFit(r: Candidate, vibe: Vibe): number {
  if (vibe === 'ANY') return NEUTRAL
  const normalised = clamp01(midPrice(r) / VIBE_PRICE_CEILING)
  return vibe === 'FANCY' ? normalised : 1 - normalised
}

/**
 * How squarely the restaurant's price range sits inside the budget band.
 *
 * ⚠️ This is the ONLY place the user's saved budget acts, and it is one part of
 * the context term — so a band is worth at most CONTEXT_WEIGHTS.price *
 * WEIGHTS.context of a score. That is the whole point: the quiz asks what you
 * usually spend, not what you will never exceed, so the answer leans the
 * ranking instead of capping it.
 *
 * 'ANY' ("Any budget") returns NEUTRAL, which makes the term inert rather than
 * punishing every price equally.
 */
export function priceFit(r: Candidate, budget: Budget): number {
  if (budget === 'ANY') return NEUTRAL
  const band = PRICE_BANDS[budget]
  const mid = midPrice(r)

  if (mid >= band.min && mid <= band.max) return 1

  // Outside the band: decay with distance, a full band-width out scoring 0.
  const width = Number.isFinite(band.max) ? band.max - band.min : OPEN_BAND_WIDTH
  const over = mid > band.max ? mid - band.max : band.min - mid
  return clamp01(1 - over / Math.max(width, 1))
}

/** Every string that might carry a meal signal, normalised. */
const mealSignals = (r: Candidate): string[] =>
  [...(r.tags ?? []), r.googlePrimaryType ?? '']
    .map(normalizeDimensionValue)
    .filter(Boolean)

/**
 * Does this place belong to the meal the user is deciding for?
 *
 * A nudge, never a filter — see MEAL_FIT_BONUS. A restaurant that signals BOTH
 * meals (or neither) is NEUTRAL: plenty of places genuinely do both, and
 * guessing between them is worse than not guessing.
 */
export function mealFit(r: Candidate, meal: MealContext): number {
  const signals = mealSignals(r)
  if (!signals.length) return NEUTRAL

  const matches = (list: readonly string[]) =>
    signals.some((s) => list.some((t) => s.includes(t)))

  const other: MealContext = meal === 'lunch' ? 'dinner' : 'lunch'
  const now = matches(MEAL_TAGS[meal])
  const then = matches(MEAL_TAGS[other])

  if (now === then) return NEUTRAL
  return now ? NEUTRAL + MEAL_FIT_BONUS : NEUTRAL - MEAL_FIT_BONUS
}

/**
 * Vibe + budget + time of day, weighted by CONTEXT_WEIGHTS.
 *
 * With the rebalance this term carries 0.3 of the score, so what the user said
 * two taps ago can actually move a ranking — see the note in config.ts.
 */
export function contextScore(
  r: Candidate,
  context: EngineContext,
  meal: MealContext,
): number {
  return (
    CONTEXT_WEIGHTS.vibe * vibeFit(r, context.vibe) +
    CONTEXT_WEIGHTS.price * priceFit(r, context.budget) +
    CONTEXT_WEIGHTS.meal * mealFit(r, meal)
  )
}

export interface Components {
  quality: number
  taste: number
  context: number
  base: number
  topComponent: ReasonComponent
  tasteDimensions: TasteContribution[]
}

/**
 * Which component earned this pick its place — measured as distance from
 * NEUTRAL, weighted, so "strongly liked cuisine" beats "slightly good rating".
 */
function dominant(quality: number, taste: number, context: number): ReasonComponent {
  const contributions: [ReasonComponent, number][] = [
    ['quality', (quality - NEUTRAL) * WEIGHTS.quality],
    ['taste', (taste - NEUTRAL) * WEIGHTS.taste],
    ['context', (context - NEUTRAL) * WEIGHTS.context],
  ]
  contributions.sort((a, b) => b[1] - a[1])
  // Everything at or below neutral: nothing stands out, so credit the rating,
  // which is the only component that is always meaningful.
  return contributions[0][1] > 0 ? contributions[0][0] : 'quality'
}

export function scoreCandidate(
  r: Candidate,
  weights: TasteWeights,
  context: EngineContext,
  meal: MealContext,
): Components {
  const quality = qualityScore(r)
  const taste = tasteDetail(r, weights)
  const ctx = contextScore(r, context, meal)

  const base =
    WEIGHTS.quality * quality + WEIGHTS.taste * taste.score + WEIGHTS.context * ctx

  return {
    quality,
    taste: taste.score,
    context: ctx,
    base,
    topComponent: dominant(quality, taste.score, ctx),
    tasteDimensions: taste.contributions,
  }
}

// Kept for the weight-range assertions in the tests.
export { WEIGHT_MAX, WEIGHT_MIN }
