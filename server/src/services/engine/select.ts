/**
 * DecisionEngine v2 — Stage 3: pick the three.
 *
 * Top-3-by-score alone produces a boring, repetitive answer: three branches of
 * the same cuisine, and the same three every day. Three mechanisms fix that,
 * all of them deterministic given the seed:
 *
 *   - a cuisine-diversity constraint, so the three are not all the same food;
 *   - repeat-damping, so last night's pick steps aside for a week;
 *   - an ε-wildcard on slot 3, so there is always a chance of a surprise.
 */
import { normalizeCuisine } from '../tasteProfile'
import type { Candidate, RecentSelection, ScoreBreakdown } from './types'

/** Probability that slot 3 is a wildcard rather than the next-best candidate. */
export const EPSILON = 0.15

/**
 * Exploration ceiling reached after this many Refresh taps.
 *
 * A refresh is an explicit "not these" from the user, so each tap should widen
 * the search rather than merely re-order the same winners. With a small fixed
 * noise the top three by score ARE the top three every time, and Refresh would
 * hand back the same restaurants in a different order — which reads as broken.
 */
export const MAX_EXPLORATION_REFRESHES = 4
export const MAX_EPSILON = 0.45

/** Multiplier applied to a restaurant picked today; decays to 1 over a week. */
export const DAMPING_FLOOR = 0.5
export const DAMPING_DAYS = 7

/** Above this historical pick rate a restaurant is exempt from damping. */
export const DAMPING_EXEMPT_PICK_RATE = 0.4

/** Jitter added to every score to break ties without reordering real gaps. */
export const NOISE_AMPLITUDE = 0.02

/** Jitter once the user has refreshed enough to say "show me something else". */
export const MAX_NOISE_AMPLITUDE = 0.18

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * How adventurous to be, given how many times the user has hit Refresh.
 *
 * Nonce 0 (first load) keeps the tuned defaults, so the best answer is the
 * one that leads. Each subsequent tap raises both the score jitter and the
 * wildcard odds, ramping to the ceiling by MAX_EXPLORATION_REFRESHES.
 */
export function explorationFor(refreshNonce: number | string | undefined | null): {
  noiseAmplitude: number
  epsilon: number
} {
  const raw = typeof refreshNonce === 'number' ? refreshNonce : Number(refreshNonce ?? 0)
  const n = Number.isFinite(raw) ? Math.max(0, raw) : 0
  const t = Math.min(n, MAX_EXPLORATION_REFRESHES) / MAX_EXPLORATION_REFRESHES

  return {
    noiseAmplitude: NOISE_AMPLITUDE + t * (MAX_NOISE_AMPLITUDE - NOISE_AMPLITUDE),
    epsilon: EPSILON + t * (MAX_EPSILON - EPSILON),
  }
}

/**
 * Repeat-damping multiplier for one restaurant.
 *
 * A restaurant selected `d` days ago scores DAMPING_FLOOR at d=0, rising
 * linearly back to 1.0 at d=DAMPING_DAYS. Only the most recent selection
 * matters — being picked twice last week is not twice as stale.
 *
 * A restaurant the user picks more than DAMPING_EXEMPT_PICK_RATE of the time is
 * exempt: they have told us it is their regular, and suppressing it would be
 * fighting a preference rather than adding variety.
 */
export function dampingFor(
  restaurantId: string,
  recent: RecentSelection[],
  pickRates: Record<string, number>,
  now: Date,
): number {
  if ((pickRates[restaurantId] ?? 0) > DAMPING_EXEMPT_PICK_RATE) return 1

  const lastPick = recent
    .filter((s) => s.restaurantId === restaurantId)
    .reduce<Date | null>(
      (latest, s) => (!latest || s.selectedAt > latest ? s.selectedAt : latest),
      null,
    )

  if (!lastPick) return 1

  const days = (now.getTime() - lastPick.getTime()) / MS_PER_DAY
  if (days >= DAMPING_DAYS || days < 0) return 1

  return DAMPING_FLOOR + (1 - DAMPING_FLOOR) * (days / DAMPING_DAYS)
}

export interface SelectResult {
  chosen: ScoreBreakdown[]
  wildcardUsed: boolean
}

/**
 * Greedy top-3 under a cuisine-diversity constraint.
 *
 * At each slot we prefer the best candidate whose cuisine is not already
 * represented. If every remaining candidate repeats a cuisine we take the best
 * one anyway — diversity is a preference, three results is a rule.
 */
export function selectThree(
  ranked: ScoreBreakdown[],
  random: () => number,
  epsilon: number = EPSILON,
): SelectResult {
  const chosen: ScoreBreakdown[] = []
  const usedCuisines = new Set<string>()
  const remaining = [...ranked]
  let wildcardUsed = false

  // Draw once, up front: the wildcard decision must not depend on how many
  // times earlier slots happened to call random().
  const wildcardRoll = random()

  while (chosen.length < 3 && remaining.length) {
    const isLastSlot = chosen.length === 2
    let index: number

    if (isLastSlot && wildcardRoll < epsilon && remaining.length > 1) {
      // ε-wildcard: any remaining candidate except the obvious top one, so the
      // wildcard is actually a departure rather than sometimes a no-op.
      const pool = remaining.slice(1)
      const fresh = pool.filter(
        (c) => !usedCuisines.has(normalizeCuisine(c.cuisine)),
      )
      const from = fresh.length ? fresh : pool
      const chosenWildcard = from[Math.floor(random() * from.length)] ?? remaining[0]
      index = remaining.indexOf(chosenWildcard)
      wildcardUsed = true
    } else {
      const freshIndex = remaining.findIndex(
        (c) => !usedCuisines.has(normalizeCuisine(c.cuisine)),
      )
      // Fall back to the best remaining when every cuisine is already used.
      index = freshIndex === -1 ? 0 : freshIndex
    }

    const [pick] = remaining.splice(index, 1)
    chosen.push(pick)
    usedCuisines.add(normalizeCuisine(pick.cuisine))
  }

  return { chosen, wildcardUsed }
}

/** Distance-ascending, used for the final ordering when coords are known. */
export function byDistance(a: ScoreBreakdown, b: ScoreBreakdown): number {
  if (a.distanceKm === null && b.distanceKm === null) return b.total - a.total
  if (a.distanceKm === null) return 1
  if (b.distanceKm === null) return -1
  return a.distanceKm - b.distanceKm
}

/** Exposed for the caller that assembles breakdowns. */
export function candidateCuisine(r: Candidate): string {
  return normalizeCuisine(r.cuisineType)
}
