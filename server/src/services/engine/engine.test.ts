import { describe, expect, it } from 'vitest'
import { decide } from './index'
import {
  DAMPING_EXEMPT_PICK_RATE,
  EPSILON,
  EPSILON_BY_ADVENTUROUSNESS,
  MAX_EPSILON,
  MAX_EXPLORATION_REFRESHES,
  dampingFor,
  explorationFor,
} from './select'
import { filterCandidates } from './filter'
import { NEUTRAL, tasteScore } from './score'
import { conflictsWithDietary } from '../../lib/dietary'
import { effectiveTasteWeights, quizWeightsFrom } from '../tasteProfile'
import {
  DIFC,
  FAR,
  MARINA,
  cafe,
  catalogue,
  context,
  input,
  resetIds,
  restaurant,
} from './fixtures'

const CUISINES = (d: ReturnType<typeof decide>) =>
  new Set(d.picks.map((p) => p.restaurant.cuisineType.toLowerCase()))

describe('decide — the product rule', () => {
  it('always returns exactly 3', () => {
    const d = decide(input({ candidates: catalogue() }))
    expect(d.picks).toHaveLength(3)
  })

  it('returns 3 even when only 3 restaurants exist', () => {
    resetIds()
    const d = decide(input({ candidates: [restaurant(), restaurant(), restaurant()] }))
    expect(d.picks).toHaveLength(3)
  })

  it('returns 3 distinct restaurants, never a duplicate', () => {
    const d = decide(input({ candidates: catalogue() }))
    expect(new Set(d.picks.map((p) => p.restaurant.id)).size).toBe(3)
  })

  it('throws rather than silently returning 2 when the catalogue cannot field 3', () => {
    resetIds()
    expect(() => decide(input({ candidates: [restaurant(), restaurant()] }))).toThrow(
      /need 3/,
    )
  })

  it('relaxes constraints rather than returning fewer than 3', () => {
    resetIds()
    // Only one restaurant satisfies the strict brief (delivery + LOW budget).
    const candidates = [
      restaurant({ priceMin: 20, priceMax: 40, talabatUrl: 'https://t.example/1' }),
      restaurant({ priceMin: 200, priceMax: 400 }),
      restaurant({ priceMin: 200, priceMax: 400 }),
      restaurant({ priceMin: 200, priceMax: 400 }),
    ]
    const d = decide(
      input({
        candidates,
        context: context({ formatFilter: 'DELIVERY', budget: 'LOW' }),
      }),
    )
    expect(d.picks).toHaveLength(3)
    expect(d.relaxed.length).toBeGreaterThan(0)
  })
})

describe('decide — determinism', () => {
  it('returns identical picks for the same seed inputs', () => {
    const a = decide(input({ candidates: catalogue() }))
    const b = decide(input({ candidates: catalogue() }))
    expect(a.picks.map((p) => p.restaurant.name)).toEqual(
      b.picks.map((p) => p.restaurant.name),
    )
    expect(a.seed).toBe(b.seed)
  })

  it('produces identical score breakdowns for the same seed', () => {
    const a = decide(input({ candidates: catalogue() }))
    const b = decide(input({ candidates: catalogue() }))
    expect(a.breakdown.map((x) => x.total)).toEqual(b.breakdown.map((x) => x.total))
  })

  it('changes the seed when the refresh nonce changes', () => {
    const a = decide(input({ candidates: catalogue() }))
    const b = decide(
      input({ candidates: catalogue(), context: context({ refreshNonce: 'refresh-2' }) }),
    )
    expect(a.seed).not.toBe(b.seed)
  })

  it('gives different users different seeds on the same day', () => {
    const a = decide(input({ candidates: catalogue(), userId: 'user-1' }))
    const b = decide(input({ candidates: catalogue(), userId: 'user-2' }))
    expect(a.seed).not.toBe(b.seed)
  })

  it('keeps the same seed across the same Dubai day', () => {
    // 06:00 UTC == 10:00 Dubai and 19:00 UTC == 23:00 Dubai, both on the 21st.
    const a = decide(
      input({ candidates: catalogue(), context: context({ date: new Date('2026-09-21T06:00:00Z') }) }),
    )
    const b = decide(
      input({ candidates: catalogue(), context: context({ date: new Date('2026-09-21T19:00:00Z') }) }),
    )
    expect(a.seed).toBe(b.seed)
  })

  it('rolls the seed at Dubai midnight, not UTC midnight', () => {
    // 19:00 UTC is the 21st in Dubai; 21:00 UTC is already the 22nd (UTC+4).
    // Both are the same UTC calendar day, so a UTC-based seed would wrongly
    // match here.
    const sameDay = decide(
      input({ candidates: catalogue(), context: context({ date: new Date('2026-09-21T19:00:00Z') }) }),
    )
    const nextDubaiDay = decide(
      input({ candidates: catalogue(), context: context({ date: new Date('2026-09-21T21:00:00Z') }) }),
    )
    expect(sameDay.seed).not.toBe(nextDubaiDay.seed)
  })
})

