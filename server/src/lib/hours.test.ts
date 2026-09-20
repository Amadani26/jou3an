import { describe, expect, it } from 'vitest'
import { dubaiWeekMinutes, hasKnownHours, isOpenNow, parsePeriods } from './hours'

/**
 * Dubai is UTC+4 with no DST, so a UTC instant maps to Dubai wall-clock by
 * adding 4 hours. Every fixture below is written as an explicit UTC instant and
 * annotated with the Dubai time it corresponds to, so the expectations stay
 * readable without re-deriving the offset each time.
 */
const utc = (iso: string) => new Date(iso)

/** Mon 2026-09-21 12:00 UTC == Mon 16:00 Dubai. */
const MON_1600_DUBAI = utc('2026-09-21T12:00:00Z')
/** Mon 2026-09-21 04:00 UTC == Mon 08:00 Dubai. */
const MON_0800_DUBAI = utc('2026-09-21T04:00:00Z')
/** Sat 2026-09-19 20:00 UTC == Sun 2026-09-20 00:00 Dubai. */
const SUN_0000_DUBAI = utc('2026-09-19T20:00:00Z')

const hours = (periods: unknown) => ({ openingHours: periods })

describe('dubaiWeekMinutes', () => {
  it('converts a UTC instant to Dubai wall-clock minutes since Sunday 00:00', () => {
    // Monday = day 1, 16:00 -> 1*1440 + 960
    expect(dubaiWeekMinutes(MON_1600_DUBAI)).toBe(1 * 1440 + 16 * 60)
  })

  it('rolls into the next Dubai day when UTC is still on the previous one', () => {
    // 20:00 UTC Saturday is already midnight Sunday in Dubai -> day 0, 00:00.
    expect(dubaiWeekMinutes(SUN_0000_DUBAI)).toBe(0)
  })
})

describe('parsePeriods', () => {
  it('accepts a bare periods array', () => {
    const p = parsePeriods([{ open: { day: 1, hour: 9 }, close: { day: 1, hour: 17 } }])
    expect(p).toHaveLength(1)
  })

  it('accepts a whole regularOpeningHours object', () => {
    const p = parsePeriods({
      periods: [{ open: { day: 1, hour: 9 }, close: { day: 1, hour: 17 } }],
    })
    expect(p).toHaveLength(1)
  })

  it('returns null for unknown / empty / malformed hours', () => {
    expect(parsePeriods(null)).toBeNull()
    expect(parsePeriods([])).toBeNull()
    expect(parsePeriods({ periods: [] })).toBeNull()
    // day out of range and a missing open are both unusable.
    expect(parsePeriods([{ open: { day: 9, hour: 9 } }])).toBeNull()
    expect(parsePeriods([{ close: { day: 1, hour: 17 } }])).toBeNull()
  })
})

