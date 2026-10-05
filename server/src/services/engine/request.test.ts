import { describe, expect, it } from 'vitest'
import { epsilonFor, toEngineContext } from './request'
import { EPSILON } from './select'
import { decide } from './index'
import { catalogue, context, input } from './fixtures'

describe('toEngineContext', () => {
  const date = new Date('2026-09-21T12:00:00Z')

  it('maps the Decide flow wire values onto engine enums', () => {
    const c = toEngineContext(
      { format: 'Delivery', vibe: 'Fancy' },
      { budgetRange: 'HIGH' },
      date,
    )
    expect(c.formatFilter).toBe('DELIVERY')
    expect(c.vibe).toBe('FANCY')
    expect(c.budget).toBe('HIGH')
  })

  it('maps "Dine In" (with the space) correctly', () => {
    expect(toEngineContext({ format: 'Dine In' }, null, date).formatFilter).toBe('DINE_IN')
  })

  it('falls back to ANY for missing or unrecognised values', () => {
    // An older client omits these entirely; it must still get a decision.
    const c = toEngineContext({}, null, date)
    expect(c.formatFilter).toBe('ANY')
    expect(c.vibe).toBe('ANY')
    expect(c.budget).toBe('ANY')

    const junk = toEngineContext({ format: 'Takeaway', vibe: 'Rowdy' }, null, date)
    expect(junk.formatFilter).toBe('ANY')
    expect(junk.vibe).toBe('ANY')
  })

  it('uses the signed-in user budget, ANY for anonymous', () => {
    expect(toEngineContext({}, { budgetRange: 'LOW' }, date).budget).toBe('LOW')
    expect(toEngineContext({}, null, date).budget).toBe('ANY')
  })

  it('reads a stored NULL band as ANY — "Any budget" is an answer', () => {
    // User.budgetRange is nullable and the quiz's first budget card stores null.
    // It must mean "leave the price term neutral", not "fall back to a band".
    expect(toEngineContext({}, { budgetRange: null }, date).budget).toBe('ANY')
    expect(toEngineContext({}, {}, date).budget).toBe('ANY')
  })

  /* --- the taste quiz's three outputs ---------------------------- */

  it('the saved budget is a DEFAULT — an explicit query budget wins', () => {
    const prefs = { budgetRange: 'LOW' as const }
    expect(toEngineContext({}, prefs, date).budget).toBe('LOW')
    expect(toEngineContext({ budget: 'HIGH' }, prefs, date).budget).toBe('HIGH')
    // And an explicit ANY is a real answer, not a missing one.
    expect(toEngineContext({ budget: 'ANY' }, prefs, date).budget).toBe('ANY')
  })

  it('an unrecognised query budget falls back to the saved band, not to ANY', () => {
    expect(
      toEngineContext({ budget: 'CHEAPISH' }, { budgetRange: 'MID' }, date).budget,
    ).toBe('MID')
  })

  it('passes declared dietary needs through', () => {
    const c = toEngineContext({}, { dietary: ['vegetarian', 'no-pork'] }, date)
    expect(c.dietary).toEqual(['vegetarian', 'no-pork'])
  })

  it('drops dietary values the filter cannot act on', () => {
    // A junk value stored years ago must never silently shrink someone's pool.
    const c = toEngineContext({}, { dietary: ['vegetarian', 'keto', ''] }, date)
    expect(c.dietary).toEqual(['vegetarian'])
  })

  it('normalises dietary spelling on the way in', () => {
    expect(toEngineContext({}, { dietary: ['GLUTEN FREE'] }, date).dietary).toEqual([
      'gluten-free',
    ])
  })

  it('maps adventurousness onto the base ε', () => {
    expect(toEngineContext({}, { adventurousness: 'SAFE' }, date).baseEpsilon).toBe(0.05)
    expect(toEngineContext({}, { adventurousness: 'BALANCED' }, date).baseEpsilon).toBe(
      EPSILON,
    )
    expect(
      toEngineContext({}, { adventurousness: 'ADVENTUROUS' }, date).baseEpsilon,
    ).toBe(0.3)
  })

  it('falls back to the engine ε for anonymous callers and quiz-skippers', () => {
    expect(toEngineContext({}, null, date).baseEpsilon).toBe(EPSILON)
    expect(toEngineContext({}, {}, date).baseEpsilon).toBe(EPSILON)
    expect(epsilonFor(null)).toBe(EPSILON)
    expect(epsilonFor(undefined)).toBe(EPSILON)
  })

  it('a prefs-free context is dietary-free, so nothing is excluded', () => {
    expect(toEngineContext({}, null, date).dietary).toEqual([])
  })

  it('passes coordinates through only when both are numbers', () => {
    expect(toEngineContext({ lat: 25.07, lng: 55.13 }, null, date).lat).toBe(25.07)
    const missing = toEngineContext({ lat: 25.07 }, null, date)
    expect(missing.lng).toBeNull()
  })

  it('defaults the refresh nonce to 0', () => {
    expect(toEngineContext({}, null, date).refreshNonce).toBe(0)
    expect(toEngineContext({ refreshNonce: 4 }, null, date).refreshNonce).toBe(4)
  })
})

