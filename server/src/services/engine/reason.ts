/**
 * DecisionEngine v2 — Stage 4: one line explaining each pick.
 *
 * Derived from the winning scoring component, so the sentence is always a true
 * statement about why this restaurant outranked the others rather than
 * decorative copy.
 */
import type { Candidate, ScoreBreakdown } from './types'

/** Title Case for display: "modern emirati" -> "Modern Emirati". */
function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function buildReason(
  restaurant: Candidate,
  breakdown: ScoreBreakdown,
  opts: { vibe: string; wildcard: boolean },
): string {
  const cuisine = titleCase(restaurant.cuisineType)

  if (opts.wildcard) return `Something different — ${cuisine}`

  switch (breakdown.topComponent) {
    case 'taste':
      // ⚠️ Safe to state as a habit now, and it was not always. While an
      // explicitly requested cuisine was folded into the taste weights at full
      // strength (the deleted `boostedTasteWeights`), this line fired on a
      // first-ever anonymous query and claimed a history that did not exist —
      // which is why the engine used to carry `requestedCuisines` purely to
      // word around it. A requested cuisine is a Stage-1 FILTER now and touches
      // no score, so a dominant taste term can only have been learned.
      return `You keep going back to ${cuisine}`

    case 'quality': {
      if (typeof restaurant.googleRating === 'number' && restaurant.googleRating > 0) {
        return `${restaurant.googleRating.toFixed(1)} on Google`
      }
      return `One of the better-rated ${cuisine} spots`
    }

    case 'context': {
      if (opts.vibe === 'FANCY') return `Worth dressing up for`
      if (opts.vibe === 'CASUAL') return `Easy, casual ${cuisine}`
      return `AED ${restaurant.priceMin}–${restaurant.priceMax} a head`
    }

    default:
      return cuisine
  }
}

/** Appends distance when we know it, e.g. "4.4 on Google · 1.2 km". */
export function withDistance(reason: string, distanceKm: number | null): string {
  return distanceKm === null ? reason : `${reason} · ${distanceKm} km`
}