describe('decide — cuisine diversity', () => {
  it('prefers distinct cuisines when the pool allows it', () => {
    const d = decide(input({ candidates: catalogue() }))
    expect(CUISINES(d).size).toBeGreaterThanOrEqual(2)
  })

  it('still returns 3 when every candidate shares one cuisine', () => {
    resetIds()
    const candidates = Array.from({ length: 5 }, () =>
      restaurant({ cuisineType: 'Lebanese' }),
    )
    const d = decide(input({ candidates }))
    expect(d.picks).toHaveLength(3)
    expect(CUISINES(d).size).toBe(1)
  })

  it('picks a lower-scoring candidate to avoid repeating a cuisine', () => {
    resetIds()
    // Two superb burger joints and one mediocre Japanese place. Diversity
    // should pull the Japanese one into the top 3 over the third burger.
    const candidates = [
      restaurant({ cuisineType: 'American Burgers', googleRating: 4.9 }),
      restaurant({ cuisineType: 'American Burgers', googleRating: 4.8 }),
      restaurant({ cuisineType: 'American Burgers', googleRating: 4.7 }),
      restaurant({ cuisineType: 'Japanese', googleRating: 3.6 }),
    ]
    const d = decide(input({ candidates, context: context({ refreshNonce: 'no-wildcard' }) }))
    // Not asserted when the wildcard fires — that is a different mechanism.
    if (!d.wildcardUsed) {
      expect(CUISINES(d)).toContain('japanese')
    }
  })
})

describe('dampingFor — repeat damping', () => {
  const now = new Date('2026-09-21T12:00:00Z')
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

  it('is 1 (undamped) for a restaurant never selected', () => {
    expect(dampingFor('r1', [], {}, now)).toBe(1)
  })

  it('is at the floor for a selection made today', () => {
    const recent = [{ restaurantId: 'r1', selectedAt: daysAgo(0) }]
    expect(dampingFor('r1', recent, {}, now)).toBeCloseTo(0.5)
  })

  it('decays linearly back to 1 over 7 days', () => {
    const recent = (n: number) => [{ restaurantId: 'r1', selectedAt: daysAgo(n) }]
    expect(dampingFor('r1', recent(3.5), {}, now)).toBeCloseTo(0.75)
    expect(dampingFor('r1', recent(7), {}, now)).toBe(1)
    expect(dampingFor('r1', recent(30), {}, now)).toBe(1)
  })

  it('uses the most recent selection when there are several', () => {
    const recent = [
      { restaurantId: 'r1', selectedAt: daysAgo(6) },
      { restaurantId: 'r1', selectedAt: daysAgo(1) },
    ]
    // The 1-day-ago pick dominates, not the 6-day-old one.
    expect(dampingFor('r1', recent, {}, now)).toBeLessThan(0.65)
  })

  it('exempts a restaurant above the historical pick-rate threshold', () => {
    const recent = [{ restaurantId: 'r1', selectedAt: daysAgo(0) }]
    const rates = { r1: DAMPING_EXEMPT_PICK_RATE + 0.01 }
    // A genuine regular is not suppressed for being a regular.
    expect(dampingFor('r1', recent, rates, now)).toBe(1)
  })

  it('does NOT exempt a restaurant at or below the threshold', () => {
    const recent = [{ restaurantId: 'r1', selectedAt: daysAgo(0) }]
    expect(dampingFor('r1', recent, { r1: DAMPING_EXEMPT_PICK_RATE }, now)).toBeCloseTo(0.5)
  })

  it('damps a recently-picked restaurant down the ranking', () => {
    resetIds()
    const star = restaurant({ cuisineType: 'Lebanese', googleRating: 5 })
    const others = [
      restaurant({ cuisineType: 'Japanese', googleRating: 4.3 }),
      restaurant({ cuisineType: 'Pizza', googleRating: 4.2 }),
      restaurant({ cuisineType: 'Healthy', googleRating: 4.1 }),
    ]
    const candidates = [star, ...others]

    const undamped = decide(input({ candidates }))
    const damped = decide(
      input({
        candidates,
        recentSelections: [{ restaurantId: star.id, selectedAt: new Date('2026-09-21T10:00:00Z') }],
      }),
    )

    const scoreOf = (d: ReturnType<typeof decide>) =>
      d.breakdown.find((b) => b.restaurantId === star.id)!.total

    expect(scoreOf(damped)).toBeLessThan(scoreOf(undamped))
  })
})

