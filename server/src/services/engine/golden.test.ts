import { describe, expect, it } from 'vitest'
import { decide } from './index'
import { isOpenNow } from '../../lib/hours'
import { DIFC, MARINA, catalogue, context, input, resetIds, restaurant } from './fixtures'
import type { Decision3 } from './types'

/**
 * Golden scenarios.
 *
 * These assert PROPERTIES, not specific restaurants. Pinning exact names would
 * make every future weight tweak look like a regression, which is the fastest
 * way to get a test suite ignored. What must hold is the contract: three
 * results, open, in range, diverse, ordered, explained.
 */

const names = (d: Decision3) => d.picks.map((p) => p.restaurant.name)
const cuisines = (d: Decision3) =>
  new Set(d.picks.map((p) => p.restaurant.cuisineType.toLowerCase()))

/** Every property that must hold for ANY decision, whatever the brief. */
function expectUniversalInvariants(d: Decision3, at: Date) {
  // The product rule.
  expect(d.picks).toHaveLength(3)
  expect(new Set(d.picks.map((p) => p.restaurant.id)).size).toBe(3)

  for (const p of d.picks) {
    // Never serve a de-listed or shut restaurant unless Stage 1 said it had to.
    if (!d.relaxed.includes('isActive')) expect(p.restaurant.isActive).toBe(true)
    if (!d.relaxed.includes('hours')) expect(isOpenNow(p.restaurant, at)).toBe(true)

    // Every pick is explained and ranked.
    expect(p.reason.trim().length).toBeGreaterThan(0)
    expect(p.rank).toBeGreaterThanOrEqual(1)
    expect(p.rank).toBeLessThanOrEqual(3)
  }

  expect(d.picks.map((p) => p.rank)).toEqual([1, 2, 3])
}

describe('golden 1 — Marina casual burger lover', () => {
  const at = new Date('2026-09-21T12:00:00Z') // Mon 16:00 Dubai

  const decision = () =>
    decide(
      input({
        candidates: catalogue(),
        tasteWeights: { 'american burgers': 8, 'comfort-food': 4 },
        context: context({ ...MARINA, vibe: 'CASUAL', budget: 'MID', date: at }),
        userId: 'burger-lover',
      }),
    )

  it('returns 3 open restaurants', () => {
    expectUniversalInvariants(decision(), at)
  })

  it('returns at least 2 distinct cuisines', () => {
    expect(cuisines(decision()).size).toBeGreaterThanOrEqual(2)
  })

  it('is ordered nearest-first', () => {
    const d = decision()
    const km = d.picks.map((p) => p.distanceKm!)
    expect([...km].sort((a, b) => a - b)).toEqual(km)
  })

  it('stays inside the NEARBY tier', () => {
    const d = decision()
    expect(d.radiusTier).toBe('NEARBY')
    for (const p of d.picks) expect(p.distanceKm!).toBeLessThanOrEqual(5)
  })

  it('surfaces the loved cuisine somewhere in the three', () => {
    const d = decision()
    // Taste is 40% of the score; an 8/10 weight should be visible.
    if (!d.wildcardUsed) {
      expect([...cuisines(d)].some((c) => c.includes('burger'))).toBe(true)
    }
  })
})

describe('golden 2 — DIFC fancy date night', () => {
  const at = new Date('2026-09-25T16:00:00Z') // Fri 20:00 Dubai

  const d = () =>
    decide(
      input({
        candidates: catalogue(),
        tasteWeights: {},
        context: context({ ...DIFC, vibe: 'FANCY', budget: 'HIGH', date: at }),
        userId: 'date-night',
      }),
    )

  it('returns 3 open restaurants', () => {
    expectUniversalInvariants(d(), at)
  })

  it('leans expensive for a FANCY high-budget brief', () => {
    const decision = d()
    const midPrices = decision.picks.map(
      (p) => (p.restaurant.priceMin + p.restaurant.priceMax) / 2,
    )
    // At least one genuinely upmarket option, not three cheap eats.
    expect(Math.max(...midPrices)).toBeGreaterThan(120)
  })

  it('is ordered nearest-first from DIFC', () => {
    const km = d().picks.map((p) => p.distanceKm!)
    expect([...km].sort((a, b) => a - b)).toEqual(km)
  })
})

