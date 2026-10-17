/**
 * Hardcoded sample data for the interactive app preview on the landing page.
 * Deliberately self-contained: the demo makes ZERO network calls so the
 * landing page works standalone (Vercel) with the API offline.
 * Mirrors the shape of the real `Restaurant` model closely enough that the
 * cards match the mobile app's layout.
 */

export type DemoCuisine = {
  /** Matches the mobile Decide screen's cuisine list. */
  name: string
  descriptor: string
  /** lucide-react icon name, resolved in AppPreview. */
  icon: 'flame' | 'fish' | 'burger' | 'curry' | 'moon' | 'leaf' | 'pizza' | 'noodles'
}

export const DEMO_CUISINES: DemoCuisine[] = [
  { name: 'Lebanese', descriptor: 'Mezze & Grills', icon: 'flame' },
  { name: 'Japanese', descriptor: 'Sushi & Ramen', icon: 'fish' },
  { name: 'American', descriptor: 'Burgers & Comfort', icon: 'burger' },
  { name: 'Pakistani', descriptor: 'Curries & Rice', icon: 'curry' },
  { name: 'Emirati', descriptor: 'Local & Traditional', icon: 'moon' },
  { name: 'Healthy', descriptor: 'Clean & Light', icon: 'leaf' },
  { name: 'Pizza', descriptor: 'Wood-fired', icon: 'pizza' },
  { name: 'Asian', descriptor: 'Pan-Asian Fusion', icon: 'noodles' },
]

export type DemoRestaurant = {
  id: string
  name: string
  cuisine: string
  area: string
  priceMin: number
  priceMax: number
  rating: number
  distanceKm: number
  /** Reasoning pill copy — the "why this one" line. */
  reason: string
  /** Local, licensed dish imagery — see client/ASSET_CREDITS.md. */
  photos: string[]
}

/*
 * ⚠️ ZERO-RISK: the demo's sample pool is GENERIC DISHES, not businesses.
 * It used to be eight REAL Dubai restaurants with Unsplash photos implicitly
 * presented as their food — a real identity plus a photo that is not theirs,
 * which is exactly the pattern the rule forbids. The live API demo may show
 * real venues; THIS file is baked sample data, so it may not.
 *
 * Photos are our licensed Pexels set (client/ASSET_CREDITS.md), served
 * locally — the demo no longer fetches anything from Unsplash. `rating` is
 * our own 0-10 score and is used by the scorer only (never rendered as a
 * third-party badge).
 */
const dish = (photo: string) => `/brand/dishes/${photo}.webp`

export const DEMO_RESTAURANTS: DemoRestaurant[] = [
  {
    id: 'shawarma',
    name: 'Chicken shawarma',
    cuisine: 'Lebanese',
    area: 'JBR',
    priceMin: 20,
    priceMax: 35,
    rating: 9.1,
    distanceKm: 1.2,
    reason: 'Quick · Cheap',
    photos: [dish('shawarma')],
  },
  {
    id: 'burger',
    name: 'Smash burger',
    cuisine: 'American Burgers',
    area: 'Marina',
    priceMin: 45,
    priceMax: 65,
    rating: 8.8,
    distanceKm: 2.1,
    reason: 'Comfort · Close by',
    photos: [dish('burger')],
  },
  {
    id: 'sushi',
    name: 'Salmon nigiri set',
    cuisine: 'Japanese',
    area: 'DIFC',
    priceMin: 120,
    priceMax: 180,
    rating: 9.4,
    distanceKm: 4.4,
    reason: 'Date night',
    photos: [dish('sushi')],
  },
  {
    id: 'biryani',
    name: 'Chicken biryani',
    cuisine: 'Pakistani',
    area: 'Downtown',
    priceMin: 25,
    priceMax: 40,
    rating: 9.0,
    distanceKm: 3.0,
    reason: 'Big portions',
    photos: [dish('biryani')],
  },
  {
    id: 'pizza',
    name: 'Margherita pizza',
    cuisine: 'Pizza',
    area: 'JLT',
    priceMin: 55,
    priceMax: 75,
    rating: 8.9,
    distanceKm: 1.8,
    reason: 'Wood-fired',
    photos: [dish('pizza')],
  },
  {
    id: 'poke',
    name: 'Poke bowl',
    cuisine: 'Healthy',
    area: 'Jumeirah',
    priceMin: 55,
    priceMax: 80,
    rating: 8.6,
    distanceKm: 2.6,
    reason: 'Clean & light',
    photos: [dish('salad')],
  },
  {
    id: 'ramen',
    name: 'Tonkotsu ramen',
    cuisine: 'Japanese',
    area: 'Downtown',
    priceMin: 60,
    priceMax: 85,
    rating: 9.2,
    distanceKm: 3.4,
    reason: 'Late night',
    photos: [dish('ramen')],
  },
  {
    id: 'skewers',
    name: 'Lamb kebab skewers',
    cuisine: 'Emirati & Grills',
    area: 'Jumeirah',
    priceMin: 70,
    priceMax: 110,
    rating: 8.7,
    distanceKm: 3.8,
    reason: 'For the table',
    photos: [dish('skewers')],
  },
]

/** Dubai areas offered by the demo's "Pick an area" step. */
export const DEMO_AREAS = [
  'JLT',
  'DIFC',
  'Marina',
  'JBR',
  'Downtown',
  'Jumeirah',
] as const

export type DecisionFilters = {
  /** null = "Anywhere in Dubai" / "Nearby" — no area constraint. */
  area: string | null
  cuisines: string[]
  format: 'Delivery' | 'Dine In'
  vibe: 'Casual' | 'Fancy'
}

/**
 * The demo's stand-in for `server/src/services/decisionEngine.ts`: score every
 * restaurant against the brief, take the top 3.
 *
 * Scoring is soft on purpose — a filter that matches nothing must still return
 * three, because "always exactly 3" is a product rule, not a best-effort.
 */
export function decideThree(filters: DecisionFilters): DemoRestaurant[] {
  const { area, cuisines, format, vibe } = filters

  const score = (r: DemoRestaurant) => {
    let n = 0
    if (cuisines.length && matchesCuisine(r, cuisines)) n += 5
    if (area && r.area === area) n += 3
    // Fancy leans to the pricier end of the list, casual to the cheaper.
    n += vibe === 'Fancy' ? r.priceMax / 40 : (120 - r.priceMax) / 40
    // Delivery favours the quick, close options.
    if (format === 'Delivery') n += (8 - r.distanceKm) / 4
    return n + r.rating / 4
  }

  return [...DEMO_RESTAURANTS].sort((a, b) => score(b) - score(a)).slice(0, 3)
}

function matchesCuisine(r: DemoRestaurant, cuisines: string[]) {
  return cuisines.some((c) => r.cuisine.toLowerCase().includes(c.toLowerCase()))
}

/**
 * The "why this one" pill. Built from the brief rather than stored on the
 * restaurant, so the reasoning visibly reflects what the user just picked.
 */
export function reasonFor(r: DemoRestaurant, filters: DecisionFilters): string {
  const parts: string[] = []

  const hit = filters.cuisines.find((c) =>
    r.cuisine.toLowerCase().includes(c.toLowerCase()),
  )
  if (hit) parts.push(hit)

  if (filters.area && r.area === filters.area) parts.push(`In ${r.area}`)
  else if (filters.format === 'Delivery') parts.push(`${r.distanceKm} km away`)

  parts.push(filters.vibe)
  return parts.slice(0, 3).join(' · ')
}
