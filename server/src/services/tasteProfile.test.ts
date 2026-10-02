import { describe, expect, it } from 'vitest'
import {
  DECAY,
  EVENT_DELTA,
  WEIGHT_MAX,
  WEIGHT_MIN,
  QUIZ_DISLIKE_DELTA,
  QUIZ_LOVE_DELTA,
  applyEventToWeights,
  coerceWeights,
  effectiveTasteWeights,
  quizWeightsFrom,
} from './tasteProfile'

/** The pure core only — `applyTasteEvent` is the DB wrapper and isn't covered here. */
describe('applyEventToWeights', () => {
  it('applies each event delta at full strength on a fresh profile', () => {
    expect(applyEventToWeights({}, 'Japanese', 'SWIPE_RIGHT').japanese).toBeCloseTo(1)
    expect(applyEventToWeights({}, 'Japanese', 'SWIPE_LEFT').japanese).toBeCloseTo(-0.25)
    expect(applyEventToWeights({}, 'Japanese', 'SELECT').japanese).toBeCloseTo(3)
  })

  it('normalises the cuisine key', () => {
    const w = applyEventToWeights({}, '  JaPaNeSe  ', 'SELECT')
    expect(Object.keys(w)).toEqual(['japanese'])
  })

  it('decays every weight before applying the delta', () => {
    const before = { japanese: 4, lebanese: 2 }
    const after = applyEventToWeights(before, 'japanese', 'SWIPE_RIGHT')

    // The targeted cuisine decays too, then takes the delta.
    expect(after.japanese).toBeCloseTo(4 * DECAY + EVENT_DELTA.SWIPE_RIGHT)
    // Untouched cuisines only decay.
    expect(after.lebanese).toBeCloseTo(2 * DECAY)
  })

  it('decays untouched cuisines toward neutral over many updates', () => {
    let w: Record<string, number> = { lebanese: 5 }
    for (let i = 0; i < 100; i++) w = applyEventToWeights(w, 'japanese', 'SWIPE_RIGHT')

    expect(w.lebanese).toBeLessThan(5 * 0.2)
    // Still positive — decay erodes, it does not invert a preference.
    expect(w.lebanese).toBeGreaterThan(0)
  })

  it('clamps to the ceiling no matter how many SELECTs land', () => {
    let w: Record<string, number> = {}
    for (let i = 0; i < 50; i++) w = applyEventToWeights(w, 'japanese', 'SELECT')
    expect(w.japanese).toBeLessThanOrEqual(WEIGHT_MAX)
    // And it should actually be pinned near the ceiling, not merely under it.
    expect(w.japanese).toBeGreaterThan(WEIGHT_MAX - 1)
  })

  it('clamps to the floor no matter how many left-swipes land', () => {
    let w: Record<string, number> = {}
    for (let i = 0; i < 500; i++) w = applyEventToWeights(w, 'pizza', 'SWIPE_LEFT')
    expect(w.pizza).toBeGreaterThanOrEqual(WEIGHT_MIN)
  })

  it('does not mutate the input', () => {
    const before = { japanese: 4 }
    applyEventToWeights(before, 'japanese', 'SELECT')
    expect(before.japanese).toBe(4)
  })

  it('ignores an empty cuisine', () => {
    expect(applyEventToWeights({ japanese: 1 }, '   ', 'SELECT')).toEqual({ japanese: 1 })
  })

  it('prunes weights that have decayed into noise', () => {
    let w: Record<string, number> = { thai: 0.02 }
    // Two decays take 0.02 below the 0.01 prune threshold.
    for (let i = 0; i < 40; i++) w = applyEventToWeights(w, 'japanese', 'SWIPE_RIGHT')
    expect(w.thai).toBeUndefined()
  })
})

describe('coerceWeights', () => {
  it('passes through a clean map', () => {
    expect(coerceWeights({ japanese: 3 })).toEqual({ japanese: 3 })
  })

  it('drops non-numeric and non-finite values', () => {
    expect(
      coerceWeights({ a: 1, b: 'x', c: null, d: Number.NaN, e: Number.POSITIVE_INFINITY }),
    ).toEqual({ a: 1 })
  })

  it('returns an empty map for junk', () => {
    expect(coerceWeights(null)).toEqual({})
    expect(coerceWeights([1, 2])).toEqual({})
    expect(coerceWeights('nope')).toEqual({})
  })
})

