import { describe, expect, it } from 'vitest'
import {
  HealGate,
  buildPhotoRemap,
  placeIdFromPhotoName,
  type HealOutcome,
} from './photoHealPolicy'

const name = (place: string, photo: string) => `places/${place}/photos/${photo}`

describe('placeIdFromPhotoName', () => {
  it('extracts the place id from a valid resource name', () => {
    expect(placeIdFromPhotoName(name('ChIJabc_-123', 'AVoNoXS99'))).toBe('ChIJabc_-123')
  })

  it('rejects malformed names', () => {
    expect(placeIdFromPhotoName('places/ChIJ/photos/')).toBeNull()
    expect(placeIdFromPhotoName('places/ChIJ')).toBeNull()
    expect(placeIdFromPhotoName('nonsense')).toBeNull()
    expect(placeIdFromPhotoName('places/bad!id/photos/x')).toBeNull()
    expect(placeIdFromPhotoName('')).toBeNull()
  })
})

describe('buildPhotoRemap', () => {
  it('maps old names to fresh names by position', () => {
    const remap = buildPhotoRemap(['a', 'b', 'c'], ['x', 'y', 'z'])
    expect(remap.get('a')).toBe('x')
    expect(remap.get('b')).toBe('y')
    expect(remap.get('c')).toBe('z')
  })

  it('clamps trailing old names when Google now lists fewer photos', () => {
    const remap = buildPhotoRemap(['a', 'b', 'c'], ['x', 'y'])
    expect(remap.get('c')).toBe('y')
  })

  it('returns an empty map when there are no fresh names', () => {
    expect(buildPhotoRemap(['a', 'b'], []).size).toBe(0)
  })
})

/** A gate with a hand-cranked clock and a scripted runner. */
function makeGate(opts: Partial<ConstructorParameters<typeof HealGate>[0]> = {}) {
  let t = 1_000
  const gate = new HealGate({
    maxConcurrent: 2,
    okTtlMs: 10_000,
    failTtlMs: 5_000,
    now: () => t,
    ...opts,
  })
  return { gate, tick: (ms: number) => (t += ms) }
}

const outcome = (oldRefs: string[], freshRefs: string[]): HealOutcome => ({
  oldRefs,
  freshRefs,
})

describe('HealGate', () => {
  it('heals, remaps the failed name, and answers later names from cache', async () => {
    const { gate } = makeGate()
    let calls = 0
    const runner = async () => {
      calls++
      return outcome([name('P', 'old1'), name('P', 'old2')], [name('P', 'new1'), name('P', 'new2')])
    }

    const first = await gate.resolve(name('P', 'old2'), runner)
    expect(first).toEqual({ fresh: name('P', 'new2'), disposition: 'healed' })

    // The other five photos of the same card arrive next — zero extra calls.
    const second = await gate.resolve(name('P', 'old1'), runner)
    expect(second).toEqual({ fresh: name('P', 'new1'), disposition: 'cached' })
    expect(calls).toBe(1)
  })

  it('falls back to the first fresh name for an old name it never stored', async () => {
    const { gate } = makeGate()
    const runner = async () => outcome([name('P', 'oldA')], [name('P', 'newA')])

    const r = await gate.resolve(name('P', 'neverSeen'), runner)
    expect(r.fresh).toBe(name('P', 'newA'))
  })

  it('returns an invalid disposition without calling the runner', async () => {
    const { gate } = makeGate()
    let calls = 0
    const r = await gate.resolve('not-a-photo-name', async () => {
      calls++
      return null
    })
    expect(r).toEqual({ fresh: null, disposition: 'invalid' })
    expect(calls).toBe(0)
  })

  it('joins concurrent requests for the same place into one heal', async () => {
    const { gate } = makeGate()
    let calls = 0
    let release!: () => void
    const held = new Promise<void>((res) => (release = res))
    const runner = async () => {
      calls++
      await held
      return outcome([name('P', 'o1'), name('P', 'o2')], [name('P', 'n1'), name('P', 'n2')])
    }

    const a = gate.resolve(name('P', 'o1'), runner)
    const b = gate.resolve(name('P', 'o2'), runner)
    release()
    const [ra, rb] = await Promise.all([a, b])

    expect(calls).toBe(1)
    expect(ra.fresh).toBe(name('P', 'n1'))
    expect(rb).toEqual({ fresh: name('P', 'n2'), disposition: 'joined' })
  })

  it('answers at-capacity (placeholder) when every heal slot is busy', async () => {
    const { gate } = makeGate({ maxConcurrent: 1 })
    let release!: () => void
    const held = new Promise<void>((res) => (release = res))
    const slowRunner = async () => {
      await held
      return outcome([name('A', 'o')], [name('A', 'n')])
    }

    const first = gate.resolve(name('A', 'o'), slowRunner)
    // A different place while the only slot is taken: no runner call.
    let extraCalls = 0
    const second = await gate.resolve(name('B', 'o'), async () => {
      extraCalls++
      return null
    })
    expect(second).toEqual({ fresh: null, disposition: 'at-capacity' })
    expect(extraCalls).toBe(0)

    release()
    await first
    // Slot free again — place B may heal now.
    const third = await gate.resolve(name('B', 'o'), async () =>
      outcome([name('B', 'o')], [name('B', 'n')]),
    )
    expect(third).toEqual({ fresh: name('B', 'n'), disposition: 'healed' })
  })

  it('remembers a failed heal for the fail TTL, then allows a retry', async () => {
    const { gate, tick } = makeGate()
    let calls = 0
    const failing = async () => {
      calls++
      return null // "not our place" / nothing fresh
    }

    expect((await gate.resolve(name('P', 'o'), failing)).disposition).toBe('failed')
    expect((await gate.resolve(name('P', 'o'), failing)).disposition).toBe('cached')
    expect(calls).toBe(1)

    tick(5_001) // past failTtlMs
    expect((await gate.resolve(name('P', 'o'), failing)).disposition).toBe('failed')
    expect(calls).toBe(2)
  })

  it('treats a throwing runner as a failed heal, not an exception', async () => {
    const { gate } = makeGate()
    const r = await gate.resolve(name('P', 'o'), async () => {
      throw new Error('Places 500')
    })
    expect(r).toEqual({ fresh: null, disposition: 'failed' })
  })

  it('re-heals after the ok TTL expires', async () => {
    const { gate, tick } = makeGate()
    let calls = 0
    const runner = async () => {
      calls++
      return outcome([name('P', 'o')], [name('P', `n${calls}`)])
    }

    await gate.resolve(name('P', 'o'), runner)
    tick(10_001) // past okTtlMs
    const r = await gate.resolve(name('P', 'o'), runner)
    expect(calls).toBe(2)
    expect(r).toEqual({ fresh: name('P', 'n2'), disposition: 'healed' })
  })

  it('frees the concurrency slot even when the runner throws', async () => {
    const { gate } = makeGate({ maxConcurrent: 1 })
    await gate.resolve(name('A', 'o'), async () => {
      throw new Error('boom')
    })
    // Slot must be free for the next place.
    const r = await gate.resolve(name('B', 'o'), async () =>
      outcome([name('B', 'o')], [name('B', 'n')]),
    )
    expect(r.disposition).toBe('healed')
  })
})
