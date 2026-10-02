import { describe, expect, it } from 'vitest'
import {
  DIETARY_NEEDS,
  conflictsWithDietary,
  dietaryEnforcement,
  knownNeeds,
  normalizeNeed,
  satisfiesDietary,
  type DietaryCandidate,
} from './dietary'

const row = (over: Partial<DietaryCandidate> = {}): DietaryCandidate => ({
  cuisineType: 'International',
  googlePrimaryType: 'restaurant',
  tags: [],
  ...over,
})

describe('knownNeeds', () => {
  it('keeps the four needs the filter understands', () => {
    expect(knownNeeds(DIETARY_NEEDS)).toHaveLength(4)
  })

  it('drops anything it cannot act on rather than guessing', () => {
    expect(knownNeeds(['vegetarian', 'keto', 'paleo', ''])).toEqual(['vegetarian'])
  })

  it('normalises spelling, case and spacing', () => {
    expect(knownNeeds([' Vegetarian ', 'GLUTEN FREE', 'no_pork'])).toEqual([
      'vegetarian',
      'gluten-free',
      'no-pork',
    ])
    expect(normalizeNeed('No Pork')).toBe('no-pork')
  })

  it('de-duplicates', () => {
    expect(knownNeeds(['vegan', 'Vegan', 'VEGAN'])).toEqual(['vegan'])
  })

  it('treats null/undefined/empty as no needs', () => {
    expect(knownNeeds(null)).toEqual([])
    expect(knownNeeds(undefined)).toEqual([])
    expect(knownNeeds([])).toEqual([])
  })
})

describe('conflictsWithDietary — no needs declared', () => {
  it('excludes nothing, which is the overwhelmingly common case', () => {
    expect(conflictsWithDietary(row({ cuisineType: 'Steakhouse' }), [])).toBe(false)
    expect(conflictsWithDietary(row({ cuisineType: 'Steakhouse' }), null)).toBe(false)
  })
})

describe('conflictsWithDietary — vegetarian', () => {
  it('excludes a steakhouse by Google primary type', () => {
    expect(
      conflictsWithDietary(row({ googlePrimaryType: 'steak_house' }), ['vegetarian']),
    ).toBe(true)
  })

  it('excludes by our own cuisine string when Google is generic', () => {
    expect(
      conflictsWithDietary(
        row({ cuisineType: 'Steakhouse', googlePrimaryType: 'restaurant' }),
        ['vegetarian'],
      ),
    ).toBe(true)
  })

  it('excludes seafood, burgers, chicken and barbecue', () => {
    for (const t of [
      'seafood_restaurant',
      'hamburger_restaurant',
      'chicken_restaurant',
      'barbecue_restaurant',
    ]) {
      expect(
        conflictsWithDietary(row({ googlePrimaryType: t }), ['vegetarian']),
        t,
      ).toBe(true)
    }
  })

  // The single most important property: it must not delete the catalogue.
  it('keeps a generic restaurant — guessing otherwise would empty the pool', () => {
    expect(conflictsWithDietary(row(), ['vegetarian'])).toBe(false)
    expect(
      conflictsWithDietary(row({ googlePrimaryType: 'family_restaurant' }), [
        'vegetarian',
      ]),
    ).toBe(false)
    expect(
      conflictsWithDietary(
        row({ cuisineType: 'Italian', googlePrimaryType: 'italian_restaurant' }),
        ['vegetarian'],
      ),
    ).toBe(false)
  })

  it('an explicit positive type overrides a meaty-looking cuisine', () => {
    expect(
      conflictsWithDietary(
        row({ cuisineType: 'Steakhouse', googlePrimaryType: 'vegetarian_restaurant' }),
        ['vegetarian'],
      ),
    ).toBe(false)
  })

  it('an explicit vegetarian-friendly tag overrides it too', () => {
    expect(
      conflictsWithDietary(
        row({ googlePrimaryType: 'steak_house', tags: ['vegetarian-friendly'] }),
        ['vegetarian'],
      ),
    ).toBe(false)
  })
})

