import { describe, expect, it } from 'vitest'
import { aedRange } from './price'

describe('aedRange', () => {
  it('formats a known range', () => {
    expect(aedRange({ priceMin: 45, priceMax: 100 })).toBe('AED 45–100')
  })

  it('returns null — never a placeholder — when either bound is unknown', () => {
    // The caller hides the segment AND its separator; a dash or "AED ?" would
    // reintroduce the invented-price problem in a different costume.
    expect(aedRange({ priceMin: null, priceMax: null })).toBeNull()
    expect(aedRange({ priceMin: 45, priceMax: null })).toBeNull()
    expect(aedRange({ priceMin: null, priceMax: 100 })).toBeNull()
    expect(aedRange(null)).toBeNull()
    expect(aedRange(undefined)).toBeNull()
  })

  it('treats 0 as a real price, not as missing', () => {
    expect(aedRange({ priceMin: 0, priceMax: 20 })).toBe('AED 0–20')
  })
})
