/**
 * Restaurant price display — pure, so the lib-scoped tests can reach it.
 *
 * ⚠️ NULL IS A REAL ANSWER (migration `price_optional`): a row Google has no
 * price signal for stores null, and every surface HIDES the AED segment and
 * its separator — the phone/rating/description rule. The old behaviour was an
 * invented AED 45–100 displayed as if real; nothing may fall back to a guessed
 * range again, so this helper returns null, never a placeholder string.
 */
export function aedRange(
  r?: { priceMin?: number | null; priceMax?: number | null } | null,
): string | null {
  if (!r || r.priceMin == null || r.priceMax == null) return null
  return `AED ${r.priceMin}–${r.priceMax}`
}
