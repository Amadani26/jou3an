import { describe, expect, it } from 'vitest'
import {
  DECAY,
  EVENT_DELTA,
  WEIGHT_MAX,
  WEIGHT_MIN,
  QUIZ_DISLIKE_DELTA,
  QUIZ_LOVE_DELTA,
  applyEventToVector,
  applyRestaurantEvent,
  coerceWeights,
  effectiveTasteVector,
  effectiveTasteWeights,
  quizWeightsFrom,
} from './tasteProfile'
import {
  CONTEXT_EVENT_SCALE,
  cuisineDimension,
  coerceVector,
  dimensionsFor,
  emptyVector,
  mealContextFor,
  priceDimension,
  tagDimension,
  weightsFor,
  type TasteVector,
} from './tasteDimensions'

/** 13:00 and 21:00 Dubai — one on each side of DINNER_FROM_HOUR. */
const LUNCHTIME = new Date('2026-09-21T09:00:00Z')
const DINNERTIME = new Date('2026-09-21T17:00:00Z')

/** A mid-priced steakhouse: four dimensions in one row. */
const STEAKHOUSE = {
  cuisineType: 'American',
  tags: ['steakhouse', 'date-night'],
  priceMin: 120,
  priceMax: 220,
}

const CUISINE = cuisineDimension('American')
const STEAK = tagDimension('steakhouse')
const MID = priceDimension('MID')

/* ------------------------------------------------------------------ */
/* Taste Vector v2 — event ingestion                                   */
/* ------------------------------------------------------------------ */

