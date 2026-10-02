import { describe, expect, it } from 'vitest'
import {
  DESCRIPTION_SYSTEM,
  HYPE_WORDS,
  MAX_CHARS,
  buildDescriptionPrompt,
  describeFacts,
  sanitizeDescription,
  splitSentences,
  validateDescription,
  type DescriptionSource,
} from './descriptions'

const source = (over: Partial<DescriptionSource> = {}): DescriptionSource => ({
  name: 'Ravi Restaurant',
  cuisineType: 'Pakistani',
  tags: ['late-night', 'group-friendly'],
  priceMin: 25,
  priceMax: 60,
  areaName: 'Al Satwa',
  area: 'OTHER',
  googleRating: 4.3,
  googlePrimaryType: 'pakistani_restaurant',
  ...over,
})

describe('describeFacts', () => {
  it('includes every known fact', () => {
    const facts = describeFacts(source())
    expect(facts).toContain('Name: Ravi Restaurant')
    expect(facts).toContain('Cuisine: Pakistani')
    expect(facts).toContain('AED 25–60')
    expect(facts).toContain('Al Satwa, Dubai')
    expect(facts).toContain('late-night, group-friendly')
    expect(facts).toContain('4.3 out of 5')
    expect(facts).toContain('pakistani restaurant')
  })

  // A prompt that mentions a gap invites the model to fill it.
  it('omits unknown fields entirely rather than saying "unknown"', () => {
    const facts = describeFacts(
      source({
        tags: [],
        googleRating: null,
        googlePrimaryType: null,
        areaName: null,
        area: 'OTHER',
      }),
    )
    expect(facts).not.toMatch(/unknown|n\/a|null/i)
    expect(facts).not.toContain('Tags:')
    expect(facts).not.toContain('Google rating:')
    expect(facts).not.toContain("Google's category")
    expect(facts).not.toContain('Neighbourhood:')
  })

  it('falls back to the coarse enum label when areaName is null', () => {
    expect(describeFacts(source({ areaName: null, area: 'BUSINESS_BAY' }))).toContain(
      'Business Bay, Dubai',
    )
  })

  it('drops blank tags instead of emitting empty list items', () => {
    expect(describeFacts(source({ tags: ['  ', 'spicy'] }))).toContain('Tags: spicy')
  })

  it('names the restaurant in the per-row prompt', () => {
    expect(buildDescriptionPrompt(source())).toContain('Ravi Restaurant')
  })

  it('tells the model it does not know the dishes or the decor', () => {
    expect(DESCRIPTION_SYSTEM).toMatch(/dishes/i)
    expect(DESCRIPTION_SYSTEM).toMatch(/decor/i)
    expect(DESCRIPTION_SYSTEM).toMatch(/exactly two sentences/i)
  })
})

describe('sanitizeDescription', () => {
  it('strips wrapping quotes', () => {
    expect(sanitizeDescription('"Two sentences. And another."')).toBe(
      'Two sentences. And another.',
    )
    expect(sanitizeDescription('“Curly ones too. Second one.”')).toBe(
      'Curly ones too. Second one.',
    )
  })

  it('leaves an internal apostrophe alone', () => {
    expect(sanitizeDescription("It's fine. Really fine.")).toBe(
      "It's fine. Really fine.",
    )
  })

  it('strips a preamble label', () => {
    expect(sanitizeDescription('Description: A place. And more.')).toBe(
      'A place. And more.',
    )
    expect(sanitizeDescription('Here is the description: A place. And more.')).toBe(
      'A place. And more.',
    )
  })

  it('collapses newlines into one paragraph and drops markdown', () => {
    expect(sanitizeDescription('**One.**\n\nTwo.')).toBe('One. Two.')
  })

  it('returns an empty string for an empty reply', () => {
    expect(sanitizeDescription('   ')).toBe('')
  })
})

describe('splitSentences', () => {
  it('counts terminal punctuation', () => {
    expect(splitSentences('One. Two.')).toHaveLength(2)
    expect(splitSentences('One. Two. Three.')).toHaveLength(3)
  })

  // "rated 4.3" must not read as two sentences.
  it('does not split on a decimal point', () => {
    expect(splitSentences('Rated 4.3 by diners. Worth a visit.')).toHaveLength(2)
  })
})

describe('validateDescription', () => {
  const good = 'Casual Pakistani food in Al Satwa, built around grills and curries. Prices are low enough for a weekday dinner with a group.'

  it('accepts a plain two-sentence line', () => {
    expect(validateDescription(good)).toEqual({ ok: true, problems: [] })
  })

  it('rejects one sentence and three sentences', () => {
    expect(validateDescription('Just the one sentence here.').ok).toBe(false)
    expect(validateDescription('One. Two. Three.').ok).toBe(false)
  })

  it('rejects a fragment with no full stop', () => {
    const v = validateDescription('One sentence. A second one with no terminator')
    expect(v.ok).toBe(false)
    expect(v.problems.join(' ')).toMatch(/full stop/)
  })

  it('rejects emojis', () => {
    const v = validateDescription('Pakistani grills in Satwa 🔥. Cheap and busy.')
    expect(v.ok).toBe(false)
    expect(v.problems.join(' ')).toMatch(/emoji/)
  })

  it('rejects exclamation marks', () => {
    expect(validateDescription('So good! Really good.').ok).toBe(false)
  })

  // The whole point of the list: a line with one of these in it would be the
  // single most noticeable thing on the screen.
  it('rejects every hype word', () => {
    for (const word of HYPE_WORDS) {
      const text = `A ${word} of a place. Worth the trip.`
      const v = validateDescription(text)
      expect(v.ok, `"${word}" should be rejected`).toBe(false)
      expect(v.problems.join(' ')).toMatch(/hype wording/)
    }
  })

  it('catches hype regardless of case', () => {
    expect(validateDescription('A Hidden Gem in Satwa. Go hungry.').ok).toBe(false)
  })

  it('rejects anything past the length cap', () => {
    const long = `${'a'.repeat(MAX_CHARS)}. And a second sentence.`
    const v = validateDescription(long)
    expect(v.ok).toBe(false)
    expect(v.problems.join(' ')).toMatch(/too long/)
  })

  it('rejects an empty string with a single reason', () => {
    expect(validateDescription('')).toEqual({ ok: false, problems: ['empty'] })
  })

  it('reports every problem at once so the retry nudge is complete', () => {
    const v = validateDescription('An authentic hidden gem! Truly iconic! A third one!')
    expect(v.ok).toBe(false)
    expect(v.problems.length).toBeGreaterThan(1)
  })
})
