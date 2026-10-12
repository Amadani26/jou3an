/**
 * AED-per-head price bands — the ONE table.
 *
 * Read from three places that must never disagree:
 *   - `priceFit` in the engine's score.ts (how well a restaurant sits inside
 *     the user's budget answer),
 *   - `BUDGET_BANDS` in the engine's filter.ts, which simply re-exports this,
 *   - the `price:` taste dimension in tasteDimensions.ts, which labels every
 *     restaurant with the band it falls in so the profile can learn a spend.
 *
 * ⚠️ SCORING ONLY, in all three. Budget has never been a Stage-1 filter and
 * must not become one — see the long note on BUDGET_BANDS in engine/filter.ts
 * for why a single onboarding answer must not cap every future decision.
 *
 * Boundaries read as the quiz words them: "Under AED 100", "AED 100–200",
 * "AED 200+". The bands touch at 100 and 200, so `bandFor` resolves a midpoint
 * landing exactly on a boundary UPWARD (100 is MID, 200 is HIGH) — a place
 * averaging exactly 100 a head is not what anyone means by "under 100".
 */

export type PriceBand = 'LOW' | 'MID' | 'HIGH'

export const PRICE_BANDS: Record<PriceBand, { min: number; max: number }> = {
  LOW: { min: 0, max: 100 },
  MID: { min: 100, max: 200 },
  HIGH: { min: 200, max: Number.POSITIVE_INFINITY },
}

export const PRICE_BAND_ORDER: PriceBand[] = ['LOW', 'MID', 'HIGH']

/** Midpoint price is the best single proxy for "what this place costs". */
export function midPrice(r: { priceMin: number; priceMax: number }): number {
  return (r.priceMin + r.priceMax) / 2
}

/** Which band a restaurant's own price range falls in. */
export function bandFor(r: { priceMin: number; priceMax: number }): PriceBand {
  const mid = midPrice(r)
  if (mid < PRICE_BANDS.LOW.max) return 'LOW'
  if (mid < PRICE_BANDS.MID.max) return 'MID'
  return 'HIGH'
}
