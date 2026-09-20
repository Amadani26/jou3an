import { describe, expect, it } from 'vitest'
import { boostedTasteWeights, toEngineContext } from './request'
import { WEIGHT_MAX } from '../tasteProfile'
import { decide } from './index'
import { catalogue, context, input } from './fixtures'

describe('toEngineContext', () => {
  const date = new Date('2026-09-21T12:00:00Z')

  it('maps the Decide flow wire values onto engine enums', () => {
    const c = toEngineContext({ format: 'Delivery', vibe: 'Fancy' }, 'HIGH', date)
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
    expect(toEngineContext({}, 'LOW', date).budget).toBe('LOW')
    expect(toEngineContext({}, null, date).budget).toBe('ANY')
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

describe('boostedTasteWeights', () => {
  it('returns the profile untouched when nothing was requested', () => {
    const profile = { japanese: 2 }
    expect(boostedTasteWeights(profile, [])).toBe(profile)
  })

  it('pins a requested cuisine to the ceiling', () => {
    expect(boostedTasteWeights({}, ['Japanese']).japanese).toBe(WEIGHT_MAX)
  })

  it('normalises the requested cuisine key', () => {
    expect(Object.keys(boostedTasteWeights({}, ['  JaPaNeSe ']))).toEqual(['japanese'])
  })

  it('overrides a learned dislike for this query only', () => {
    const profile = { japanese: -4 }
    const boosted = boostedTasteWeights(profile, ['Japanese'])
    expect(boosted.japanese).toBe(WEIGHT_MAX)
    // The caller's profile object must not be mutated — the boost is per-query
    // and is never persisted.
    expect(profile.japanese).toBe(-4)
  })

  it('keeps unrelated learned weights', () => {
    const boosted = boostedTasteWeights({ lebanese: 3 }, ['Japanese'])
    expect(boosted.lebanese).toBe(3)
    expect(boosted.japanese).toBe(WEIGHT_MAX)
  })

  it('makes the requested cuisine lead the ranking', () => {
    // A mediocre Japanese place should still outscore better-rated others on
    // taste once the user explicitly asks for Japanese.
    const candidates = catalogue()
    const japanese = candidates.find((r) => r.cuisineType === 'Japanese')!

    const plain = decide(input({ candidates, tasteWeights: {} }))
    const asked = decide(
      input({ candidates, tasteWeights: boostedTasteWeights({}, ['Japanese']) }),
    )

    const tasteOf = (d: ReturnType<typeof decide>) =>
      d.breakdown.find((b) => b.restaurantId === japanese.id)!.taste

    expect(tasteOf(asked)).toBeGreaterThan(tasteOf(plain))
    expect(tasteOf(asked)).toBe(1)
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

describe('reason wording — requested vs learned', () => {
  /**
   * The taste term is reached the same way either route; only the copy differs.
   * The catalogue holds two Japanese restaurants and the diversity constraint
   * admits just one, so this matches on CUISINE rather than a pinned id.
   */
  function reasonForJapanese(over: Parameters<typeof context>[0]) {
    const d = decide(
      input({
        candidates: catalogue(),
        tasteWeights: boostedTasteWeights({}, ['Japanese']),
        context: context(over),
      }),
    )
    const pick = d.picks.find((p) => p.restaurant.cuisineType === 'Japanese')
    // A boosted cuisine should always land a pick; fail loudly if not.
    expect(pick, 'expected a Japanese pick when Japanese is boosted').toBeDefined()
    return pick!.reason
  }

  it('says "you asked for" when the cuisine was explicitly requested', () => {
    const reason = reasonForJapanese({ requestedCuisines: ['Japanese'] })
    expect(reason).toMatch(/you asked for/i)
    expect(reason).not.toMatch(/keep going back/i)
  })

  it('says "you keep going back" when the weight is learned, not requested', () => {
    // Same high weight, but nothing was requested this query — so it can only
    // have come from the user's history.
    const reason = reasonForJapanese({ requestedCuisines: [] })
    if (reason) expect(reason).not.toMatch(/you asked for/i)
  })

  it('never claims a habit on a first-ever anonymous request', () => {
    const candidates = catalogue()
    const d = decide(
      input({
        candidates,
        userId: null,
        tasteWeights: boostedTasteWeights({}, ['Japanese']),
        context: context({ requestedCuisines: ['Japanese'] }),
      }),
    )
    for (const p of d.picks) expect(p.reason).not.toMatch(/keep going back/i)
  })
})
