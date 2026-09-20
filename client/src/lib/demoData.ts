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
  /** 3 photos each, cross-faded like the mobile Tinder card. */
  photos: string[]
}

const u = (id: string) => `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=crop`

export const DEMO_RESTAURANTS: DemoRestaurant[] = [
  {
    id: 'op-falafel',
    name: 'Operation Falafel',
    cuisine: 'Lebanese',
    area: 'JBR',
    priceMin: 30,
    priceMax: 55,
    rating: 4.4,
    distanceKm: 1.2,
    reason: 'Quick · Cheap',
    photos: [
      u('photo-1540189549336-e6e99c3679fe'),
      u('photo-1504674900247-0877df9cc836'),
      u('photo-1432139555190-58524dae6a55'),
    ],
  },
  {
    id: 'salt',
    name: 'Salt',
    cuisine: 'American Burgers',
    area: 'Marina',
    priceMin: 45,
    priceMax: 70,
    rating: 4.5,
    distanceKm: 2.1,
    reason: 'Comfort · High protein',
    photos: [
      u('photo-1555939594-58d7cb561ad1'),
      u('photo-1550547660-d9450f859349'),
      u('photo-1571091718767-18b5b1457add'),
    ],
  },
  {
    id: 'sushi-art',
    name: 'Sushi Art',
    cuisine: 'Japanese',
    area: 'DIFC',
    priceMin: 60,
    priceMax: 110,
    rating: 4.3,
    distanceKm: 3.4,
    reason: 'Healthy · Date night',
    photos: [
      u('photo-1579871494447-9811cf80d66c'),
      u('photo-1553621042-f6e147245754'),
      u('photo-1476224203421-9ac39bcb3327'),
    ],
  },
  {
    id: 'ravi',
    name: 'Ravi Restaurant',
    cuisine: 'Pakistani',
    area: 'Satwa',
    priceMin: 20,
    priceMax: 40,
    rating: 4.2,
    distanceKm: 4.6,
    reason: 'Cheap · Late night',
    photos: [
      u('photo-1585937421612-70a008356fbe'),
      u('photo-1514326640560-7d063ef2aed5'),
      u('photo-1559847844-5315695dadae'),
    ],
  },
  {
    id: 'pitfire',
    name: 'Pitfire Pizza',
    cuisine: 'Pizza',
    area: 'JLT',
    priceMin: 50,
    priceMax: 75,
    rating: 4.4,
    distanceKm: 0.8,
    reason: 'Comfort · Quick',
    photos: [
      u('photo-1565299624946-b28f40a0ae38'),
      u('photo-1513104890138-7c749659a591'),
      u('photo-1473093295043-cdd812d0e601'),
    ],
  },
  {
    id: 'arabian-tea-house',
    name: 'Arabian Tea House',
    cuisine: 'Emirati',
    area: 'Al Fahidi',
    priceMin: 35,
    priceMax: 60,
    rating: 4.5,
    distanceKm: 6.2,
    reason: 'Local · Sit-down',
    photos: [
      u('photo-1512058564366-18510be2db19'),
      u('photo-1567620905732-2d1ec7ab7445'),
      u('photo-1504674900247-0877df9cc836'),
    ],
  },
  {
    id: 'comptoir-102',
    name: 'Comptoir 102',
    cuisine: 'Healthy',
    area: 'Jumeirah',
    priceMin: 60,
    priceMax: 90,
    rating: 4.4,
    distanceKm: 5.1,
    reason: 'Healthy · Light',
    photos: [
      u('photo-1546069901-ba9599a7e63c'),
      u('photo-1512621776951-a57141f2eefd'),
      u('photo-1540189549336-e6e99c3679fe'),
    ],
  },
  {
    id: 'zaroob',
    name: 'Zaroob',
    cuisine: 'Levantine Street Food',
    area: 'Sheikh Zayed Rd',
    priceMin: 25,
    priceMax: 50,
    rating: 4.3,
    distanceKm: 3.9,
    reason: 'Cheap · Late night',
    photos: [
      u('photo-1529006557810-274b9b2fc783'),
      u('photo-1482049016688-2d3e1b311543'),
      u('photo-1432139555190-58524dae6a55'),
    ],
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
    return n + r.rating / 2
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
