import { describe, expect, it } from 'vitest'
import { CAFE_TYPES, cafeSignals, classifyVenue, isServeable } from './venueType'

describe('classifyVenue', () => {
  it('defaults to RESTAURANT when Google tells us nothing', () => {
    expect(classifyVenue(null, null)).toBe('RESTAURANT')
    expect(classifyVenue('', [])).toBe('RESTAURANT')
    expect(classifyVenue('restaurant', ['food', 'point_of_interest'])).toBe('RESTAURANT')
  })

  it('classifies the obvious cafe primary types', () => {
    for (const t of ['cafe', 'coffee_shop', 'bakery', 'dessert_shop', 'juice_shop']) {
      expect(classifyVenue(t, null)).toBe('CAFE')
    }
  })

  it('classifies ice cream, donut and tea shops as cafes', () => {
    expect(classifyVenue('ice_cream_shop', null)).toBe('CAFE')
    expect(classifyVenue('donut_shop', null)).toBe('CAFE')
    expect(classifyVenue('tea_house', null)).toBe('CAFE')
  })

  it('trims whitespace before matching', () => {
    expect(classifyVenue('  coffee_shop  ', null)).toBe('CAFE')
  })

  it('lets a real restaurant primary type beat a secondary cafe signal', () => {
    // Half of Dubai's restaurants also carry 'cafe' in `types`.
    expect(classifyVenue('lebanese_restaurant', ['cafe', 'restaurant', 'food'])).toBe(
      'RESTAURANT',
    )
    expect(classifyVenue('hamburger_restaurant', ['bakery', 'cafe'])).toBe('RESTAURANT')
  })

  it('reads the types array when the primary type is uninformative', () => {
    expect(classifyVenue('restaurant', ['coffee_shop', 'cafe'])).toBe('CAFE')
    expect(classifyVenue(null, ['bakery', 'food'])).toBe('CAFE')
  })

  it('prefers a meal signal over a cafe signal within the types array', () => {
    expect(classifyVenue(null, ['cafe', 'pizza_restaurant'])).toBe('RESTAURANT')
    expect(classifyVenue(null, ['pizza_restaurant', 'cafe'])).toBe('RESTAURANT')
  })

  it('keeps brunch and breakfast places servable — they are a full meal', () => {
    expect(classifyVenue('brunch_restaurant', ['cafe'])).toBe('RESTAURANT')
    expect(classifyVenue('breakfast_restaurant', ['cafe', 'bakery'])).toBe('RESTAURANT')
    expect(CAFE_TYPES.has('brunch_restaurant')).toBe(false)
  })

  it('never returns anything but the two enum values', () => {
    const inputs: [string | null, string[] | null][] = [
      ['cafe', null],
      ['steak_house', ['cafe']],
      [null, null],
      ['nonsense_type', ['also_nonsense']],
    ]
    for (const [primary, types] of inputs) {
      expect(['CAFE', 'RESTAURANT']).toContain(classifyVenue(primary, types))
    }
  })
})

describe('cafeSignals', () => {
  it('lists every cafe signal, de-duplicated', () => {
    expect(cafeSignals('coffee_shop', ['coffee_shop', 'cafe', 'restaurant']).sort()).toEqual([
      'cafe',
      'coffee_shop',
    ])
  })

  it('is empty for a plain restaurant', () => {
    expect(cafeSignals('italian_restaurant', ['restaurant', 'food'])).toEqual([])
  })
})

describe('isServeable', () => {
  it('requires active AND RESTAURANT', () => {
    expect(isServeable({ isActive: true, venueType: 'RESTAURANT' })).toBe(true)
    expect(isServeable({ isActive: false, venueType: 'RESTAURANT' })).toBe(false)
    expect(isServeable({ isActive: true, venueType: 'CAFE' })).toBe(false)
    expect(isServeable({ isActive: false, venueType: 'CAFE' })).toBe(false)
  })
})
