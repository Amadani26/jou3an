/**
 * DecisionEngine v2.
 *
 * `decide()` is a PURE function: same input, same three restaurants, no clock
 * reads, no database, no Math.random. Everything time- or randomness-dependent
 * is injected (`context.date`, `context.refreshNonce`), which is what makes the
 * whole thing testable and replayable from a DecisionLog row.
 *
 * Persistence lives in `./log.ts`, deliberately outside the pure core.
 *
 * ⚠️ NOT yet wired into POST /api/decisions/query — the keyword matcher in
 * ../decisionEngine.ts is still the live path. This builds alongside it.
 *
 * Four stages:
 *   1. filter   — active, open, format, budget, 5->10->city radius ladder
 *   2. score    — 0.4 quality + 0.4 taste + 0.2 context
 *   3. select   — diversity constraint, repeat-damping, ε-wildcard
 *   4. reason   — one line per pick, from its dominant component
 */
import { distanceKm as kmBetween, hasCoords, roundKm, type Coords } from '../../lib/geo'
import { filterCandidates, REQUIRED } from './filter'
import { buildReason, withDistance } from './reason'
import { dubaiDateString, hashSeed, seededRandom } from './rng'
import { byDistance, dampingFor, explorationFor, selectThree } from './select'
import { scoreCandidate } from './score'
import type { Candidate, Decision3, EngineInput, Pick, ScoreBreakdown } from './types'

export * from './types'
export { filterCandidates, RADIUS_TIERS, REQUIRED } from './filter'
export { hashSeed, seededRandom, dubaiDateString } from './rng'
export {
  DAMPING_DAYS,
  DAMPING_EXEMPT_PICK_RATE,
  DAMPING_FLOOR,
  EPSILON,
  MAX_EPSILON,
  MAX_EXPLORATION_REFRESHES,
  dampingFor,
  explorationFor,
} from './select'
export { WEIGHTS, NEUTRAL, qualityScore, tasteScore, contextScore } from './score'

/**
 * Builds the seed for this invocation.
 *
 * Stable across a (user, day, nonce) triple so the same request twice returns
 * the same answer; changing the nonce is how Refresh asks for a new roll.
 */
export function seedFor(input: EngineInput): number {
  return hashSeed(
    input.userId ?? 'anon',
    dubaiDateString(input.context.date),
    // Normalised to 0, NOT to '': an omitted nonce and an explicit 0 both mean
    // "first load" and must hash identically, or a client that sends the
    // default would disagree with one that omits the field.
    input.context.refreshNonce ?? 0,
  )
}

export function decide(input: EngineInput): Decision3 {
  const { candidates, tasteWeights, context } = input
  const recent = input.recentSelections ?? []
  const pickRates = input.pickRates ?? {}

  const origin: Coords | null =
    typeof context.lat === 'number' && typeof context.lng === 'number'
      ? { lat: context.lat, lng: context.lng }
      : null

  // --- Stage 1 -------------------------------------------------------
  const { pool, radiusKm, radiusTier, relaxed } = filterCandidates(candidates, context)

  const seed = seedFor(input)
  const random = seededRandom(seed)
  // Each Refresh tap widens the search — see explorationFor().
  const { noiseAmplitude, epsilon } = explorationFor(context.refreshNonce)

  const distanceOf = (r: Candidate): number | null => {
    if (!origin || !hasCoords(r)) return null
    return roundKm(kmBetween(origin, { lat: r.lat, lng: r.lng }))
  }

  // --- Stage 2 -------------------------------------------------------
  // Noise is drawn in a fixed order (pool order) so the seed fully determines
  // every score; the pool itself is already deterministic out of Stage 1.
  const breakdown: ScoreBreakdown[] = pool.map((r) => {
    const components = scoreCandidate(r, tasteWeights, context)
    const damping = dampingFor(r.id, recent, pickRates, context.date)
    const noise = (random() - 0.5) * 2 * noiseAmplitude

    return {
      restaurantId: r.id,
      name: r.name,
      cuisine: r.cuisineType,
      quality: components.quality,
      taste: components.taste,
      context: components.context,
      base: components.base,
      damping,
      noise,
      total: components.base * damping + noise,
      topComponent: components.topComponent,
      distanceKm: distanceOf(r),
    }
  })

  const ranked = [...breakdown].sort((a, b) => b.total - a.total)

  // --- Stage 3 -------------------------------------------------------
  const { chosen, wildcardUsed } = selectThree(ranked, random, epsilon)

  // The product rule is absolute. If the catalogue genuinely cannot field three
  // distinct restaurants we would rather fail loudly here than return two and
  // have every downstream consumer discover it the hard way.
  if (chosen.length < REQUIRED) {
    throw new Error(
      `DecisionEngine: only ${chosen.length} candidate(s) available, need ${REQUIRED}. ` +
        `Catalogue has ${candidates.length} restaurant(s).`,
    )
  }

  // Nearest-first when we know where the user is; otherwise best-scoring first.
  const ordered = origin ? [...chosen].sort(byDistance) : chosen

  const byId = new Map(pool.map((r) => [r.id, r]))

  // --- Stage 4 -------------------------------------------------------
  const picks = ordered.map((b, i): Pick => {
    const restaurant = byId.get(b.restaurantId) as Candidate
    // Only the slot the wildcard actually landed in gets the wildcard line.
    const isWildcard = wildcardUsed && chosen[2]?.restaurantId === b.restaurantId

    return {
      restaurant,
      rank: i + 1,
      reason: withDistance(
        buildReason(restaurant, b, {
          vibe: context.vibe,
          wildcard: isWildcard,
          requestedCuisines: context.requestedCuisines,
        }),
        b.distanceKm,
      ),
      breakdown: b,
      distanceKm: b.distanceKm,
    }
  })

  return {
    picks: picks as [Pick, Pick, Pick],
    radiusKm,
    radiusTier,
    relaxed,
    breakdown,
    seed,
    wildcardUsed,
  }
}
