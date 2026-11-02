import { describe, expect, it } from 'vitest'
import { isBarLike } from './barLike'

const r = (
  name: string,
  googlePrimaryType: string | null = null,
  googleTypes: string[] = [],
) => ({ name, googlePrimaryType, googleTypes })

describe('isBarLike — the public showcase/demo exclusion', () => {
  it('excludes by Google primary type', () => {
    expect(isBarLike(r('Quiet Place', 'bar'))).toBe(true)
    expect(isBarLike(r('Quiet Place', 'wine_bar'))).toBe(true)
    expect(isBarLike(r('Quiet Place', 'pub'))).toBe(true)
    expect(isBarLike(r('Quiet Place', 'night_club'))).toBe(true)
    expect(isBarLike(r('Quiet Place', 'cocktail_bar'))).toBe(true)
    expect(isBarLike(r('Quiet Place', 'lounge'))).toBe(true)
  })

  it('excludes when any stored secondary type is bar-like', () => {
    expect(isBarLike(r('Quiet Place', 'restaurant', ['food', 'bar']))).toBe(true)
    expect(isBarLike(r('Quiet Place', 'restaurant', ['wine_bar']))).toBe(true)
  })

  it('excludes by name — "Bar"/"Lounge" as words, any casing', () => {
    expect(isBarLike(r('JUYI Lounge & Bar'))).toBe(true)
    expect(isBarLike(r('Sky LOUNGE Dubai'))).toBe(true)
    expect(isBarLike(r('The Shawarma Bar'))).toBe(true)
  })

  it('never matches Bar/Lounge inside other words or place names', () => {
    expect(isBarLike(r('Al Barsha Grill'))).toBe(false)
    expect(isBarLike(r('Barbecue Nation'))).toBe(false)
    expect(isBarLike(r('Lounger Cafe'))).toBe(false)
  })

  it('keeps ordinary restaurants', () => {
    expect(isBarLike(r('Ravi Restaurant', 'restaurant', ['restaurant', 'food']))).toBe(false)
    expect(isBarLike(r('Hikāri Dubai', 'japanese_restaurant'))).toBe(false)
  })
})
