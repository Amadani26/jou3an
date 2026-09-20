import { describe, expect, it } from 'vitest'
import {
  CUISINE_FALLBACK,
  PRICE_FALLBACK,
  areaFromPlace,
  cuisineFromTypes,
  priceRangeFor,
  slugify,
} from './importMapping'

describe('cuisineFromTypes', () => {
  it('prefers primaryType', () => {
    expect(cuisineFromTypes('japanese_restaurant')).toBe('Japanese')
    expect(cuisineFromTypes('lebanese_restaurant')).toBe('Lebanese')
    expect(cuisineFromTypes('hamburger_restaurant')).toBe('American Burgers')
  })

  it('collapses related types onto one cuisine', () => {
    // Sushi and ramen are both "Japanese" as far as the catalogue is concerned.
    expect(cuisineFromTypes('sushi_restaurant')).toBe('Japanese')
    expect(cuisineFromTypes('ramen_restaurant')).toBe('Japanese')
    expect(cuisineFromTypes('vegan_restaurant')).toBe('Healthy')
    expect(cuisineFromTypes('vegetarian_restaurant')).toBe('Healthy')
  })

  it('falls back to the secondary types when primaryType is useless', () => {
    expect(cuisineFromTypes('restaurant', ['restaurant', 'italian_restaurant'])).toBe('Italian')
  })

  it('skips generic types that describe every row', () => {
    expect(
      cuisineFromTypes('restaurant', ['food', 'point_of_interest', 'establishment']),
    ).toBe(CUISINE_FALLBACK)
  })

  it('falls back to International when nothing is recognisable', () => {
    expect(cuisineFromTypes(null, null)).toBe(CUISINE_FALLBACK)
    expect(cuisineFromTypes('spaceship_restaurant')).toBe(CUISINE_FALLBACK)
    expect(cuisineFromTypes(undefined, [])).toBe(CUISINE_FALLBACK)
  })
})

describe('areaFromPlace', () => {
  it('reads the district out of the address', () => {
    expect(areaFromPlace('The Walk, Dubai Marina, Dubai')).toBe('MARINA')
    expect(areaFromPlace('Cluster T, Jumeirah Lakes Towers, Dubai')).toBe('JLT')
    expect(areaFromPlace('Gate Village 8, DIFC, Dubai')).toBe('DIFC')
    expect(areaFromPlace('Sheikh Mohammed bin Rashid Blvd, Downtown Dubai')).toBe('DOWNTOWN')
    expect(areaFromPlace('Bay Avenue, Business Bay, Dubai')).toBe('BUSINESS_BAY')
  })

  it('treats JBR and Bluewaters as Marina', () => {
    // They are walking distance and the catalogue already files JBR under
    // MARINA (Operation Falafel).
    expect(areaFromPlace('The Beach, JBR, Dubai')).toBe('MARINA')
    expect(areaFromPlace('Bluewaters Island, Dubai')).toBe('MARINA')
  })

  it('prefers JLT over Marina when an address mentions both', () => {
    expect(areaFromPlace('Cluster X, JLT, near Dubai Marina')).toBe('JLT')
  })

  it('falls back to coordinates when the address says nothing useful', () => {
    // Dubai Marina coordinates, generic address.
    expect(areaFromPlace('Unit 4, Dubai', { lat: 25.0805, lng: 55.1403 })).toBe('MARINA')
    expect(areaFromPlace(null, { lat: 25.211, lng: 55.2796 })).toBe('DIFC')
  })

  it('returns OTHER rather than guessing between distant centroids', () => {
    // Hatta — nowhere near any of our areas.
    expect(areaFromPlace('Hatta, Dubai', { lat: 24.7997, lng: 56.1216 })).toBe('OTHER')
    // Deira: inside Dubai but outside every catalogued district.
    expect(areaFromPlace('Deira, Dubai', { lat: 25.2697, lng: 55.3095 })).toBe('OTHER')
  })

  it('returns OTHER with no address and no coordinates', () => {
    expect(areaFromPlace(null, null)).toBe('OTHER')
    expect(areaFromPlace(undefined, undefined)).toBe('OTHER')
  })

  it('does not let a tight centroid claim a neighbouring district', () => {
    // Downtown coords must not come back as DIFC even though they are ~1.5 km
    // apart — the radii are deliberately tight for exactly this reason.
    expect(areaFromPlace(null, { lat: 25.1972, lng: 55.2744 })).toBe('DOWNTOWN')
  })
})

describe('priceRangeFor', () => {
  it('maps each Google band to an AED range', () => {
    expect(priceRangeFor('PRICE_LEVEL_INEXPENSIVE')).toEqual({ min: 20, max: 55 })
    expect(priceRangeFor('PRICE_LEVEL_MODERATE')).toEqual({ min: 50, max: 120 })
    expect(priceRangeFor('PRICE_LEVEL_EXPENSIVE')).toEqual({ min: 120, max: 280 })
    expect(priceRangeFor('PRICE_LEVEL_VERY_EXPENSIVE')).toEqual({ min: 280, max: 600 })
  })

  it('falls back to mid-market when Google has no price signal', () => {
    expect(priceRangeFor(null)).toEqual(PRICE_FALLBACK)
    expect(priceRangeFor(undefined)).toEqual(PRICE_FALLBACK)
    expect(priceRangeFor('PRICE_LEVEL_UNSPECIFIED')).toEqual(PRICE_FALLBACK)
  })

  it('always produces min <= max', () => {
    for (const lvl of [
      'PRICE_LEVEL_FREE',
      'PRICE_LEVEL_INEXPENSIVE',
      'PRICE_LEVEL_MODERATE',
      'PRICE_LEVEL_EXPENSIVE',
      'PRICE_LEVEL_VERY_EXPENSIVE',
      null,
    ]) {
      const { min, max } = priceRangeFor(lvl)
      expect(min).toBeLessThanOrEqual(max)
    }
  })
})

describe('slugify', () => {
  it('makes a filesystem-safe base name', () => {
    expect(slugify('Dubai Marina')).toBe('dubai-marina')
    expect(slugify('JLT / Cluster X')).toBe('jlt-cluster-x')
    expect(slugify('  Japanese  ')).toBe('japanese')
  })
})
