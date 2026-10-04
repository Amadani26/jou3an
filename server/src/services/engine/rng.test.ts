import { describe, expect, it } from 'vitest'
import { dubaiDateString, hashSeed, seededRandom, seededShuffle } from './rng'

const deck = (n: number) => Array.from({ length: n }, (_, i) => `r${i}`)

describe('seededShuffle — the Food Tinder deal', () => {
  it('is deterministic for a seed', () => {
    expect(seededShuffle(deck(40), 12345)).toEqual(seededShuffle(deck(40), 12345))
  })

  it('deals differently for a different seed', () => {
    // The whole point of a per-session seed: a new launch is a new deck.
    expect(seededShuffle(deck(40), 1)).not.toEqual(seededShuffle(deck(40), 2))
  })

  it('actually shuffles — the order is not the input order', () => {
    const input = deck(40)
    expect(seededShuffle(input, 99)).not.toEqual(input)
  })

  it('is a permutation: every card exactly once, none invented', () => {
    const input = deck(50)
    const out = seededShuffle(input, 7)
    expect(out).toHaveLength(input.length)
    expect([...out].sort()).toEqual([...input].sort())
  })

  it('does not mutate its input', () => {
    const input = deck(10)
    const copy = [...input]
    seededShuffle(input, 3)
    expect(input).toEqual(copy)
  })

  it('pages consistently — a prefix of one deal is the prefix of the next', () => {
    // This is what makes `offset` work across requests. Fetching rows 0-19 then
    // 20-39 under one seed must give the same 40 cards, in the same order, as
    // one 40-row fetch would have.
    const pool = deck(60)
    const dealt = seededShuffle(pool, 555)
    const page1 = seededShuffle(pool, 555).slice(0, 20)
    const page2 = seededShuffle(pool, 555).slice(20, 40)
    expect([...page1, ...page2]).toEqual(dealt.slice(0, 40))
  })

  it('survives degenerate inputs', () => {
    expect(seededShuffle([], 1)).toEqual([])
    expect(seededShuffle(['only'], 1)).toEqual(['only'])
  })
})

describe('hashSeed / seededRandom', () => {
  it('hashes the same parts to the same seed', () => {
    expect(hashSeed('user', '2026-10-04', 0)).toBe(hashSeed('user', '2026-10-04', 0))
  })

  it('separates different nonces', () => {
    expect(hashSeed('user', '2026-10-04', 0)).not.toBe(hashSeed('user', '2026-10-04', 1))
  })

  it('yields a repeatable stream in [0,1)', () => {
    const a = Array.from({ length: 20 }, seededRandom(42))
    const b = Array.from({ length: 20 }, seededRandom(42))
    expect(a).toEqual(b)
    for (const n of a) {
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })

  it('reads the calendar day in Dubai, not UTC', () => {
    // 21:00 UTC is already tomorrow in Dubai (+04:00).
    expect(dubaiDateString(new Date('2026-10-04T21:00:00Z'))).toBe('2026-10-05')
  })
})