/** The pure core only — `applyTasteEvent` is the DB wrapper and isn't covered here. */
describe('applyEventToVector', () => {
  it('applies each event delta at full strength to the base on a fresh profile', () => {
    const right = applyRestaurantEvent(emptyVector(), STEAKHOUSE, 'SWIPE_RIGHT', DINNERTIME)
    const left = applyRestaurantEvent(emptyVector(), STEAKHOUSE, 'SWIPE_LEFT', DINNERTIME)
    const select = applyRestaurantEvent(emptyVector(), STEAKHOUSE, 'SELECT', DINNERTIME)

    expect(right.base[CUISINE]).toBeCloseTo(EVENT_DELTA.SWIPE_RIGHT)
    expect(left.base[CUISINE]).toBeCloseTo(EVENT_DELTA.SWIPE_LEFT)
    expect(select.base[CUISINE]).toBeCloseTo(EVENT_DELTA.SELECT)
  })

  /** THE upgrade: one event, every dimension the row matches. */
  it('credits the cuisine, EVERY tag and the price band from one event', () => {
    const v = applyRestaurantEvent(emptyVector(), STEAKHOUSE, 'SWIPE_RIGHT', DINNERTIME)

    expect(Object.keys(v.base).sort()).toEqual(
      [CUISINE, STEAK, tagDimension('date-night'), MID].sort(),
    )
    // Same delta on each — the namespaces are weighted at SCORING time, not here.
    for (const key of Object.keys(v.base)) {
      expect(v.base[key]).toBeCloseTo(EVENT_DELTA.SWIPE_RIGHT)
    }
  })

  it('writes the active meal context at half strength and leaves the other empty', () => {
    const v = applyRestaurantEvent(emptyVector(), STEAKHOUSE, 'SELECT', DINNERTIME)

    expect(v.dinner[STEAK]).toBeCloseTo(EVENT_DELTA.SELECT * CONTEXT_EVENT_SCALE)
    expect(v.lunch).toEqual({})
    // The base is what makes the split cheap: full strength regardless.
    expect(v.base[STEAK]).toBeCloseTo(EVENT_DELTA.SELECT)
  })

  it('routes a lunchtime event to the lunch map', () => {
    const v = applyRestaurantEvent(emptyVector(), STEAKHOUSE, 'SELECT', LUNCHTIME)
    expect(v.lunch[STEAK]).toBeCloseTo(EVENT_DELTA.SELECT * CONTEXT_EVENT_SCALE)
    expect(v.dinner).toEqual({})
  })

  it('decays every weight in the maps it writes before applying the delta', () => {
    const before: TasteVector = {
      base: { [CUISINE]: 4, [cuisineDimension('Lebanese')]: 2 },
      lunch: {},
      dinner: { [CUISINE]: 1 },
    }
    const after = applyRestaurantEvent(before, STEAKHOUSE, 'SWIPE_RIGHT', DINNERTIME)

    // The targeted dimension decays too, then takes the delta.
    expect(after.base[CUISINE]).toBeCloseTo(4 * DECAY + EVENT_DELTA.SWIPE_RIGHT)
    // Untouched dimensions only decay.
    expect(after.base[cuisineDimension('Lebanese')]).toBeCloseTo(2 * DECAY)
    expect(after.dinner[CUISINE]).toBeCloseTo(
      1 * DECAY + EVENT_DELTA.SWIPE_RIGHT * CONTEXT_EVENT_SCALE,
    )
  })

  /**
   * A month of dinners must not erase what we know about the user's lunches —
   * each context fades on its OWN evidence. This is the rule that makes the
   * split worth having rather than just halving the data.
   */
  it('does not decay the inactive meal context', () => {
    const before: TasteVector = { base: {}, lunch: { [STEAK]: 3 }, dinner: {} }
    let v = before
    for (let i = 0; i < 50; i++) {
      v = applyRestaurantEvent(v, STEAKHOUSE, 'SWIPE_RIGHT', DINNERTIME)
    }
    expect(v.lunch[STEAK]).toBe(3)
  })

  it('decays untouched dimensions toward neutral over many updates', () => {
    let v: TasteVector = { base: { [cuisineDimension('Lebanese')]: 5 }, lunch: {}, dinner: {} }
    for (let i = 0; i < 100; i++) {
      v = applyRestaurantEvent(v, STEAKHOUSE, 'SWIPE_RIGHT', DINNERTIME)
    }
    expect(v.base[cuisineDimension('Lebanese')]).toBeLessThan(5 * 0.2)
    // Still positive — decay erodes, it does not invert a preference.
    expect(v.base[cuisineDimension('Lebanese')]).toBeGreaterThan(0)
  })

  it('clamps every dimension to the ceiling no matter how many SELECTs land', () => {
    let v = emptyVector()
    for (let i = 0; i < 50; i++) v = applyRestaurantEvent(v, STEAKHOUSE, 'SELECT', DINNERTIME)

    for (const key of [CUISINE, STEAK, MID]) {
      expect(v.base[key]).toBeLessThanOrEqual(WEIGHT_MAX)
      expect(v.base[key]).toBeGreaterThan(WEIGHT_MAX - 1)
    }
    // The context map is clamped independently, by the same bounds.
    expect(v.dinner[STEAK]).toBeLessThanOrEqual(WEIGHT_MAX)
  })

  it('clamps to the floor no matter how many left-swipes land', () => {
    let v = emptyVector()
    for (let i = 0; i < 500; i++) {
      v = applyRestaurantEvent(v, STEAKHOUSE, 'SWIPE_LEFT', DINNERTIME)
    }
    expect(v.base[CUISINE]).toBeGreaterThanOrEqual(WEIGHT_MIN)
  })

  it('does not mutate the input', () => {
    const before: TasteVector = { base: { [CUISINE]: 4 }, lunch: {}, dinner: {} }
    applyRestaurantEvent(before, STEAKHOUSE, 'SELECT', DINNERTIME)
    expect(before.base[CUISINE]).toBe(4)
    expect(before.dinner).toEqual({})
  })

  it('normalises dimension values', () => {
    const v = applyRestaurantEvent(
      emptyVector(),
      { cuisineType: '  JaPaNeSe  ', tags: ['  SUSHI '], priceMin: 10, priceMax: 20 },
      'SELECT',
      DINNERTIME,
    )
    expect(Object.keys(v.base).sort()).toEqual(
      [cuisineDimension('japanese'), tagDimension('sushi'), priceDimension('LOW')].sort(),
    )
  })

  it('still decays when the event has no dimensions to credit', () => {
    const before: TasteVector = { base: { [CUISINE]: 4 }, lunch: {}, dinner: {} }
    const after = applyEventToVector(before, {
      dimensions: [],
      event: 'SELECT',
      meal: 'dinner',
    })
    expect(after.base[CUISINE]).toBeCloseTo(4 * DECAY)
  })

  it('prunes weights that have decayed into noise', () => {
    let v: TasteVector = { base: { [tagDimension('thai')]: 0.02 }, lunch: {}, dinner: {} }
    for (let i = 0; i < 40; i++) {
      v = applyRestaurantEvent(v, STEAKHOUSE, 'SWIPE_RIGHT', DINNERTIME)
    }
    expect(v.base[tagDimension('thai')]).toBeUndefined()
  })
})

describe('dimensionsFor', () => {
  it('namespaces the cuisine, the tags and the price band', () => {
    expect(dimensionsFor(STEAKHOUSE).sort()).toEqual(
      [CUISINE, STEAK, tagDimension('date-night'), MID].sort(),
    )
  })

  it('de-duplicates a tag that repeats the cuisine', () => {
    const keys = dimensionsFor({
      cuisineType: 'Japanese',
      tags: ['japanese'],
      priceMin: 10,
      priceMax: 20,
    })
    expect(keys.filter((k) => k === cuisineDimension('japanese'))).toHaveLength(1)
  })

  it('bands by midpoint, resolving a boundary upward', () => {
    const band = (priceMin: number, priceMax: number) =>
      dimensionsFor({ cuisineType: 'x', tags: [], priceMin, priceMax }).find((k) =>
        k.startsWith('price:'),
      )
    expect(band(40, 80)).toBe(priceDimension('LOW'))
    expect(band(100, 100)).toBe(priceDimension('MID'))
    expect(band(200, 400)).toBe(priceDimension('HIGH'))
  })

  it('is empty for a row with nothing to learn from', () => {
    expect(dimensionsFor({ cuisineType: '', tags: [] })).toEqual([])
  })
})

