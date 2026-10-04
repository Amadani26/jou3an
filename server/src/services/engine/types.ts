/** DecisionEngine v2 — shared types. */
import type { Restaurant } from '@prisma/client'
import type { TasteWeights } from '../tasteProfile'

export type FormatFilter = 'DELIVERY' | 'DINE_IN' | 'ANY'
export type Vibe = 'CASUAL' | 'FANCY' | 'ANY'
export type Budget = 'LOW' | 'MID' | 'HIGH' | 'ANY'
export type RadiusTier = 'NEARBY' | 'WIDER' | 'CITY'

/** Which scoring component justified a pick — drives the reason line. */
export type ReasonComponent = 'quality' | 'taste' | 'context' | 'wildcard'

/**
 * A restaurant the engine may choose. Coordinates and rating are optional
 * because the Places sync does not reach every row.
 */
export type Candidate = Restaurant

/** One of the user's recent picks, used for repeat-damping. */
export interface RecentSelection {
  restaurantId: string
  selectedAt: Date
}

export interface EngineContext {
  formatFilter: FormatFilter
  vibe: Vibe
  budget: Budget
  /** Present only when the caller knows where the user is. */
  lat?: number | null
  lng?: number | null
  /**
   * Cuisines the user explicitly picked this query — a HARD Stage-1 filter,
   * applied as a UNION (pick Japanese and Pizza and you get only Japanese and
   * Pizza). Empty or omitted means no cuisine preference: the full pool.
   *
   * ⚠️ This used to be a taste BOOST rather than a filter (the deleted
   * `boostedTasteWeights`), on the theory that filtering would trip the
   * relaxation ladder. It does not, and the boost was the wrong answer anyway:
   * a user who taps "Japanese" and is handed two non-Japanese cards has had
   * their one explicit instruction overruled by a scoring weight they cannot
   * see. Asking for a cuisine is the clearest signal the app ever receives, so
   * it is honoured literally — see filterCandidates for where the radius ladder
   * widens (5 -> 10 -> city) rather than letting this filter break.
   */
  cuisines?: string[]
  /**
   * Restaurants already shown for THIS brief, which Refresh accumulates. Hard
   * and per-call: they are removed from the pool before selection, so a tap on
   * Refresh is a promise of genuinely new cards rather than a re-roll that may
   * return the same place. When honouring them would leave fewer than three
   * candidates the set is dropped wholesale and `cycled` is set — see
   * filterCandidates.
   */
  excludeIds?: string[]
  /**
   * Dietary needs declared by the user (the onboarding quiz's "avoid" step).
   * Applied as a Stage-1 EXCLUSION — see src/lib/dietary.ts, which documents
   * at length what the available data can and cannot actually enforce.
   */
  dietary?: string[]
  /**
   * This user's BASE wildcard ε, from their adventurousness answer
   * (0.05 / 0.15 / 0.30). Omitted means the engine default — so anonymous
   * callers and users who skipped the quiz behave exactly as before.
   */
  baseEpsilon?: number
  /** "Now" — injected so tests and replays are deterministic. */
  date: Date
  /**
   * Changes the deterministic noise without changing the day, so a Refresh tap
   * reshuffles while the same request twice returns the same 3.
   */
  refreshNonce?: string | number
}

export interface EngineInput {
  candidates: Candidate[]
  tasteWeights: TasteWeights
  context: EngineContext
  /** Null/anonymous is fine — it only affects the seed and damping. */
  userId?: string | null
  /** The user's recent SELECTs. Empty for anonymous callers. */
  recentSelections?: RecentSelection[]
  /**
   * How often this user has historically picked each restaurant, as a fraction
   * of all their selections. Restaurants above `DAMPING_EXEMPT_PICK_RATE` are
   * exempt from repeat-damping — a genuine favourite should not be suppressed
   * for being a favourite.
   */
  pickRates?: Record<string, number>
}

/** Full per-candidate score breakdown; every candidate that survives Stage 1. */
export interface ScoreBreakdown {
  restaurantId: string
  name: string
  cuisine: string
  /** Normalised [0,1] components, before weighting. */
  quality: number
  taste: number
  context: number
  /** Weighted sum of the three, before damping and noise. */
  base: number
  /** Repeat-damping multiplier in (0,1]; 1 means undamped. */
  damping: number
  /** Deterministic tie-break jitter that was added. */
  noise: number
  /** Final ranked score. */
  total: number
  /** Which component contributed most, relative to a neutral 0.5 baseline. */
  topComponent: ReasonComponent
  distanceKm: number | null
}

export interface Pick {
  restaurant: Candidate
  rank: number
  reason: string
  breakdown: ScoreBreakdown
  distanceKm: number | null
}

/** Always exactly three — the product rule, encoded in the type. */
export type Decision3 = {
  picks: [Pick, Pick, Pick]
  radiusKm: number | null
  radiusTier: RadiusTier
  /** Constraints that had to be dropped to reach three candidates. */
  relaxed: string[]
  /** Every surviving candidate's breakdown, for DecisionLog. */
  breakdown: ScoreBreakdown[]
  seed: number
  /** True when slot 3 was the ε-wildcard rather than the next-best pick. */
  wildcardUsed: boolean
  /**
   * True when `context.excludeIds` had to be abandoned to field three picks:
   * the user has seen everything this brief can offer and we are back at the
   * top. The client says so quietly once rather than pretending these are new.
   */
  cycled: boolean
}
