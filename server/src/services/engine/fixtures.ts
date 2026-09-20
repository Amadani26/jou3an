/**
 * Test fixtures for DecisionEngine v2.
 *
 * Not a .test.ts file so it can be imported by several suites without vitest
 * trying to collect it as a suite of its own.
 */
import type { Candidate, EngineContext, EngineInput } from './types'

/** Dubai Marina, roughly. */
export const MARINA = { lat: 25.0805, lng: 55.1403 }
/** DIFC, ~9 km from Marina — lands in the WIDER tier, not NEARBY. */
export const DIFC = { lat: 25.2084, lng: 55.2739 }
/** Hatta, ~100 km out — always outside every radius tier. */
export const FAR = { lat: 24.7997, lng: 56.1216 }

let seq = 0

/**
 * A Restaurant with sane defaults. Open 24/7 unless `openingHours` is
 * overridden, so hours never accidentally become the thing under test.
 */
export function restaurant(over: Partial<Candidate> = {}): Candidate {
  seq += 1
  const base = {
    id: `r${seq}`,
    name: `Restaurant ${seq}`,
    cuisineType: 'Lebanese',
    area: 'MARINA',
    priceMin: 40,
    priceMax: 80,
    phone: null,
    googleMapsUrl: null,
    talabatUrl: null,
    noonUrl: null,
    deliverooUrl: null,
    isActive: true,
    isFeatured: false,
    tags: [] as string[],
    ratingScore: 8,
    averageCalories: null,
    googlePlaceId: null,
    photoRefs: [] as string[],
    lat: MARINA.lat,
    lng: MARINA.lng,
    googleRating: 4.2,
    // Open 24/7 — a period with no close, in Google's encoding.
    openingHours: [{ open: { day: 0, hour: 0, minute: 0 } }],
    googleSyncedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }
  return { ...base, ...over } as Candidate
}

/** Resets the id counter so ids are stable within a suite. */
export function resetIds() {
  seq = 0
}

export function context(over: Partial<EngineContext> = {}): EngineContext {
  return {
    formatFilter: 'ANY',
    vibe: 'ANY',
    budget: 'ANY',
    date: new Date('2026-09-21T12:00:00Z'), // Mon 16:00 Dubai
    ...over,
  }
}

export function input(over: Partial<EngineInput> = {}): EngineInput {
  return {
    candidates: over.candidates ?? [restaurant(), restaurant(), restaurant()],
    tasteWeights: {},
    context: context(),
    userId: 'user-1',
    ...over,
  }
}

/** Ten varied restaurants — the pool the golden scenarios draw from. */
export function catalogue(): Candidate[] {
  resetIds()
  return [
    restaurant({
      name: 'Marina Burger Co',
      cuisineType: 'American Burgers',
      tags: ['comfort-food', 'quick'],
      priceMin: 45,
      priceMax: 70,
      googleRating: 4.5,
      talabatUrl: 'https://talabat.example/1',
      ...MARINA,
    }),
    restaurant({
      name: 'Smokehouse Marina',
      cuisineType: 'American Burgers',
      tags: ['comfort-food', 'high-protein'],
      priceMin: 55,
      priceMax: 95,
      googleRating: 4.3,
      ...MARINA,
    }),
    restaurant({
      name: 'Beirut Table',
      cuisineType: 'Lebanese',
      tags: ['comfort-food'],
      priceMin: 35,
      priceMax: 65,
      googleRating: 4.4,
      lat: MARINA.lat + 0.01,
      lng: MARINA.lng + 0.01,
    }),
    restaurant({
      name: 'Sushi Counter',
      cuisineType: 'Japanese',
      tags: ['healthy', 'date-night'],
      priceMin: 70,
      priceMax: 130,
      googleRating: 4.1,
      lat: MARINA.lat + 0.02,
      lng: MARINA.lng,
    }),
    restaurant({
      name: 'Green Bowl',
      cuisineType: 'Healthy',
      tags: ['healthy', 'quick'],
      priceMin: 30,
      priceMax: 55,
      googleRating: 4.0,
      deliverooUrl: 'https://deliveroo.example/5',
      lat: MARINA.lat - 0.01,
      lng: MARINA.lng,
    }),
    restaurant({
      name: 'DIFC Fine Dining',
      cuisineType: 'French',
      tags: ['date-night'],
      priceMin: 180,
      priceMax: 320,
      googleRating: 4.7,
      ...DIFC,
    }),
    restaurant({
      name: 'DIFC Sushi Bar',
      cuisineType: 'Japanese',
      tags: ['date-night'],
      priceMin: 120,
      priceMax: 220,
      googleRating: 4.6,
      ...DIFC,
    }),
    restaurant({
      name: 'Karama Curry House',
      cuisineType: 'Pakistani',
      tags: ['cheap', 'late-night'],
      priceMin: 20,
      priceMax: 40,
      googleRating: 4.2,
      ...DIFC,
    }),
    restaurant({
      name: 'Hatta Roadside',
      cuisineType: 'Emirati',
      tags: ['local'],
      priceMin: 30,
      priceMax: 60,
      googleRating: 3.9,
      ...FAR,
    }),
    restaurant({
      name: 'Pizza Yard',
      cuisineType: 'Pizza',
      tags: ['comfort-food'],
      priceMin: 50,
      priceMax: 85,
      googleRating: 4.2,
      noonUrl: 'https://noon.example/10',
      lat: MARINA.lat,
      lng: MARINA.lng + 0.02,
    }),
  ]
}