describe('mealContextFor', () => {
  it('splits lunch from dinner at the Dubai boundary', () => {
    expect(mealContextFor(LUNCHTIME)).toBe('lunch')
    expect(mealContextFor(DINNERTIME)).toBe('dinner')
    // 16:59 and 17:00 Dubai.
    expect(mealContextFor(new Date('2026-09-21T12:59:00Z'))).toBe('lunch')
    expect(mealContextFor(new Date('2026-09-21T13:00:00Z'))).toBe('dinner')
  })

  it('files the small hours under dinner, not lunch', () => {
    // 02:00 Dubai — a late-night shawarma run belongs to the night before.
    expect(mealContextFor(new Date('2026-09-20T22:00:00Z'))).toBe('dinner')
  })
})

describe('weightsFor — what scoring reads', () => {
  const vector: TasteVector = {
    base: { [STEAK]: 2, [CUISINE]: 1 },
    lunch: { [STEAK]: -1 },
    dinner: { [STEAK]: 1.5 },
  }

  it('sums the base and the ACTIVE meal context', () => {
    expect(weightsFor(vector, 'dinner')[STEAK]).toBeCloseTo(3.5)
    expect(weightsFor(vector, 'lunch')[STEAK]).toBeCloseTo(1)
  })

  it('lets lunch-you and dinner-you disagree', () => {
    expect(weightsFor(vector, 'dinner')[STEAK]).toBeGreaterThan(
      weightsFor(vector, 'lunch')[STEAK],
    )
  })

  it('passes base-only dimensions through unchanged', () => {
    expect(weightsFor(vector, 'lunch')[CUISINE]).toBe(1)
  })

  it('clamps the sum of two independently-clamped maps', () => {
    const maxed: TasteVector = {
      base: { [STEAK]: WEIGHT_MAX },
      lunch: {},
      dinner: { [STEAK]: WEIGHT_MAX },
    }
    expect(weightsFor(maxed, 'dinner')[STEAK]).toBe(WEIGHT_MAX)
  })

  it('is empty for a brand-new profile', () => {
    expect(weightsFor(emptyVector(), 'dinner')).toEqual({})
  })
})

/* ------------------------------------------------------------------ */
/* The v1 -> v2 migration                                              */
/* ------------------------------------------------------------------ */

describe('coerceVector', () => {
  it('reads a legacy flat cuisine map as a namespaced base, losing nothing', () => {
    const v = coerceVector({ japanese: 3, thai: 1.5 })
    expect(v.base).toEqual({
      [cuisineDimension('japanese')]: 3,
      [cuisineDimension('thai')]: 1.5,
    })
    expect(v.lunch).toEqual({})
    expect(v.dinner).toEqual({})
  })

  it('is idempotent — a migrated profile survives a second pass unchanged', () => {
    const once = coerceVector({ japanese: 3 })
    expect(coerceVector(once)).toEqual(once)
  })

  it('round-trips a v2 vector', () => {
    const v: TasteVector = { base: { [STEAK]: 2 }, lunch: { [MID]: 1 }, dinner: {} }
    expect(coerceVector(v)).toEqual(v)
  })

  it('namespaces bare keys stored inside a v2 vector', () => {
    expect(coerceVector({ base: { japanese: 3 }, lunch: {}, dinner: {} }).base).toEqual({
      [cuisineDimension('japanese')]: 3,
    })
  })

  it('drops junk values and junk shapes', () => {
    expect(coerceVector({ base: { a: 'x', b: 2 }, lunch: {}, dinner: {} }).base).toEqual({
      [cuisineDimension('b')]: 2,
    })
    expect(coerceVector(null)).toEqual(emptyVector())
    expect(coerceVector([1, 2])).toEqual(emptyVector())
    expect(coerceVector('nope')).toEqual(emptyVector())
  })
})

describe('effectiveTasteVector', () => {
  it('folds the quiz\'s cuisine weights into the BASE, namespaced', () => {
    const learned: TasteVector = { base: { [STEAK]: 2 }, lunch: {}, dinner: {} }
    const v = effectiveTasteVector(learned, quizWeightsFrom(['Japanese'], ['Seafood']))

    expect(v.base[cuisineDimension('japanese')]).toBe(QUIZ_LOVE_DELTA)
    expect(v.base[cuisineDimension('seafood')]).toBe(QUIZ_DISLIKE_DELTA)
    expect(v.base[STEAK]).toBe(2)
  })

  it('sums rather than overwrites what swiping already learned', () => {
    const learned: TasteVector = {
      base: { [cuisineDimension('japanese')]: 3 },
      lunch: {},
      dinner: {},
    }
    expect(
      effectiveTasteVector(learned, quizWeightsFrom(['Japanese'], [])).base[
        cuisineDimension('japanese')
      ],
    ).toBe(5)
  })

  it('leaves the meal contexts alone — a stated preference is not about a meal', () => {
    const learned: TasteVector = { base: {}, lunch: { [STEAK]: 1 }, dinner: {} }
    const v = effectiveTasteVector(learned, quizWeightsFrom(['Japanese'], []))
    expect(v.lunch).toEqual({ [STEAK]: 1 })
    expect(v.dinner).toEqual({})
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
    // Contrast with applyEventToVector, which decays on every event.
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