describe('isOpenNow', () => {
  it('is open inside a simple same-day period', () => {
    const r = hours([{ open: { day: 1, hour: 9 }, close: { day: 1, hour: 17 } }])
    expect(isOpenNow(r, MON_0800_DUBAI)).toBe(false) // 08:00, opens at 09:00
    expect(isOpenNow(r, MON_1600_DUBAI)).toBe(true) // 16:00
  })

  it('treats the close minute as exclusive and the open minute as inclusive', () => {
    const r = hours([{ open: { day: 1, hour: 9 }, close: { day: 1, hour: 17 } }])
    // Mon 05:00 UTC == 09:00 Dubai exactly.
    expect(isOpenNow(r, utc('2026-09-21T05:00:00Z'))).toBe(true)
    // Mon 13:00 UTC == 17:00 Dubai exactly.
    expect(isOpenNow(r, utc('2026-09-21T13:00:00Z'))).toBe(false)
  })

  it('handles an overnight period that runs past midnight', () => {
    // Fri 22:00 -> Sat 02:00 Dubai.
    const r = hours([{ open: { day: 5, hour: 22 }, close: { day: 6, hour: 2 } }])

    // Fri 2026-09-25 19:00 UTC == Fri 23:00 Dubai -> open.
    expect(isOpenNow(r, utc('2026-09-25T19:00:00Z'))).toBe(true)
    // Fri 2026-09-25 21:30 UTC == Sat 01:30 Dubai -> still open.
    expect(isOpenNow(r, utc('2026-09-25T21:30:00Z'))).toBe(true)
    // Fri 2026-09-25 23:00 UTC == Sat 03:00 Dubai -> closed.
    expect(isOpenNow(r, utc('2026-09-25T23:00:00Z'))).toBe(false)
    // Fri 2026-09-25 17:00 UTC == Fri 21:00 Dubai -> not yet open.
    expect(isOpenNow(r, utc('2026-09-25T17:00:00Z'))).toBe(false)
  })

  it('handles a period that wraps the week boundary (Sat night into Sunday)', () => {
    // Sat 23:00 -> Sun 03:00 Dubai. close (day 0) sorts BEFORE open (day 6),
    // so this only works if the close rolls a week forward.
    const r = hours([{ open: { day: 6, hour: 23 }, close: { day: 0, hour: 3 } }])

    // Sat 2026-09-26 20:00 UTC == Sun 00:00 Dubai -> inside the wrap.
    expect(isOpenNow(r, utc('2026-09-26T20:00:00Z'))).toBe(true)
    // Sat 2026-09-26 19:30 UTC == Sat 23:30 Dubai -> inside, before midnight.
    expect(isOpenNow(r, utc('2026-09-26T19:30:00Z'))).toBe(true)
    // Sat 2026-09-26 23:30 UTC == Sun 03:30 Dubai -> shut.
    expect(isOpenNow(r, utc('2026-09-26T23:30:00Z'))).toBe(false)
  })

  it('treats a period with no close as open 24/7', () => {
    const r = hours([{ open: { day: 0, hour: 0, minute: 0 } }])
    expect(isOpenNow(r, MON_0800_DUBAI)).toBe(true)
    expect(isOpenNow(r, SUN_0000_DUBAI)).toBe(true)
    expect(isOpenNow(r, utc('2026-09-23T22:15:00Z'))).toBe(true)
  })

  it('is open on any day that has a matching period', () => {
    const r = hours([
      { open: { day: 1, hour: 9 }, close: { day: 1, hour: 17 } },
      { open: { day: 2, hour: 9 }, close: { day: 2, hour: 17 } },
    ])
    // Tue 2026-09-22 12:00 UTC == Tue 16:00 Dubai.
    expect(isOpenNow(r, utc('2026-09-22T12:00:00Z'))).toBe(true)
    // Wed 2026-09-23 12:00 UTC == Wed 16:00 Dubai -> no Wednesday period.
    expect(isOpenNow(r, utc('2026-09-23T12:00:00Z'))).toBe(false)
  })

  it('respects minutes, not just hours', () => {
    const r = hours([
      { open: { day: 1, hour: 9, minute: 30 }, close: { day: 1, hour: 17, minute: 45 } },
    ])
    // Mon 05:15 UTC == 09:15 Dubai -> not yet.
    expect(isOpenNow(r, utc('2026-09-21T05:15:00Z'))).toBe(false)
    // Mon 05:45 UTC == 09:45 Dubai -> open.
    expect(isOpenNow(r, utc('2026-09-21T05:45:00Z'))).toBe(true)
    // Mon 13:50 UTC == 17:50 Dubai -> shut.
    expect(isOpenNow(r, utc('2026-09-21T13:50:00Z'))).toBe(false)
  })

  it('assumes OPEN when hours are unknown, rather than filtering the row away', () => {
    // This is the deliberate bias: missing Places data is our gap, not evidence
    // the restaurant is shut, and treating it as closed would shrink the pool
    // and fight the "always exactly 3" rule.
    expect(isOpenNow({ openingHours: null }, MON_0800_DUBAI)).toBe(true)
    expect(isOpenNow({}, MON_0800_DUBAI)).toBe(true)
    expect(isOpenNow({ openingHours: [] }, MON_0800_DUBAI)).toBe(true)
  })

  it('distinguishes "assumed open" from "known open" via hasKnownHours', () => {
    expect(hasKnownHours({ openingHours: null })).toBe(false)
    expect(
      hasKnownHours(hours([{ open: { day: 1, hour: 9 }, close: { day: 1, hour: 17 } }])),
    ).toBe(true)
  })
})