describe('decide — taste weights', () => {
  it('lifts a cuisine the user has shown they like', () => {
    resetIds()
    const japanese = restaurant({ cuisineType: 'Japanese', googleRating: 4.0 })
    const candidates = [
      japanese,
      restaurant({ cuisineType: 'Pizza', googleRating: 4.0 }),
      restaurant({ cuisineType: 'Healthy', googleRating: 4.0 }),
      restaurant({ cuisineType: 'French', googleRating: 4.0 }),
    ]

    const neutral = decide(input({ candidates }))
    const loves = decide(input({ candidates, tasteWeights: { japanese: 9 } }))

    const tasteOf = (d: ReturnType<typeof decide>) =>
      d.breakdown.find((b) => b.restaurantId === japanese.id)!.taste

    expect(tasteOf(loves)).toBeGreaterThan(tasteOf(neutral))
  })

  it('treats an empty profile as neutral, not as dislike', () => {
    resetIds()
    const d = decide(input({ candidates: catalogue(), tasteWeights: {} }))
    for (const b of d.breakdown) expect(b.taste).toBeCloseTo(0.5)
  })
})

describe('decide — geography', () => {
  it('uses the NEARBY tier when 3 candidates are within 5 km', () => {
    const d = decide(
      input({ candidates: catalogue(), context: context({ ...MARINA }) }),
    )
    expect(d.radiusTier).toBe('NEARBY')
    expect(d.radiusKm).toBe(5)
  })

  it('falls back to CITY when nothing is near', () => {
    resetIds()
    const candidates = [
      restaurant({ ...DIFC }),
      restaurant({ ...DIFC }),
      restaurant({ ...DIFC }),
    ]
    const d = decide(input({ candidates, context: context({ ...FAR }) }))
    expect(d.radiusTier).toBe('CITY')
  })

  it('sorts the final 3 nearest-first when coordinates are known', () => {
    const d = decide(input({ candidates: catalogue(), context: context({ ...MARINA }) }))
    const distances = d.picks.map((p) => p.distanceKm!)
    expect(distances.every((x) => typeof x === 'number')).toBe(true)
    expect([...distances].sort((a, b) => a - b)).toEqual(distances)
  })

  it('leaves distance null when no coordinates are supplied', () => {
    const d = decide(input({ candidates: catalogue() }))
    for (const p of d.picks) expect(p.distanceKm).toBeNull()
  })
})

