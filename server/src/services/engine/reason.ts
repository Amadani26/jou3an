/**
 * DecisionEngine v2 — Stage 4: one line explaining each pick.
 *
 * Derived from the winning scoring component, so the sentence is always a true
 * statement about why this restaurant outranked the others rather than
 * decorative copy.
 */
import type { Candidate, ScoreBreakdown, TasteContribution } from './types'

/** Title Case for display: "modern emirati" -> "Modern Emirati". */
function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** `tag:date-night` -> "date night". Tags are lower-case by storage. */
function dimensionLabel(c: TasteContribution): string {
  const value = c.key.slice(c.key.indexOf(':') + 1)
  return value.replace(/[-_]+/g, ' ').trim()
}

/**
 * The dimension to credit when taste wins: the strongest POSITIVE one.
 *
 * Contributions are ordered by magnitude, so the first entry can be a heavy
 * negative on a restaurant that won anyway (its other dimensions carried it) —
 * and "you love X" is the one thing we must not say about a dimension the user
 * has been swiping away from.
 */
function topPositive(dimensions: TasteContribution[] = []): TasteContribution | null {
  return dimensions.find((d) => d.weight > 0) ?? null
}

export function buildReason(
  restaurant: Candidate,
  breakdown: ScoreBreakdown,
  opts: { vibe: string; wildcard: boolean },
): string {
  const cuisine = titleCase(restaurant.cuisineType)

  if (opts.wildcard) return `Something different — ${cuisine}`

  switch (breakdown.topComponent) {
    case 'taste': {
      // ⚠️ Safe to state as a habit, and it was not always. While an explicitly
      // requested cuisine was folded into the taste weights at full strength
      // (the deleted `boostedTasteWeights`), this line fired on a first-ever
      // anonymous query and claimed a history that did not exist — which is why
      // the engine used to carry `requestedCuisines` purely to word around it.
      // A requested cuisine is a Stage-1 FILTER now and touches no score, so a
      // dominant taste term can only have been learned.
      //
      // Taste Vector v2: the line names the DIMENSION that actually won, which
      // is the whole point of having more than one. "You keep going back to
      // Japanese" was the only sentence the old profile could ever produce,
      // even when what the user really kept going back to was steakhouses.
      const top = topPositive(breakdown.tasteDimensions)
      if (top?.namespace === 'tag') return `Right up your alley for ${dimensionLabel(top)}`
      if (top?.namespace === 'price') return `The kind of spend you usually go for`
      return `You keep going back to ${cuisine}`
    }

    case 'quality': {
      // ⚠️ Deliberately does NOT reprint the score. The cards now carry
      // Google's rating as a badge on the photo, so "4.9 on Google" in the
      // pill directly beneath it was the same fact twice — and the pill's job
      // is to say WHY this one, which the number alone never did.
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

/** Appends distance when we know it, e.g. "Easy, casual Thai · 1.2 km". */
export function withDistance(reason: string, distanceKm: number | null): string {
  return distanceKm === null ? reason : `${reason} · ${distanceKm} km`
}