describe('conflictsWithDietary — vegan', () => {
  it('is strictly harder than vegetarian', () => {
    const bakery = row({ googlePrimaryType: 'bakery' })
    expect(conflictsWithDietary(bakery, ['vegetarian'])).toBe(false)
    expect(conflictsWithDietary(bakery, ['vegan'])).toBe(true)
  })

  it('still excludes everything vegetarian excludes', () => {
    expect(
      conflictsWithDietary(row({ googlePrimaryType: 'steak_house' }), ['vegan']),
    ).toBe(true)
  })

  it('excludes dairy- and egg-centric formats', () => {
    for (const t of ['ice_cream_shop', 'dessert_restaurant', 'donut_shop']) {
      expect(conflictsWithDietary(row({ googlePrimaryType: t }), ['vegan']), t).toBe(
        true,
      )
    }
  })

  // A vegetarian-friendly tag is NOT a vegan clearance — that would be the one
  // place a wrong answer actually matters to someone.
  it('is not cleared by a merely vegetarian-friendly tag', () => {
    expect(
      conflictsWithDietary(
        row({ googlePrimaryType: 'steak_house', tags: ['vegetarian-friendly'] }),
        ['vegan'],
      ),
    ).toBe(true)
  })

  it('is cleared by an explicit vegan type', () => {
    expect(
      conflictsWithDietary(row({ googlePrimaryType: 'vegan_restaurant' }), ['vegan']),
    ).toBe(false)
  })
})

describe('conflictsWithDietary — gluten-free', () => {
  it('excludes pizza and bakeries', () => {
    expect(
      conflictsWithDietary(row({ googlePrimaryType: 'pizza_restaurant' }), [
        'gluten-free',
      ]),
    ).toBe(true)
    expect(conflictsWithDietary(row({ cuisineType: 'Pizza' }), ['gluten-free'])).toBe(
      true,
    )
  })

  it('does not exclude Italian at large — risotto and salads exist', () => {
    expect(
      conflictsWithDietary(
        row({ cuisineType: 'Italian', googlePrimaryType: 'italian_restaurant' }),
        ['gluten-free'],
      ),
    ).toBe(false)
  })
})

describe('conflictsWithDietary — no-pork', () => {
  /**
   * Documented behaviour, asserted so nobody "fixes" it into cuisine-level
   * stereotyping later: nothing in the data marks pork, Dubai is overwhelmingly
   * halal, and excluding whole cuisines by guess would be wrong.
   */
  it('excludes nothing at all, by design', () => {
    for (const t of [
      'chinese_restaurant',
      'korean_restaurant',
      'spanish_restaurant',
      'german_restaurant',
      'restaurant',
    ]) {
      expect(conflictsWithDietary(row({ googlePrimaryType: t }), ['no-pork']), t).toBe(
        false,
      )
    }
  })

  it('is reported as stored but NOT enforced', () => {
    const e = dietaryEnforcement(['no-pork', 'vegetarian'])
    expect(e.stored).toContain('no-pork')
    expect(e.enforced).not.toContain('no-pork')
    expect(e.enforced).toContain('vegetarian')
  })
})

describe('conflictsWithDietary — several needs at once', () => {
  it('conflicts if ANY declared need conflicts', () => {
    const pizza = row({ googlePrimaryType: 'pizza_restaurant' })
    expect(conflictsWithDietary(pizza, ['vegetarian'])).toBe(false)
    expect(conflictsWithDietary(pizza, ['vegetarian', 'gluten-free'])).toBe(true)
  })

  it('satisfiesDietary is the exact inverse', () => {
    const steak = row({ googlePrimaryType: 'steak_house' })
    expect(satisfiesDietary(steak, ['vegan'])).toBe(false)
    expect(satisfiesDietary(row(), ['vegan'])).toBe(true)
  })
})
