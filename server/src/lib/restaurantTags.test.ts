import { describe, expect, it } from 'vitest'
import {
  LATE_NIGHT_MIN_NIGHTS,
  LLM_TAG_SLUGS,
  MAX_LLM_TAGS,
  TAGS_SYSTEM,
  TAG_SLUGS,
  TAG_VOCABULARY,
  buildTagsPrompt,
  isLateNight,
  mergeTags,
  parseTagsReply,
  rulesTagsFor,
  type TagSource,
} from './restaurantTags'

const row = (over: Partial<TagSource> = {}): TagSource => ({
  name: 'Test Place',
  cuisineType: 'International',
  tags: [],
  priceMin: 100,
  priceMax: 200,
  googlePrimaryType: 'restaurant',
  googleTypes: ['restaurant', 'food', 'point_of_interest', 'establishment'],
  openingHours: null,
  description: null,
  ...over,
})

/** N nights opening 19:00 and closing at `closeHour` the NEXT day. */
const overnight = (nights: number, closeHour: number) =>
  Array.from({ length: nights }, (_, i) => ({
    open: { day: i, hour: 19, minute: 0 },
    close: { day: (i + 1) % 7, hour: closeHour, minute: 0 },
  }))

describe('the vocabulary', () => {
  it('is all lowercase kebab slugs with labels', () => {
    for (const def of TAG_VOCABULARY) {
      expect(def.slug).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.hint.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate slugs and no type claimed by two tags', () => {
    expect(new Set(TAG_SLUGS).size).toBe(TAG_SLUGS.length)
    const types = TAG_VOCABULARY.flatMap((t) => [...t.types])
    expect(new Set(types).size).toBe(types.length)
  })

  it('keeps the rules-only slugs out of the LLM prompt and subset', () => {
    const RULES_ONLY = ['quick', 'family-friendly', 'bbq', 'fine-dining']
    for (const slug of RULES_ONLY) {
      expect(TAG_SLUGS).toContain(slug) // still real tags, rules still assign them
      expect(LLM_TAG_SLUGS).not.toContain(slug)
      expect(TAGS_SYSTEM).not.toContain(`- ${slug}:`)
    }
    // Everything else is still offered.
    expect(LLM_TAG_SLUGS.length).toBe(TAG_SLUGS.length - RULES_ONLY.length)
  })

  it('never offers a sentiment word as a tag', () => {
    // The compliance line: a chip must be a checkable category, not a feeling.
    for (const banned of ['cozy', 'ambience', 'romantic', 'popular', 'best']) {
      expect(TAG_SLUGS).not.toContain(banned)
    }
  })
})

describe('rulesTagsFor', () => {
  it('maps Google types from BOTH primaryType and the types array', () => {
    expect(
      rulesTagsFor(row({ googlePrimaryType: 'steak_house' })),
    ).toContain('steakhouse')
    expect(
      rulesTagsFor(row({ googleTypes: ['restaurant', 'seafood_restaurant'] })),
    ).toContain('seafood')
  })

  it('never derives a price chip — the band is a guess on most imported rows', () => {
    expect(rulesTagsFor(row({ priceMin: 20, priceMax: 60 }))).toEqual([])
    expect(TAG_SLUGS).not.toContain('cheap')
  })

  it('returns tags in vocabulary (display-priority) order', () => {
    const tags = rulesTagsFor(
      row({
        openingHours: overnight(3, 2), // late-night — mid-vocabulary
        googleTypes: ['breakfast_restaurant', 'seafood_restaurant', 'restaurant'],
      }),
    )
    expect(tags).toEqual(['seafood', 'breakfast', 'late-night'])
  })

  it('ignores cafe/coffee_shop and cuisine-shaped types entirely', () => {
    expect(
      rulesTagsFor(row({ googleTypes: ['cafe', 'coffee_shop', 'pizza_restaurant'] })),
    ).toEqual([])
  })

  it('is pure — the same row twice gives the same answer', () => {
    const r = row({ googleTypes: ['hookah_bar', 'bar', 'restaurant'] })
    expect(rulesTagsFor(r)).toEqual(rulesTagsFor(r))
  })
})

describe('isLateNight', () => {
  it('needs at least LATE_NIGHT_MIN_NIGHTS past-midnight closes', () => {
    expect(isLateNight(overnight(LATE_NIGHT_MIN_NIGHTS - 1, 2))).toBe(false)
    expect(isLateNight(overnight(LATE_NIGHT_MIN_NIGHTS, 2))).toBe(true)
  })

  it('a close at exactly midnight is not late-night', () => {
    expect(isLateNight(overnight(7, 0))).toBe(false)
  })

  it('a no-close period (24/7) qualifies outright', () => {
    expect(isLateNight([{ open: { day: 0, hour: 0 } }])).toBe(true)
  })

  it('unknown hours are NOT late-night — absence of data asserts nothing', () => {
    expect(isLateNight(null)).toBe(false)
    expect(isLateNight([])).toBe(false)
  })

  it('same-day closes never count, even late ones', () => {
    const sameDay = Array.from({ length: 7 }, (_, i) => ({
      open: { day: i, hour: 12, minute: 0 },
      close: { day: i, hour: 23, minute: 30 },
    }))
    expect(isLateNight(sameDay)).toBe(false)
  })
})

describe('mergeTags', () => {
  it('appends new tags without touching existing ones', () => {
    expect(mergeTags(['comfort', 'date-night'], ['steakhouse', 'late-night'])).toEqual([
      'comfort',
      'date-night',
      'steakhouse',
      'late-night',
    ])
  })

  it('never duplicates, case-insensitively', () => {
    expect(mergeTags(['Late-Night'], ['late-night', 'cheap'])).toEqual([
      'Late-Night',
      'cheap',
    ])
  })

  it('leaves a hand-curated row alone when nothing is new', () => {
    const existing = ['quick', 'cheap']
    expect(mergeTags(existing, ['cheap', 'quick'])).toEqual(existing)
  })
})

describe('parseTagsReply', () => {
  it('accepts a clean comma-separated reply, in vocabulary order', () => {
    const p = parseTagsReply('late-night, seafood')
    expect(p.ok).toBe(true)
    expect(p.tags).toEqual(['seafood', 'late-night'])
  })

  it('accepts "none" as zero tags', () => {
    expect(parseTagsReply('none')).toEqual({ ok: true, tags: [], problems: [] })
    expect(parseTagsReply('None.').ok).toBe(true)
  })

  it('rejects anything outside the vocabulary rather than trimming it', () => {
    const p = parseTagsReply('seafood, cozy-vibes')
    expect(p.ok).toBe(false)
    expect(p.problems.join(' ')).toContain('cozy-vibes')
  })

  it('rejects more than MAX_LLM_TAGS', () => {
    const p = parseTagsReply(TAG_SLUGS.slice(0, MAX_LLM_TAGS + 1).join(', '))
    expect(p.ok).toBe(false)
  })

  it('strips labels and quoting the way models add them', () => {
    const p = parseTagsReply('Tags: "shisha, late-night"')
    expect(p.ok).toBe(true)
    expect(p.tags).toEqual(['shisha', 'late-night'])
  })

  it('de-dupes a repeated slug', () => {
    expect(parseTagsReply('buffet, buffet').tags).toEqual(['buffet'])
  })

  it('rejects a RULES-ONLY slug exactly like an invented one', () => {
    // The 2026-10-20 audit: the LLM inflated these four from circular or
    // name-based evidence, so it is no longer offered them — and a reply
    // containing one must be a rejection, not a quiet acceptance.
    for (const slug of ['quick', 'family-friendly', 'bbq', 'fine-dining']) {
      const p = parseTagsReply(slug)
      expect(p.ok).toBe(false)
      expect(p.problems.join(' ')).toContain(slug)
    }
  })
})

describe('buildTagsPrompt', () => {
  it('carries only stored facts and omits what is unknown', () => {
    const prompt = buildTagsPrompt(row({ description: null }))
    expect(prompt).toContain('Name: Test Place')
    expect(prompt).toContain('Price band: MID')
    expect(prompt).not.toContain('Description:')
    expect(prompt.toLowerCase()).not.toContain('unknown')
  })

  it('omits the price band entirely for an unknown price', () => {
    const prompt = buildTagsPrompt(row({ priceMin: null, priceMax: null }))
    expect(prompt).not.toContain('Price band')
    expect(prompt.toLowerCase()).not.toContain('unknown')
  })

  it('drops the generic types from the fact list', () => {
    const prompt = buildTagsPrompt(row())
    expect(prompt).not.toContain("Google's categories")
  })

  it('states the late-night fact so the model cannot invent hours', () => {
    expect(buildTagsPrompt(row())).toContain('Open past midnight: no')
    expect(
      buildTagsPrompt(row({ openingHours: overnight(3, 3) })),
    ).toContain('Open past midnight: yes')
  })
})
