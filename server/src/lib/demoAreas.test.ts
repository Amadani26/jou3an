import { describe, expect, it } from 'vitest'
import { DEMO_AREAS, decideForArea, demoArea, matchesDemoArea } from './demoAreas'
import { nextOpeningLabel } from './hours'
import { restaurant } from '../services/engine/fixtures'

const MARINA = demoArea('MARINA')!
const DOWNTOWN = demoArea('DOWNTOWN')!

/** Daily 12:00–23:00 — closed in the small hours. */
const DAY_HOURS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  open: { day, hour: 12, minute: 0 },
  close: { day, hour: 23, minute: 0 },
}))

/** 2026-11-03 05:00 Dubai (01:00 UTC) — everything on DAY_HOURS is closed. */
const NIGHT = new Date('2026-11-03T01:00:00Z')
/** 2026-11-03 14:00 Dubai — everything on DAY_HOURS is open. */
const DAY = new Date('2026-11-03T10:00:00Z')

const inMarina = (over = {}) =>
  restaurant({ areaName: 'Dubai Marina', googleRating: 4.5, ...over })

describe('matchesDemoArea — the exact mapping', () => {
  it('Marina is Dubai Marina only — in either language', () => {
    expect(matchesDemoArea({ areaName: 'Dubai Marina' }, MARINA)).toBe(true)
    expect(matchesDemoArea({ areaName: 'دبي مارينا' }, MARINA)).toBe(true)
  })

  it('Marina is NOT JBR, Bluewaters or JLT', () => {
    expect(matchesDemoArea({ areaName: 'Jumeirah Beach Residence' }, MARINA)).toBe(false)
    expect(matchesDemoArea({ areaName: 'Bluewaters Island' }, MARINA)).toBe(false)
    expect(matchesDemoArea({ areaName: 'Jumeirah Lakes Towers' }, MARINA)).toBe(false)
  })

  it('Downtown collects its real spellings, including Dubai Mall', () => {
    expect(matchesDemoArea({ areaName: 'Downtown Dubai' }, DOWNTOWN)).toBe(true)
    expect(matchesDemoArea({ areaName: 'وسط مدينة دبي' }, DOWNTOWN)).toBe(true)
    expect(matchesDemoArea({ areaName: 'Dubai Mall' }, DOWNTOWN)).toBe(true)
    expect(matchesDemoArea({ areaName: 'Business Bay' }, DOWNTOWN)).toBe(false)
  })

  it('a row with no areaName belongs to no chip', () => {
    for (const a of DEMO_AREAS) {
      expect(matchesDemoArea({ areaName: null }, a)).toBe(false)
    }
  })

  it('JBR is not offered as a chip (3 non-bar rows cannot reliably field 3)', () => {
    expect(demoArea('JBR')).toBeNull()
  })
})

describe('decideForArea — three places THERE, never widened', () => {
  it('returns exactly 3, all inside the tapped area, even when better-rated places exist elsewhere', () => {
    const candidates = [
      inMarina({ googleRating: 4.2, cuisineType: 'Lebanese' }),
      inMarina({ googleRating: 4.1, cuisineType: 'Japanese' }),
      inMarina({ googleRating: 4.0, cuisineType: 'Italian' }),
      inMarina({ googleRating: 3.9, cuisineType: 'Thai' }),
      // Louder options OUTSIDE the area — a radius ladder would grab these.
      restaurant({ areaName: 'Downtown Dubai', googleRating: 5.0 }),
      restaurant({ areaName: 'Jumeirah Beach Residence', googleRating: 5.0 }),
      restaurant({ areaName: null, googleRating: 5.0 }),
    ]
    const d = decideForArea(candidates, MARINA, DAY)
    expect(d.picks).toHaveLength(3)
    for (const p of d.picks) expect(p.restaurant.areaName).toBe('Dubai Marina')
  })

  it('never picks a bar or lounge, whatever its rating', () => {
    const candidates = [
      inMarina({ name: 'Skyline Lounge & Bar', googleRating: 5.0 }),
      inMarina({ googlePrimaryType: 'wine_bar', googleRating: 5.0 }),
      inMarina({ cuisineType: 'Lebanese' }),
      inMarina({ cuisineType: 'Japanese' }),
      inMarina({ cuisineType: 'Italian' }),
    ]
    const d = decideForArea(candidates, MARINA, DAY)
    expect(d.picks).toHaveLength(3)
    for (const p of d.picks) {
      expect(p.restaurant.name).not.toMatch(/\b(bar|lounge)\b/i)
      expect(p.restaurant.googlePrimaryType).not.toBe('wine_bar')
    }
  })

  it('relaxes OPEN NOW within the area — never the area — when the night leaves fewer than 3 open', () => {
    const candidates = [
      inMarina({ openingHours: DAY_HOURS, cuisineType: 'Lebanese' }),
      inMarina({ openingHours: DAY_HOURS, cuisineType: 'Japanese' }),
      inMarina({ openingHours: DAY_HOURS, cuisineType: 'Italian' }),
      // An open place OUTSIDE the area must not rescue the brief.
      restaurant({ areaName: 'Downtown Dubai', googleRating: 5.0 }),
    ]
    const d = decideForArea(candidates, MARINA, NIGHT)
    expect(d.picks).toHaveLength(3)
    for (const p of d.picks) expect(p.restaurant.areaName).toBe('Dubai Marina')
    expect(d.relaxed).toContain('hours')
  })

  it('throws rather than inventing picks when an area cannot field three at all', () => {
    const candidates = [inMarina(), inMarina()]
    expect(() => decideForArea(candidates, MARINA, DAY)).toThrow()
  })

  it('is deterministic for a given nonce', () => {
    const candidates = [0, 1, 2, 3, 4, 5].map((i) =>
      inMarina({ cuisineType: ['Lebanese', 'Japanese', 'Italian', 'Thai', 'Indian', 'French'][i] }),
    )
    const a = decideForArea(candidates, MARINA, DAY, 7)
    const b = decideForArea(candidates, MARINA, DAY, 7)
    expect(a.picks.map((p) => p.restaurant.id)).toEqual(b.picks.map((p) => p.restaurant.id))
  })
})

describe('nextOpeningLabel — what the "Opens at…" card says', () => {
  it('names the next opening of a closed place', () => {
    expect(nextOpeningLabel({ openingHours: DAY_HOURS }, NIGHT)).toBe('12:00')
  })

  it('says nothing for 24/7 or unknown hours (never reported closed)', () => {
    expect(
      nextOpeningLabel({ openingHours: [{ open: { day: 0, hour: 0 } }] }, NIGHT),
    ).toBeNull()
    expect(nextOpeningLabel({ openingHours: null }, NIGHT)).toBeNull()
  })
})
