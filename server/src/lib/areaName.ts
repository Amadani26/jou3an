/**
 * Real Dubai neighbourhood names, derived from Google.
 *
 * The `LocationArea` enum only knows five districts, so everything outside
 * them collapses to OTHER — which is most of the city. `areaName` is the
 * human-readable replacement ("Al Satwa", "Mirdif", "Motor City").
 *
 * ⚠️ DISPLAY AND SEARCH ONLY. Nothing filters on this string: the decision
 * engine and the radius ladder run entirely off lat/lng, and they must keep
 * doing so — a free-text area is far too noisy to gate results on.
 */

/** One entry from Places' `addressComponents`. */
export interface AddressComponent {
  longText?: string
  shortText?: string
  types?: string[]
}

/**
 * Component types, most specific first.
 *
 * `locality` is deliberately absent: in Dubai it is almost always the literal
 * string "Dubai", which tells a user nothing they don't already know.
 */
const PREFERRED_TYPES = [
  'neighborhood',
  'sublocality_level_1',
  'sublocality',
  'sublocality_level_2',
  'administrative_area_level_3',
] as const

/** Tokens that are never a useful neighbourhood on their own. */
const USELESS = new Set([
  'dubai',
  'united arab emirates',
  'uae',
  'ae',
  'dubai emirate',
  'emirate of dubai',
])

/** Open Location Code fragment, e.g. "34HR+C32" — never a place name. */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,4}$/i

const isUseless = (s: string) => USELESS.has(s.trim().toLowerCase())

/** Strips a leading plus-code and tidies whitespace/punctuation. */
export function cleanAreaToken(raw: string): string {
  return raw
    .replace(/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,4}\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,\-–\s]+|[,\-–\s]+$/g, '')
    .trim()
}

/**
 * A segment that is plainly a street address or a unit rather than an area.
 *
 * Kept conservative: it is better to show a slightly odd area name than to
 * discard a real one and fall back to "Dubai".
 */
function looksLikeStreetAddress(s: string): boolean {
  if (PLUS_CODE.test(s)) return true
  // "Shop 24", "Level P", "1st Floor", "Unit 4", "Office 210"
  if (/^(shop|unit|level|floor|office|villa|building|bldg|suite|store)\b/i.test(s)) return true
  // Starts with a house/plot number: "12 Al Wasl Road"
  if (/^\d+\s/.test(s) && !/road|street|st\b/i.test(s)) return true
  return false
}

/**
 * Best neighbourhood from Google's structured address components.
 * Returns null when nothing usable is present.
 */
export function areaNameFromComponents(
  components?: AddressComponent[] | null,
): string | null {
  if (!components?.length) return null

  for (const type of PREFERRED_TYPES) {
    for (const c of components) {
      if (!c.types?.includes(type)) continue
      const text = cleanAreaToken(c.longText ?? c.shortText ?? '')
      if (text && !isUseless(text)) return text
    }
  }
  return null
}

/**
 * Fallback: pull the area out of a formatted address.
 *
 * Dubai addresses are dash-separated and go specific → general, e.g.
 *   "The Walk - Dubai Marina - Dubai - United Arab Emirates"
 *   "Al Satwa - Dubai - United Arab Emirates"
 *
 * So after dropping the city/country tokens, the LAST remaining segment is the
 * broadest thing that is still a neighbourhood — which is exactly what we want.
 */
export function areaNameFromFormattedAddress(address?: string | null): string | null {
  if (!address) return null

  const segments = address
    .split(/\s+-\s+|,/)
    .map(cleanAreaToken)
    .filter((s) => s && !isUseless(s) && !looksLikeStreetAddress(s))

  if (!segments.length) return null

  // Walk back from the broadest segment to the first that reads like an area.
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i]
    // A single word of 2 characters or fewer is noise ("B", "G").
    if (s.length <= 2) continue
    return s
  }
  return null
}

/** Components first, formatted address second, null when neither works. */
export function resolveAreaName(
  components?: AddressComponent[] | null,
  formattedAddress?: string | null,
): string | null {
  return (
    areaNameFromComponents(components) ??
    areaNameFromFormattedAddress(formattedAddress) ??
    null
  )
}

/** Old enum value -> a display label, used only when areaName is null. */
export const AREA_ENUM_LABELS: Record<string, string> = {
  JLT: 'JLT',
  DIFC: 'DIFC',
  DOWNTOWN: 'Downtown',
  BUSINESS_BAY: 'Business Bay',
  MARINA: 'Dubai Marina',
  OTHER: 'Dubai',
}

/**
 * What to show for a restaurant's area.
 *
 * Prefers the real neighbourhood; falls back to the deprecated enum's label so
 * a row that has never been synced still reads sensibly.
 */
export function displayArea(r: {
  areaName?: string | null
  area?: string | null
}): string {
  const name = r.areaName?.trim()
  if (name) return name
  return AREA_ENUM_LABELS[r.area ?? 'OTHER'] ?? 'Dubai'
}
