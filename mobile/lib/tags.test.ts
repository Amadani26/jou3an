import { describe, expect, it } from 'vitest'
import {
  HIGHLIGHT_LIMIT,
  TAG_LABELS,
  highlightTags,
  tagLabel,
  visibleTags,
} from './tags'

describe('tagLabel', () => {
  it('uses the curated label for a known slug', () => {
    expect(tagLabel('late-night')).toBe('Open late')
    expect(tagLabel('cheap')).toBe('Budget-friendly')
  })

  it('falls back to a prettified slug for anything it does not know', () => {
    // Drift between server vocabulary and this file must degrade, not break.
    expect(tagLabel('wood-fired')).toBe('Wood Fired')
  })

  it('is case-insensitive about stored spellings', () => {
    expect(tagLabel('Late-Night')).toBe('Open late')
  })
})

describe('highlightTags', () => {
  it('caps at HIGHLIGHT_LIMIT, keeping the highest-priority tags', () => {
    const picked = highlightTags(['cheap', 'late-night', 'steakhouse', 'brunch'])
    expect(picked).toHaveLength(HIGHLIGHT_LIMIT)
    // steakhouse (specialty) > brunch (meal) > cheap — late-night is LAST on
    // purpose (~52% of the catalogue is open late, so it is the least
    // distinctive thing a chip can say).
    expect(picked).toEqual(['steakhouse', 'brunch', 'cheap'])
  })

  it('late-night loses to every other known tag, but still shows when there is room', () => {
    expect(highlightTags(['late-night', 'healthy'])).toEqual(['healthy', 'late-night'])
  })

  it('returns [] for no tags — the caller hides the row, no placeholders', () => {
    expect(highlightTags([])).toEqual([])
    expect(highlightTags(undefined)).toEqual([])
  })

  it('still strips hidden tags', () => {
    expect(highlightTags(['halal', 'seafood'])).toEqual(['seafood'])
  })

  it('keeps hand-seeded tags outside the vocabulary, after known ones, in stored order', () => {
    expect(highlightTags(['comfort', 'high-protein', 'seafood'])).toEqual([
      'seafood',
      'comfort',
      'high-protein',
    ])
  })

  it('never mutates its input', () => {
    const input = ['cheap', 'steakhouse']
    highlightTags(input)
    expect(input).toEqual(['cheap', 'steakhouse'])
  })
})

describe('the label table', () => {
  it('has no duplicate slugs', () => {
    const slugs = TAG_LABELS.map(([s]) => s)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('visibleTags still hides halal everywhere', () => {
    expect(visibleTags(['halal', 'quick'])).toEqual(['quick'])
  })
})
