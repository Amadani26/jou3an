/**
 * Bar/lounge detection for the PUBLIC marketing endpoints.
 *
 * The website leads with "Jou3an decides restaurants": a cocktail bar as
 * the hero pick undercuts the pitch (and reads oddly next to a food
 * brief), so /api/public/* filters these out of its pools. ⚠️ Marketing
 * surface only — the APP still serves them: a bar that passes the
 * servable gate is a legitimate dinner answer in-product, and this
 * helper must not leak into the engine or the app routes.
 *
 * Two signals, matching the owner's spec:
 *   - Google taxonomy: primaryType or any stored type in BAR_TYPES
 *   - the NAME contains "Bar" or "Lounge" as a word (word-bounded, so
 *     "Barsha", "Barbecue" and "Mandi Bariis" never match)
 */

const BAR_TYPES = new Set([
  'bar',
  'cocktail_bar',
  'wine_bar',
  'pub',
  'night_club',
  'lounge',
])

const BAR_NAME_RE = /\b(bar|lounge)\b/i

export function isBarLike(r: {
  name: string
  googlePrimaryType?: string | null
  googleTypes?: string[] | null
}): boolean {
  const primary = r.googlePrimaryType?.toLowerCase()
  if (primary && BAR_TYPES.has(primary)) return true
  if ((r.googleTypes ?? []).some((t) => BAR_TYPES.has(t.toLowerCase()))) return true
  return BAR_NAME_RE.test(r.name)
}