describe('decide — parked cafes never reach a result', () => {
  it('never returns a CAFE, even when cafes outscore every restaurant', () => {
    // The catalogue's two cafes are the highest-rated rows in it.
    for (let nonce = 0; nonce < 8; nonce++) {
      const d = decide(
        input({
          candidates: catalogue(),
          context: context({ refreshNonce: nonce }),
        }),
      )
      for (const p of d.picks) expect(p.restaurant.venueType).toBe('RESTAURANT')
    }
  })

  it('keeps cafes out of the scored pool entirely, not just the top 3', () => {
    const d = decide(input({ candidates: catalogue() }))
    const scoredIds = new Set(d.breakdown.map((b) => b.restaurantId))
    for (const r of catalogue().filter((x) => x.venueType === 'CAFE')) {
      expect(scoredIds.has(r.id)).toBe(false)
    }
  })

  it('never returns a CAFE the user has been taught to love', () => {
    resetIds()
    const candidates = [
      restaurant({ cuisineType: 'Lebanese' }),
      restaurant({ cuisineType: 'Japanese' }),
      restaurant({ cuisineType: 'Pizza' }),
      cafe({ name: 'Beloved Coffee', cuisineType: 'Coffee', googleRating: 5 }),
    ]
    const d = decide(
      input({
        candidates,
        // A profile that adores coffee, and a query explicitly asking for it.
        tasteWeights: { coffee: 10 },
        context: context({ requestedCuisines: ['Coffee'] }),
      }),
    )
    expect(d.picks.map((p) => p.restaurant.name)).not.toContain('Beloved Coffee')
  })

  it('throws rather than relaxing the cafe gate to reach 3', () => {
    resetIds()
    // Two restaurants and three cafes: three rows are available, but only two
    // are servable. Reaching for a cafe would be worse than failing loudly.
    const candidates = [restaurant(), restaurant(), cafe(), cafe(), cafe()]
    expect(() => decide(input({ candidates }))).toThrow(/need 3/)
  })

  it('throws rather than relaxing isActive to reach 3', () => {
    resetIds()
    // Pruning is a human saying "never serve this" — not a constraint to drop.
    const candidates = [
      restaurant(),
      restaurant(),
      restaurant({ isActive: false }),
      restaurant({ isActive: false }),
    ]
    expect(() => decide(input({ candidates }))).toThrow(/need 3/)
  })
})

describe('filterCandidates — Stage 1', () => {
  it('drops parked cafes', () => {
    resetIds()
    const candidates = [restaurant(), restaurant(), restaurant(), cafe()]
    expect(filterCandidates(candidates, context()).pool).toHaveLength(3)
  })

  it('never reports isActive or venueType as relaxed — they are absolute', () => {
    resetIds()
    // Nothing matches the strict brief, so the ladder runs to the bottom.
    const candidates = [
      restaurant({ priceMin: 200, priceMax: 400 }),
      restaurant({ priceMin: 200, priceMax: 400 }),
      restaurant({ priceMin: 200, priceMax: 400 }),
      cafe(),
      restaurant({ isActive: false }),
    ]
    const { relaxed, pool } = filterCandidates(
      candidates,
      context({ formatFilter: 'DELIVERY', budget: 'LOW' }),
    )
    expect(relaxed).not.toContain('isActive')
    expect(relaxed).not.toContain('venueType')
    expect(pool).toHaveLength(3)
  })

  it('drops closed restaurants', () => {
    resetIds()
    const closedMondays = [{ open: { day: 2, hour: 9 }, close: { day: 2, hour: 17 } }]
    const candidates = [
      restaurant(),
      restaurant(),
      restaurant(),
      restaurant({ openingHours: closedMondays }),
    ]
    // Mon 16:00 Dubai — the Tuesday-only place is shut.
    const { pool } = filterCandidates(candidates, context())
    expect(pool).toHaveLength(3)
  })

  it('drops inactive restaurants', () => {
    resetIds()
    const candidates = [
      restaurant(),
      restaurant(),
      restaurant(),
      restaurant({ isActive: false }),
    ]
    expect(filterCandidates(candidates, context()).pool).toHaveLength(3)
  })

  it('requires a delivery link for DELIVERY', () => {
    resetIds()
    const candidates = [
      restaurant({ talabatUrl: 'https://t.example/1' }),
      restaurant({ noonUrl: 'https://n.example/2' }),
      restaurant({ deliverooUrl: 'https://d.example/3' }),
      restaurant(),
    ]
    const { pool, relaxed } = filterCandidates(
      candidates,
      context({ formatFilter: 'DELIVERY' }),
    )
    expect(pool).toHaveLength(3)
    expect(relaxed).toEqual([])
  })

  it('reports which constraints were relaxed', () => {
    resetIds()
    // Nothing offers delivery, so `format` has to go.
    const candidates = [restaurant(), restaurant(), restaurant()]
    const { relaxed } = filterCandidates(candidates, context({ formatFilter: 'DELIVERY' }))
    expect(relaxed).toContain('format')
  })
})

