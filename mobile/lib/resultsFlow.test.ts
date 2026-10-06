import { describe, expect, it } from 'vitest'
import {
  MAX_EXCLUDE_IDS,
  accumulateShown,
  dismissDetail,
  openDetail,
  type ResultsState,
} from './resultsFlow'

interface Pick {
  id: string
  name: string
}

const PICKS: Pick[] = [
  { id: 'r1', name: 'Ravi' },
  { id: 'r2', name: 'Hikari' },
  { id: 'r3', name: 'Pitfire' },
]

/** A results screen that has shown one set and is sitting on the cards. */
function screen(over: Partial<ResultsState<Pick>> = {}): ResultsState<Pick> {
  return {
    results: PICKS,
    shownIds: ['r1', 'r2', 'r3'],
    cycled: false,
    chosen: null,
    detailVisible: false,
    ...over,
  }
}

describe('dismissing the detail returns to the results', () => {
  it('leaves the SAME three results, in the same order', () => {
    const open = openDetail(screen(), PICKS[1])
    const back = dismissDetail(open)

    expect(back.results).toEqual(PICKS)
    expect(back.results.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
    // Same array identity: nothing re-fetched, nothing re-sorted.
    expect(back.results).toBe(screen().results)
  })

  it('closes the detail and clears the pending choice', () => {
    const back = dismissDetail(openDetail(screen(), PICKS[0]))
    expect(back.detailVisible).toBe(false)
    expect(back.chosen).toBeNull()
  })

  it('does not touch the refresh exclusions or the cycled flag', () => {
    const before = screen({ shownIds: ['r1', 'r2', 'r3', 'r4'], cycled: true })
    const back = dismissDetail(openDetail(before, PICKS[2]))

    expect(back.shownIds).toEqual(['r1', 'r2', 'r3', 'r4'])
    expect(back.cycled).toBe(true)
  })

  it('round-trips: open then dismiss restores the pre-open state exactly', () => {
    const before = screen()
    const after = dismissDetail(openDetail(before, PICKS[1]))
    expect(after).toEqual(before)
  })

  it('lets the user choose again after coming back', () => {
    // ⚠️ The regression this guards: `chosen` used to stay set because the flow
    // ended at Home and never returned. Back on the cards, a stale `chosen`
    // would make every later tap a no-op.
    const back = dismissDetail(openDetail(screen(), PICKS[0]))
    const second = openDetail(back, PICKS[2])

    expect(second.detailVisible).toBe(true)
    expect(second.chosen).toEqual(PICKS[2])
  })
})

describe('openDetail — the double-tap guard', () => {
  it('opens the detail for the tapped restaurant', () => {
    const open = openDetail(screen(), PICKS[1])
    expect(open.detailVisible).toBe(true)
    expect(open.chosen).toEqual(PICKS[1])
  })

  it('refuses a second open while one is already showing', () => {
    const open = openDetail(screen(), PICKS[0])
    const again = openDetail(open, PICKS[2])
    // Unchanged — a double tap must not swap the restaurant under the user,
    // and must not record a second SELECT.
    expect(again).toBe(open)
    expect(again.chosen).toEqual(PICKS[0])
  })

  it('never mutates the state it was given', () => {
    const before = screen()
    const snapshot = JSON.parse(JSON.stringify(before))
    openDetail(before, PICKS[1])
    expect(before).toEqual(snapshot)
  })
})

describe('accumulateShown — the Refresh exclusion set', () => {
  it('appends a normal page', () => {
    expect(accumulateShown(['a', 'b'], PICKS, false)).toEqual([
      'a', 'b', 'r1', 'r2', 'r3',
    ])
  })

  it('RESTARTS from the new page when the brief cycled', () => {
    // Otherwise every later Refresh hands back the same cycled trio for ever.
    expect(accumulateShown(['a', 'b', 'c'], PICKS, true)).toEqual(['r1', 'r2', 'r3'])
  })

  it('keeps the newest ids when it overflows the cap', () => {
    const long = Array.from({ length: MAX_EXCLUDE_IDS }, (_, i) => `old${i}`)
    const out = accumulateShown(long, PICKS, false)

    expect(out).toHaveLength(MAX_EXCLUDE_IDS)
    expect(out.slice(-3)).toEqual(['r1', 'r2', 'r3'])
    expect(out).not.toContain('old0')
  })
})
