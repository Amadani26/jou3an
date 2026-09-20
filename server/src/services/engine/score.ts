/**
 * DecisionEngine v2 — Stage 2: score every surviving candidate.
 *
 *   total = 0.4 * quality + 0.4 * taste + 0.2 * context
 *
 * All three components are normalised to [0,1] so the weights mean what they
 * look like they mean. 0.5 is the neutral value for each — "no information"
 * must not read as "bad", or a restaurant Google has not rated would be
 * punished for our own missing data.
 */
import { WEIGHT_MAX, WEIGHT_MIN, normalizeCuisine, type TasteWeights } from '../tasteProfile'
import { BUDGET_BANDS } from './filter'
import type { Budget, Candidate, EngineContext, ReasonComponent, Vibe } from './types'

export const WEIGHTS = { quality: 0.4, taste: 0.4, context: 0.2 } as const

/** Neutral score for a component we have no evidence for. */
export const NEUTRAL = 0.5

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * Google's 0–5 rating, normalised.
 *
 * Real restaurant ratings cluster hard between 3.0 and 5.0, so mapping that
 * band across the full [0,1] range preserves the differences that matter
 * instead of squeezing every candidate into 0.6–1.0.
 */
export function qualityScore(r: Candidate): number {
  if (typeof r.googleRating === 'number' && r.googleRating > 0) {
    return clamp01((r.googleRating - 3) / 2)
  }
  // Fall back to the seeded 0–10 score, which is never shown to users but is
  // still a real ranking signal.
  if (r.ratingScore > 0) return clamp01(r.ratingScore / 10)
  return NEUTRAL
}

/** Map a raw taste weight in [WEIGHT_MIN, WEIGHT_MAX] onto [0,1]. */
const normalizeWeight = (w: number) =>
  clamp01((w - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN))

/**
 * How well this restaurant matches what the user has shown they like.
 *
 * The cuisine carries the signal; tags refine it. A user with no profile yet
 * scores NEUTRAL everywhere, which makes taste inert rather than random.
 */
export function tasteScore(r: Candidate, weights: TasteWeights): number {
  if (!Object.keys(weights).length) return NEUTRAL

  const cuisineKey = normalizeCuisine(r.cuisineType)
  const cuisineWeight = weights[cuisineKey]

  const tagWeights = r.tags
    .map((t) => weights[normalizeCuisine(t)])
    .filter((w): w is number => typeof w === 'number')

  // Nothing known about this restaurant's cuisine or tags.
  if (cuisineWeight === undefined && !tagWeights.length) return NEUTRAL

  const tagMean = tagWeights.length
    ? tagWeights.reduce((a, b) => a + b, 0) / tagWeights.length
    : undefined

  // Cuisine dominates; tags are a secondary nudge.
  const combined =
    cuisineWeight !== undefined && tagMean !== undefined
      ? cuisineWeight * 0.7 + tagMean * 0.3
      : (cuisineWeight ?? (tagMean as number))

  return normalizeWeight(combined)
}

/** Midpoint price is the best single proxy for "what this costs". */
const midPrice = (r: Candidate) => (r.priceMin + r.priceMax) / 2

/**
 * Vibe fit. Fancy leans expensive, casual leans cheap; AED 250 is treated as
 * the top of the scale, above which everything is simply "expensive".
 */
export function vibeFit(r: Candidate, vibe: Vibe): number {
  if (vibe === 'ANY') return NEUTRAL
  const normalised = clamp01(midPrice(r) / 250)
  return vibe === 'FANCY' ? normalised : 1 - normalised
}

/** How squarely the restaurant's price range sits inside the budget band. */
export function priceFit(r: Candidate, budget: Budget): number {
  if (budget === 'ANY') return NEUTRAL
  const band = BUDGET_BANDS[budget]
  const mid = midPrice(r)

  if (mid >= band.min && mid <= band.max) return 1

  // Outside the band: decay with distance, a full band-width out scoring 0.
  const width = Number.isFinite(band.max) ? band.max - band.min : 60
  const over = mid > band.max ? mid - band.max : band.min - mid
  return clamp01(1 - over / Math.max(width, 1))
}

export function contextScore(r: Candidate, context: EngineContext): number {
  return (vibeFit(r, context.vibe) + priceFit(r, context.budget)) / 2
}

export interface Components {
  quality: number
  taste: number
  context: number
  base: number
  topComponent: ReasonComponent
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
): Components {
  const quality = qualityScore(r)
  const taste = tasteScore(r, weights)
  const ctx = contextScore(r, context)

  const base =
    WEIGHTS.quality * quality + WEIGHTS.taste * taste + WEIGHTS.context * ctx

  return { quality, taste, context: ctx, base, topComponent: dominant(quality, taste, ctx) }
}