describe('decide — reasons', () => {
  it('gives every pick a non-empty reason', () => {
    const d = decide(input({ candidates: catalogue() }))
    for (const p of d.picks) expect(p.reason.length).toBeGreaterThan(0)
  })

  it('cites the rating when quality is the dominant component', () => {
    resetIds()
    const candidates = [
      restaurant({ cuisineType: 'Lebanese', googleRating: 4.9 }),
      restaurant({ cuisineType: 'Japanese', googleRating: 4.8 }),
      restaurant({ cuisineType: 'Pizza', googleRating: 4.7 }),
    ]
    const d = decide(input({ candidates }))
    const qualityPicks = d.picks.filter((p) => p.breakdown.topComponent === 'quality')
    expect(qualityPicks.length).toBeGreaterThan(0)
    for (const p of qualityPicks) expect(p.reason).toMatch(/on Google|better-rated/)
  })

  it('appends distance when coordinates are known', () => {
    const d = decide(input({ candidates: catalogue(), context: context({ ...MARINA }) }))
    for (const p of d.picks) expect(p.reason).toMatch(/· [\d.]+ km$/)
  })
})

describe('decide — breakdown', () => {
  it('reports a full component breakdown for every surviving candidate', () => {
    const d = decide(input({ candidates: catalogue() }))
    expect(d.breakdown.length).toBeGreaterThanOrEqual(3)
    for (const b of d.breakdown) {
      expect(b.quality).toBeGreaterThanOrEqual(0)
      expect(b.quality).toBeLessThanOrEqual(1)
      expect(b.taste).toBeGreaterThanOrEqual(0)
      expect(b.taste).toBeLessThanOrEqual(1)
      expect(b.context).toBeGreaterThanOrEqual(0)
      expect(b.context).toBeLessThanOrEqual(1)
      // base is the weighted sum, so it must also sit in [0,1].
      expect(b.base).toBeGreaterThanOrEqual(0)
      expect(b.base).toBeLessThanOrEqual(1)
    }
  })

  it('weights the components 0.4 / 0.4 / 0.2', () => {
    const d = decide(input({ candidates: catalogue() }))
    for (const b of d.breakdown) {
      expect(b.base).toBeCloseTo(0.4 * b.quality + 0.4 * b.taste + 0.2 * b.context, 10)
    }
  })
})

/* ------------------------------------------------------------------ */
/* Taste quiz — the three ways its answers reach the engine            */
/* ------------------------------------------------------------------ */

describe('per-user wildcard ε (adventurousness)', () => {
  it('maps the three answers onto 0.05 / 0.15 / 0.30', () => {
    expect(EPSILON_BY_ADVENTUROUSNESS.SAFE).toBe(0.05)
    expect(EPSILON_BY_ADVENTUROUSNESS.ADVENTUROUS).toBe(0.3)
  })

  // BALANCED must be the historical constant, or taking the quiz would change
  // behaviour for a user who answered "the middle one".
  it('BALANCED is exactly the engine default', () => {
    expect(EPSILON_BY_ADVENTUROUSNESS.BALANCED).toBe(EPSILON)
  })

  it('an omitted base ε reproduces the old behaviour exactly', () => {
    for (const nonce of [0, 1, 2, 3, 4, 9]) {
      expect(explorationFor(nonce).epsilon).toBe(explorationFor(nonce, null).epsilon)
      expect(explorationFor(nonce, undefined).epsilon).toBe(
        explorationFor(nonce).epsilon,
      )
    }
  })

  it('uses the user ε on first load, not the default', () => {
    expect(explorationFor(0, 0.05).epsilon).toBe(0.05)
    expect(explorationFor(0, 0.3).epsilon).toBe(0.3)
    expect(explorationFor(0).epsilon).toBe(EPSILON)
  })

  it('a safe user still explores less than an adventurous one at every nonce', () => {
    for (const nonce of [0, 1, 2, 3]) {
      expect(explorationFor(nonce, 0.05).epsilon).toBeLessThan(
        explorationFor(nonce, 0.3).epsilon,
      )
    }
  })

  // Refresh is an explicit "not these", so it must still work for a safe user.
  it('Refresh ramps every user to the shared ceiling', () => {
    expect(explorationFor(MAX_EXPLORATION_REFRESHES, 0.05).epsilon).toBeCloseTo(
      MAX_EPSILON,
    )
    expect(explorationFor(MAX_EXPLORATION_REFRESHES, 0.3).epsilon).toBeCloseTo(
      MAX_EPSILON,
    )
  })

  it('ramps monotonically from the user ε', () => {
    const seen = [0, 1, 2, 3, 4].map((n) => explorationFor(n, 0.05).epsilon)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1])
    expect(seen[0]).toBe(0.05)
  })

  it('clamps a nonsensical stored ε instead of trusting it', () => {
    expect(explorationFor(0, -1).epsilon).toBe(0)
    expect(explorationFor(0, 5).epsilon).toBe(MAX_EPSILON)
    expect(explorationFor(0, Number.NaN).epsilon).toBe(EPSILON)
  })

  it('still returns exactly 3 at either extreme', () => {
    for (const baseEpsilon of [0.05, 0.3]) {
      const d = decide(
        input({ candidates: catalogue(), context: context({ baseEpsilon }) }),
      )
      expect(d.picks).toHaveLength(3)
    }
  })

  it('leaves the result deterministic — ε is seeded, not random', () => {
    const run = () =>
      decide(input({ candidates: catalogue(), context: context({ baseEpsilon: 0.3 }) }))
        .picks.map((p) => p.restaurant.id)
        .join(',')
    expect(run()).toBe(run())
  })
})

