/**
 * LIVE restaurant data for the marketing page — the one place it talks to
 * the Jou3an API.
 *
 * ⚠️ THE ZERO-RISK RULE FOR VENUE IDENTITIES WAS DELIBERATELY REVERSED
 * (owner's decision, 2026-11-02): real restaurants may now appear on the
 * page, under a strict NO-INVENTED-DATA rule — real Google ratings (shown
 * with "Google" attribution) or no score at all, real price ranges or
 * none, and the engine's own anonymous reason lines. The server side is
 * /api/public/* : read-only, rate-limited, no DB writes, excluded from
 * analytics and taste learning.
 *
 * EVERY caller must survive this module answering null: the page prerenders
 * with neutral placeholders and falls back to the generic-dish content
 * (src/lib/dishes.ts) when the API is unreachable — the old zero-risk page
 * IS the fallback.
 *
 * Fetches are memoised per visit: one showcase call, one call per demo
 * area, shared by every section.
 */

const API =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'https://server-production-0599.up.railway.app'

export interface LivePick {
  id: string
  placeId: string | null
  name: string
  cuisine: string
  area: string
  priceMin: number | null
  priceMax: number | null
  rating: number | null
  ratingCount: number | null
  reason: string
}

export interface DemoResult extends LivePick {
  distanceKm: number | null
  hasPhoto: boolean
  photoAuthor: { name: string; uri: string | null } | null
}

export interface Showcase {
  picks: LivePick[]
  wall: LivePick[]
}

export interface DemoPayload {
  area: string
  label: string
  results: DemoResult[]
}

/** The demo's area chips — fixed, matching the server's centroids. */
export const DEMO_AREAS = [
  { key: 'MARINA', label: 'Marina' },
  { key: 'DOWNTOWN', label: 'Downtown' },
  { key: 'JLT', label: 'JLT' },
  { key: 'DIFC', label: 'DIFC' },
  { key: 'BUSINESS_BAY', label: 'Business Bay' },
  { key: 'JBR', label: 'JBR' },
] as const

async function get<T>(path: string): Promise<T | null> {
  try {
    const ctl = new AbortController()
    const timer = window.setTimeout(() => ctl.abort(), 5000)
    const res = await fetch(`${API}${path}`, { signal: ctl.signal })
    window.clearTimeout(timer)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

let showcaseP: Promise<Showcase | null> | null = null
export function getShowcase(): Promise<Showcase | null> {
  showcaseP ??= get<Showcase>('/api/public/showcase').then((d) =>
    d && Array.isArray(d.picks) && d.picks.length === 3 ? d : null,
  )
  return showcaseP
}

const demoP = new Map<string, Promise<DemoPayload | null>>()
export function getDemo(area: string): Promise<DemoPayload | null> {
  if (!demoP.has(area)) {
    demoP.set(
      area,
      get<DemoPayload>(`/api/public/demo?area=${encodeURIComponent(area)}`).then(
        (d) => (d && Array.isArray(d.results) && d.results.length === 3 ? d : null),
      ),
    )
  }
  return demoP.get(area)!
}

/** The ~400px live photo for a demo card. Browser-only; nothing is stored. */
export const demoPhotoUrl = (placeId: string) =>
  `${API}/api/public/demo-photo/${encodeURIComponent(placeId)}`

/** "AED 60–85", or null when the catalogue holds no honest price. */
export const priceLabel = (p: { priceMin: number | null; priceMax: number | null }) =>
  p.priceMin != null && p.priceMax != null ? `AED ${p.priceMin}–${p.priceMax}` : null

/** "cuisine · area · AED 60–85" with the price omitted when unknown. The
 *  area is bidi-ISOLATED (FSI…PDI): some real neighbourhood names come back
 *  in Arabic, and without isolation the RTL run scrambles the whole line. */
export const metaLine = (p: LivePick) =>
  [p.cuisine, '\u2068' + p.area + '\u2069', priceLabel(p)].filter(Boolean).join(' · ')

/** The cuisine colour fields real-name cards use instead of stock photos. */
const CUISINE_TONES: Record<string, string> = {
  lebanese: '#8a6a3b',
  japanese: '#7d4646',
  american: '#6f4a33',
  pakistani: '#80592b',
  italian: '#5f6b3a',
  healthy: '#3f6b55',
  turkish: '#74402e',
  emirati: '#5a5f8c',
  indian: '#8c5a2b',
  thai: '#4f7355',
  vietnamese: '#476a6a',
  chinese: '#753f4e',
  mexican: '#7a6230',
  french: '#5d4a6b',
  international: '#565d52',
  'middle eastern': '#8a6a3b',
  greek: '#3f5e6b',
  spanish: '#7a4a3a',
  korean: '#6b4a5e',
  seafood: '#3f566b',
}
export const cuisineTone = (cuisine: string) =>
  CUISINE_TONES[cuisine.toLowerCase()] ?? '#50524e'