describe('golden 3 — late-night delivery, most places shut', () => {
  // Tue 2026-09-22 22:00 UTC == Wed 02:00 Dubai.
  const at = new Date('2026-09-22T22:00:00Z')

  /** Only the 24/7 places and a genuine late-night kitchen are open at 02:00. */
  function lateNightCatalogue() {
    resetIds()
    const nineToFive = [{ open: { day: 3, hour: 9 }, close: { day: 3, hour: 17 } }]
    return [
      restaurant({
        name: 'Night Shawarma',
        cuisineType: 'Lebanese',
        openingHours: [{ open: { day: 2, hour: 18 }, close: { day: 3, hour: 4 } }],
        talabatUrl: 'https://t.example/a',
        priceMin: 20,
        priceMax: 40,
      }),
      restaurant({
        name: 'All Night Diner',
        cuisineType: 'American Burgers',
        // No close => 24/7.
        openingHours: [{ open: { day: 0, hour: 0, minute: 0 } }],
        noonUrl: 'https://n.example/b',
        priceMin: 35,
        priceMax: 60,
      }),
      restaurant({
        name: '24h Curry',
        cuisineType: 'Pakistani',
        openingHours: [{ open: { day: 0, hour: 0, minute: 0 } }],
        deliverooUrl: 'https://d.example/c',
        priceMin: 25,
        priceMax: 45,
      }),
      restaurant({ name: 'Daytime Cafe', cuisineType: 'Healthy', openingHours: nineToFive }),
      restaurant({ name: 'Lunch Only', cuisineType: 'Pizza', openingHours: nineToFive }),
    ]
  }

  const d = () =>
    decide(
      input({
        candidates: lateNightCatalogue(),
        context: context({ ...MARINA, formatFilter: 'DELIVERY', budget: 'LOW', date: at }),
        userId: 'night-owl',
      }),
    )

  it('returns 3 restaurants that are genuinely open at 02:00', () => {
    const decision = d()
    expectUniversalInvariants(decision, at)
    for (const p of decision.picks) expect(isOpenNow(p.restaurant, at)).toBe(true)
  })

  it('excludes the daytime-only places entirely', () => {
    expect(names(d())).not.toContain('Daytime Cafe')
    expect(names(d())).not.toContain('Lunch Only')
  })

  it('returns only places that actually deliver', () => {
    for (const p of d().picks) {
      expect(
        Boolean(p.restaurant.talabatUrl || p.restaurant.noonUrl || p.restaurant.deliverooUrl),
      ).toBe(true)
    }
  })
})

describe('golden 4 — brand-new anonymous user, no taste, no location', () => {
  const at = new Date('2026-09-21T12:00:00Z')

  const d = () =>
    decide(
      input({
        candidates: catalogue(),
        tasteWeights: {},
        context: context({ date: at }),
        userId: null,
        recentSelections: [],
        pickRates: {},
      }),
    )

  it('still returns 3', () => {
    expectUniversalInvariants(d(), at)
  })

  it('falls back to the CITY tier with no distances', () => {
    const decision = d()
    expect(decision.radiusTier).toBe('CITY')
    expect(decision.radiusKm).toBeNull()
    for (const p of decision.picks) expect(p.distanceKm).toBeNull()
  })

  it('ranks on quality when taste is uninformative', () => {
    const decision = d()
    // With an empty profile every taste score is neutral, so quality (the only
    // other 0.4-weighted term) has to be doing the work.
    for (const b of decision.breakdown) expect(b.taste).toBeCloseTo(0.5)
    expect(decision.picks.some((p) => p.breakdown.topComponent === 'quality')).toBe(true)
  })

  it('is reproducible for the same anonymous day', () => {
    expect(names(d())).toEqual(names(d()))
  })
})

describe('golden 5 — regular whose usual was picked yesterday', () => {
  const at = new Date('2026-09-21T12:00:00Z')
  const yesterday = new Date('2026-09-20T12:00:00Z')

  function scenario(pickRate: number) {
    resetIds()
    const usual = restaurant({
      name: 'The Usual',
      cuisineType: 'Lebanese',
      googleRating: 4.8,
      ...MARINA,
    })
    const candidates = [
      usual,
      restaurant({ name: 'Alt Japanese', cuisineType: 'Japanese', googleRating: 4.4, ...MARINA }),
      restaurant({ name: 'Alt Pizza', cuisineType: 'Pizza', googleRating: 4.3, ...MARINA }),
      restaurant({ name: 'Alt Healthy', cuisineType: 'Healthy', googleRating: 4.2, ...MARINA }),
    ]
    return {
      usual,
      decision: decide(
        input({
          candidates,
          context: context({ ...MARINA, date: at }),
          userId: 'regular',
          recentSelections: [{ restaurantId: usual.id, selectedAt: yesterday }],
          pickRates: { [usual.id]: pickRate },
        }),
      ),
    }
  }

  it('still returns 3 open restaurants', () => {
    expectUniversalInvariants(scenario(0.1).decision, at)
  })

  it('damps an occasional repeat', () => {
    const { usual, decision } = scenario(0.1)
    const b = decision.breakdown.find((x) => x.restaurantId === usual.id)!
    expect(b.damping).toBeLessThan(1)
    expect(b.total).toBeLessThan(b.base)
  })

  it('exempts a genuine favourite from damping', () => {
    const { usual, decision } = scenario(0.8)
    const b = decision.breakdown.find((x) => x.restaurantId === usual.id)!
    expect(b.damping).toBe(1)
  })

  it('keeps cuisine diversity across the three', () => {
    expect(cuisines(scenario(0.1).decision).size).toBeGreaterThanOrEqual(2)
  })
})