describe('dietary needs as a Stage-1 exclusion', () => {
  it('never serves a conflicting restaurant', () => {
    const d = decide(
      input({
        candidates: catalogue(),
        context: context({ dietary: ['vegetarian'] }),
      }),
    )
    for (const p of d.picks) {
      expect(conflictsWithDietary(p.restaurant, ['vegetarian'])).toBe(false)
    }
  })

  it('drops the burger joints a vegetarian cannot use', () => {
    const pool = filterCandidates(catalogue(), context({ dietary: ['vegetarian'] })).pool
    expect(pool.map((r) => r.name)).not.toContain('Marina Burger Co')
    expect(pool.map((r) => r.name)).not.toContain('Smokehouse Marina')
    // And keeps everything it has no reason to exclude.
    expect(pool.map((r) => r.name)).toContain('Green Bowl')
    expect(pool.map((r) => r.name)).toContain('Beirut Table')
  })

  it('excludes pizza for a gluten-free user but not for anyone else', () => {
    const gf = filterCandidates(catalogue(), context({ dietary: ['gluten-free'] })).pool
    expect(gf.map((r) => r.name)).not.toContain('Pizza Yard')
    const anyone = filterCandidates(catalogue(), context()).pool
    expect(anyone.map((r) => r.name)).toContain('Pizza Yard')
  })

  it('still returns exactly 3', () => {
    for (const need of ['vegetarian', 'vegan', 'gluten-free', 'no-pork']) {
      const d = decide(
        input({ candidates: catalogue(), context: context({ dietary: [need] }) }),
      )
      expect(d.picks, need).toHaveLength(3)
    }
  })

  it('changes nothing when no needs are declared', () => {
    const plain = filterCandidates(catalogue(), context()).pool.map((r) => r.id)
    expect(filterCandidates(catalogue(), context({ dietary: [] })).pool.map((r) => r.id))
      .toEqual(plain)
  })

  // Dietary is the LAST rung — worse to hand a vegan a steakhouse than to hand
  // anyone a shut door — so it must not appear in relaxed[] on a healthy pool.
  it('does not report dietary as relaxed when the pool is ample', () => {
    const r = filterCandidates(catalogue(), context({ dietary: ['vegetarian'] }))
    expect(r.relaxed).not.toContain('dietary')
  })

  it('relaxes dietary only as a last resort, and says so', () => {
    resetIds()
    // Three restaurants, all of them conflicting: the rule that there are
    // always three outranks even this.
    const allSteak = [
      restaurant({ cuisineType: 'Steakhouse' }),
      restaurant({ cuisineType: 'Steakhouse' }),
      restaurant({ cuisineType: 'Steakhouse' }),
    ]
    const r = filterCandidates(allSteak, context({ dietary: ['vegetarian'] }))
    expect(r.pool).toHaveLength(3)
    expect(r.relaxed).toContain('dietary')
    // And it is dropped after everything else, never before.
    expect(r.relaxed.indexOf('dietary')).toBe(r.relaxed.length - 1)
  })

  it('a parked cafe is still never served, dietary or not', () => {
    const d = decide(
      input({ candidates: catalogue(), context: context({ dietary: ['vegetarian'] }) }),
    )
    for (const p of d.picks) expect(p.restaurant.venueType).toBe('RESTAURANT')
  })
})