describe('explicit cuisines reach the context as a filter, not a weight', () => {
  const date = new Date('2026-09-21T12:00:00Z')

  it('passes the picked cuisines through verbatim', () => {
    const c = toEngineContext({ cuisines: ['Japanese', 'Pizza'] }, null, date)
    expect(c.cuisines).toEqual(['Japanese', 'Pizza'])
  })

  it('defaults to an empty list — no picks means no cuisine constraint', () => {
    expect(toEngineContext({}, null, date).cuisines).toEqual([])
  })

  it('leaves the taste weights alone — the route passes the profile untouched', () => {
    // The deleted `boostedTasteWeights` used to pin a requested cuisine to the
    // ceiling here. Nothing in the request mapping touches taste any more, so a
    // learned dislike stays a learned dislike even when that cuisine is asked
    // for; the filter is what honours the request.
    const c = toEngineContext({ cuisines: ['Japanese'] }, null, date)
    expect(c).not.toHaveProperty('tasteWeights')
  })

  it('passes the Refresh exclusions through, defaulting to empty', () => {
    expect(toEngineContext({ excludeIds: ['a', 'b'] }, null, date).excludeIds).toEqual([
      'a',
      'b',
    ])
    expect(toEngineContext({}, null, date).excludeIds).toEqual([])
  })
})

describe('refreshNonce — Refresh genuinely re-rolls', () => {
  /** Distinct result sets produced across a run of nonces. */
  function resultSets(count: number): Set<string> {
    const seen = new Set<string>()
    for (let n = 0; n < count; n++) {
      const d = decide(
        input({
          candidates: catalogue(),
          context: context({ refreshNonce: n }),
        }),
      )
      seen.add(
        d.picks
          .map((p) => p.restaurant.id)
          .sort()
          .join(','),
      )
    }
    return seen
  }

  it('produces more than one distinct set across successive nonces', () => {
    // Not asserting that EVERY refresh differs — the top candidates are
    // genuinely the best ones and some repetition is correct behaviour. What
    // must hold is that refreshing moves at all.
    expect(resultSets(10).size).toBeGreaterThan(1)
  })

  it('is still deterministic for a given nonce', () => {
    const at = (n: number) =>
      decide(input({ candidates: catalogue(), context: context({ refreshNonce: n }) }))
        .picks.map((p) => p.restaurant.id)

    expect(at(3)).toEqual(at(3))
    expect(at(7)).toEqual(at(7))
  })

  it('treats nonce 0 (first load) as the stable same-day answer', () => {
    const a = decide(input({ candidates: catalogue(), context: context({ refreshNonce: 0 }) }))
    const b = decide(input({ candidates: catalogue(), context: context() }))
    // An omitted nonce and an explicit 0 must agree, or a first load and a
    // repeat visit would disagree for no reason.
    expect(a.seed).toBe(b.seed)
  })
})

describe('seed rolls to the next Dubai day', () => {
  it('gives a different answer tomorrow for the same brief', () => {
    // Faked dates, not the wall clock — decide() takes `date` as input.
    const today = decide(
      input({
        candidates: catalogue(),
        context: context({ date: new Date('2026-09-21T12:00:00Z') }),
      }),
    )
    const tomorrow = decide(
      input({
        candidates: catalogue(),
        context: context({ date: new Date('2026-09-22T12:00:00Z') }),
      }),
    )
    expect(today.seed).not.toBe(tomorrow.seed)
  })

  it('keeps the same seed at two different times on the same Dubai day', () => {
    const morning = decide(
      input({
        candidates: catalogue(),
        context: context({ date: new Date('2026-09-21T05:00:00Z') }), // 09:00 Dubai
      }),
    )
    const evening = decide(
      input({
        candidates: catalogue(),
        context: context({ date: new Date('2026-09-21T18:00:00Z') }), // 22:00 Dubai
      }),
    )
    expect(morning.seed).toBe(evening.seed)
  })
})

describe('reason wording — a learned habit is the only kind there is', () => {
  /**
   * The catalogue holds two Japanese restaurants and the diversity constraint
   * admits just one, so this matches on CUISINE rather than a pinned id.
   */
  function japanesePick(weights: Record<string, number>, over: Parameters<typeof context>[0] = {}) {
    const d = decide(
      input({ candidates: catalogue(), tasteWeights: weights, context: context(over) }),
    )
    return d.picks.find((p) => p.restaurant.cuisineType === 'Japanese')
  }

  it('says "you keep going back" when the weight is genuinely learned', () => {
    const pick = japanesePick({ japanese: 8 })
    expect(pick, 'a strongly-liked cuisine should land a pick').toBeDefined()
    expect(pick!.reason).toMatch(/keep going back/i)
  })

  it('never claims a habit on a first-ever anonymous request for a cuisine', () => {
    // The regression this guards: while a requested cuisine was folded into the
    // taste weights, asking for Japanese produced "You keep going back to
    // Japanese" for a user with no history at all. The cuisine is a filter now
    // and moves no score, so taste cannot dominate on an empty profile.
    const d = decide(
      input({
        candidates: catalogue(),
        userId: null,
        tasteWeights: {},
        context: context({ cuisines: ['Japanese'] }),
      }),
    )
    for (const p of d.picks) expect(p.reason).not.toMatch(/keep going back/i)
  })
})