/* ------------------------------------------------------------------ */
/* The onboarding taste quiz's contribution                            */
/* ------------------------------------------------------------------ */

describe('quizWeightsFrom', () => {
  it('gives every loved cuisine +2 and every disliked one -2', () => {
    const w = quizWeightsFrom(['Japanese', 'Pizza'], ['Seafood'])
    expect(w).toEqual({ japanese: 2, pizza: 2, seafood: -2 })
    expect(QUIZ_LOVE_DELTA).toBe(2)
    expect(QUIZ_DISLIKE_DELTA).toBe(-2)
  })

  it('normalises cuisine keys', () => {
    expect(quizWeightsFrom([' Japanese '], [])).toEqual({ japanese: 2 })
  })

  it('is empty for a fully skipped quiz', () => {
    expect(quizWeightsFrom([], [])).toEqual({})
    expect(quizWeightsFrom(null, undefined)).toEqual({})
  })

  it('ignores blank entries', () => {
    expect(quizWeightsFrom(['', '  ', 'Thai'], [])).toEqual({ thai: 2 })
  })

  // "I avoid this" is the more specific statement, and serving it anyway is the
  // worse failure of the two.
  it('resolves a cuisine on both lists to DISLIKE', () => {
    expect(quizWeightsFrom(['Japanese'], ['Japanese'])).toEqual({ japanese: -2 })
  })

  /**
   * The whole idempotency story: the quiz is a pure function of its stored
   * answers, so re-taking it cannot stack. Re-deriving ten times is identical
   * to deriving once.
   */
  it('is idempotent — re-deriving never stacks the deltas', () => {
    const once = quizWeightsFrom(['Japanese'], [])
    for (let i = 0; i < 10; i++) {
      expect(quizWeightsFrom(['Japanese'], [])).toEqual(once)
    }
    expect(once.japanese).toBe(2)
  })

  it('does not decay — a stated preference is standing, not stale', () => {
    // Contrast with applyEventToWeights, which decays everything on each call.
    expect(quizWeightsFrom(['Japanese'], []).japanese).toBe(
      quizWeightsFrom(['Japanese'], []).japanese,
    )
  })
})

describe('effectiveTasteWeights', () => {
  it('sums learned and quiz weights rather than overwriting either', () => {
    expect(effectiveTasteWeights({ japanese: 3 }, { japanese: 2 })).toEqual({
      japanese: 5,
    })
  })

  it('keeps keys that exist on only one side', () => {
    expect(effectiveTasteWeights({ thai: 1 }, { pizza: 2 })).toEqual({
      thai: 1,
      pizza: 2,
    })
  })

  it('lets a swipe-learned preference offset a quiz dislike', () => {
    // The user said they avoid it, then kept choosing it. Both signals count.
    expect(effectiveTasteWeights({ japanese: 3 }, { japanese: -2 }).japanese).toBe(1)
  })

  it('clamps the sum to the normal weight range', () => {
    expect(effectiveTasteWeights({ japanese: 9 }, { japanese: 2 }).japanese).toBe(
      WEIGHT_MAX,
    )
    expect(effectiveTasteWeights({ seafood: -4 }, { seafood: -2 }).seafood).toBe(
      WEIGHT_MIN,
    )
  })

  it('is a no-op for a user who skipped the quiz', () => {
    expect(effectiveTasteWeights({ japanese: 3 }, {})).toEqual({ japanese: 3 })
  })

  it('is empty for a brand-new user who skipped everything', () => {
    expect(effectiveTasteWeights({}, {})).toEqual({})
  })

  it('does not mutate either input', () => {
    const learned = { japanese: 3 }
    const quiz = { japanese: 2 }
    effectiveTasteWeights(learned, quiz)
    expect(learned).toEqual({ japanese: 3 })
    expect(quiz).toEqual({ japanese: 2 })
  })
})