describe('quiz-seeded taste weights', () => {
  /**
   * A loved cuisine must score ABOVE neutral, not below it.
   *
   * This is the assertion that caught the `normalizeWeight` bug: with the old
   * linear map a weight of +2 scored 0.467 against the 0.5 an unknown cuisine
   * got, so "I love Pakistani food" actively demoted Pakistani food.
   */
  it('scores a loved cuisine above an unknown one, and a disliked one below', () => {
    const loved = quizWeightsFrom(['Pakistani'], ['Japanese'])
    const curry = restaurant({ cuisineType: 'Pakistani', tags: [] })
    const sushi = restaurant({ cuisineType: 'Japanese', tags: [] })
    const other = restaurant({ cuisineType: 'French', tags: [] })

    expect(tasteScore(curry, loved)).toBeGreaterThan(NEUTRAL)
    expect(tasteScore(other, loved)).toBe(NEUTRAL)
    expect(tasteScore(sushi, loved)).toBeLessThan(NEUTRAL)
  })

  it('+2 decides between candidates the engine otherwise cannot separate', () => {
    resetIds()
    // Same rating, same price, same distance — taste is the only differentiator.
    const even = [
      restaurant({ name: 'Curry', cuisineType: 'Pakistani', googleRating: 4.2 }),
      restaurant({ name: 'Sushi', cuisineType: 'Japanese', googleRating: 4.2 }),
      restaurant({ name: 'Pasta', cuisineType: 'Italian', googleRating: 4.2 }),
      restaurant({ name: 'Grill', cuisineType: 'Lebanese', googleRating: 4.2 }),
    ]
    const d = decide(
      input({
        candidates: even,
        tasteWeights: effectiveTasteWeights({}, quizWeightsFrom(['Pakistani'], [])),
      }),
    )
    expect(d.picks.map((p) => p.restaurant.name)).toContain('Curry')
  })

  /**
   * On the real catalogue a stated preference is a NUDGE, not an override: a
   * +2 is worth ~0.04 of base score and will not beat a 0.3-star rating gap.
   * That is the intended strength — the quiz seeds taste, it does not replace
   * quality — so the property worth asserting is that the rank improves.
   */
  it('improves a loved cuisine’s rank without overriding quality', () => {
    const rankOf = (weights: Parameters<typeof decide>[0]['tasteWeights']) => {
      const d = decide(input({ candidates: catalogue(), tasteWeights: weights }))
      const sorted = [...d.breakdown].sort((a, b) => b.total - a.total)
      return sorted.findIndex((b) => b.cuisine === 'Pakistani')
    }

    const cold = rankOf({})
    const seeded = rankOf(effectiveTasteWeights({}, quizWeightsFrom(['Pakistani'], [])))
    expect(seeded).toBeLessThan(cold)
  })

  it('a disliked cuisine is pushed out of the picks', () => {
    // Japanese earns a slot on quality alone with a cold profile...
    const cold = decide(input({ candidates: catalogue(), tasteWeights: {} }))
    expect(CUISINES(cold)).toContain('japanese')

    // ...and -2 is enough to lose it, without filtering it out of the pool.
    const avoided = decide(
      input({
        candidates: catalogue(),
        tasteWeights: effectiveTasteWeights({}, quizWeightsFrom([], ['Japanese'])),
      }),
    )
    expect(CUISINES(avoided)).not.toContain('japanese')
  })

  it('seeds are additive with what swiping already learned', () => {
    const merged = effectiveTasteWeights({ japanese: 3 }, quizWeightsFrom(['Japanese'], []))
    expect(merged.japanese).toBe(5)
  })

  it('still returns exactly 3 for a fully-seeded profile', () => {
    const d = decide(
      input({
        candidates: catalogue(),
        tasteWeights: effectiveTasteWeights(
          {},
          quizWeightsFrom(['Pakistani', 'Lebanese'], ['Japanese', 'Pizza']),
        ),
      }),
    )
    expect(d.picks).toHaveLength(3)
  })
})
