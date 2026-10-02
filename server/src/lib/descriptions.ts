/**
 * Generated "vibe" descriptions — the pure half.
 *
 * `npm run generate:descriptions` owns the Anthropic calls and the database;
 * everything that decides WHAT to ask for and whether the answer is usable
 * lives here, with no I/O, so a bad rule shows up in a test rather than in 600
 * rows of copy nobody re-reads.
 *
 * The hard constraint is that the model may use NOTHING but the stored facts.
 * We know a restaurant's name, cuisine, tags, price band, neighbourhood, Google
 * rating and Google's own place type — we do not know its signature dish, who
 * owns it, what the room looks like or when it opened. A line that invents any
 * of that reads better and is worse: it is a claim the app cannot stand behind.
 */

/** The stored columns a description is allowed to be built from. */
export interface DescriptionSource {
  name: string
  cuisineType: string
  tags: string[]
  priceMin: number
  priceMax: number
  /** Real neighbourhood; falls back to the coarse enum label. */
  areaName?: string | null
  area?: string | null
  googleRating?: number | null
  /** Google's own label ("lebanese_restaurant", "fine_dining_restaurant"). */
  googlePrimaryType?: string | null
}

/**
 * Marketing vocabulary that makes every restaurant sound like every other
 * restaurant. A rejected line is re-asked once; a line that survives with one
 * of these in it would be the single most noticeable thing on the screen.
 *
 * "authentic" and "traditional" are in here for a different reason: they are
 * claims about provenance that no stored column supports.
 */
export const HYPE_WORDS = [
  'hidden gem',
  'best-kept secret',
  'must-visit',
  'must-try',
  'must try',
  'unforgettable',
  'iconic',
  'legendary',
  'world-class',
  'award-winning',
  'authentic',
  'traditional',
  'vibrant',
  'nestled',
  'culinary journey',
  'culinary adventure',
  'feast for the senses',
  'tantalizing',
  'tantalising',
  'mouthwatering',
  'mouth-watering',
  'delight',
  'foodie',
  'to die for',
  'look no further',
  'step into',
  'elevate',
  'elevated dining',
  'experience like no other',
  'second to none',
  'bursting with flavour',
  'bursting with flavor',
]

/** Two sentences, and a cap so the 3-line clamp in the UI is never reached. */
export const MAX_CHARS = 240
export const SENTENCE_COUNT = 2

/** Google's types are snake_case labels — "fine_dining_restaurant". */
const prettyType = (t: string) => t.replace(/_/g, ' ').trim()

/** The coarse LocationArea enum, as a readable label. */
const prettyEnumArea = (a: string) =>
  a === 'OTHER'
    ? ''
    : a
        .split('_')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ')

/**
 * Everything the model is allowed to know, as a flat fact list.
 *
 * Unknown fields are OMITTED rather than sent as "unknown": a prompt that
 * mentions a gap invites the model to fill it.
 */
export function describeFacts(r: DescriptionSource): string {
  const area = r.areaName?.trim() || prettyEnumArea(r.area ?? '')
  const tags = r.tags.map((t) => t.trim()).filter(Boolean)

  const facts: string[] = [
    `Name: ${r.name}`,
    `Cuisine: ${r.cuisineType}`,
    `Typical spend per person: AED ${r.priceMin}–${r.priceMax}`,
  ]
  if (area) facts.push(`Neighbourhood: ${area}, Dubai`)
  if (tags.length) facts.push(`Tags: ${tags.join(', ')}`)
  if (typeof r.googleRating === 'number') {
    facts.push(`Google rating: ${r.googleRating.toFixed(1)} out of 5`)
  }
  if (r.googlePrimaryType) {
    facts.push(`Google's category for it: ${prettyType(r.googlePrimaryType)}`)
  }
  return facts.join('\n')
}

/**
 * The system prompt. Stable text, kept out of the per-row message so the
 * prompt cache can hold it across the whole run.
 */
export const DESCRIPTION_SYSTEM = `You write one short description per restaurant for a Dubai food app. The reader has just been shown this restaurant and wants to know what kind of meal it is.

Rules:
- Exactly two sentences. No more, no less.
- Plain, concrete, matter-of-fact. Write the way a friend describes a place, not the way a menu sells one.
- Use ONLY the facts given. You do not know the dishes, the chef, the decor, the history, the view, the service or the opening date. Do not mention any of them, not even vaguely.
- The first sentence should say what kind of food and what kind of meal it is. The second should say who it suits or what the occasion is, based on price band, tags and rating.
- No marketing language. Never write "hidden gem", "must-try", "authentic", "vibrant", "iconic", "unforgettable", "culinary journey", "nestled" or anything in that register.
- No emojis, no hashtags, no quotation marks, no markdown, no exclamation marks.
- Do not repeat the restaurant's name more than once, and never open with it twice.
- Do not state the exact rating number or the exact price range — the app already shows both. You may describe the price band in words ("mid-range", "inexpensive", "expensive").
- Reply with the two sentences only. No preamble, no labels, no options.`

/** The per-row user message. */
export function buildDescriptionPrompt(r: DescriptionSource): string {
  return `Write the description for this restaurant.\n\n${describeFacts(r)}`
}

/** Anything in the Unicode pictographic range — emoji, dingbats, symbols. */
const EMOJI_RE = /\p{Extended_Pictographic}/u

/**
 * Normalises a model reply into the exact string that would be stored.
 *
 * Strips the things models add around an answer however firmly they are asked
 * not to: wrapping quotes, a "Description:" label, markdown emphasis, stray
 * blank lines. Does NOT fix content — a hype word or a third sentence is a
 * rejection, not something to silently trim, because trimming would leave a
 * half-sentence behind.
 */
export function sanitizeDescription(raw: string): string {
  let text = (raw ?? '').trim()

  // "Description:" / "Here is the description:" preambles.
  text = text.replace(/^(here (is|are)[^:\n]*|description|answer|output)\s*:\s*/i, '')
  // Markdown emphasis and stray backticks.
  text = text.replace(/[*_`#]/g, '')
  // Collapse all whitespace — a stored description is a single paragraph.
  text = text.replace(/\s+/g, ' ').trim()
  // Wrapping quotes (straight or curly), only when they wrap the whole thing.
  const quoted = /^["'“”‘’](.*)["'“”‘’]$/.exec(text)
  if (quoted) text = quoted[1].trim()

  return text
}

/** Sentences, by terminal punctuation. Decimal points do not split a sentence. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<!\d)[.!?]+(?=\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface Validation {
  ok: boolean
  /** Human-readable reasons, for the console and for the retry nudge. */
  problems: string[]
}

/**
 * Whether a sanitized description is storable.
 *
 * Deliberately strict: this runs unattended across hundreds of rows, and a
 * rejected row simply keeps its null description — which every surface already
 * hides — whereas a bad row is live copy about a real business.
 */
export function validateDescription(text: string): Validation {
  const problems: string[] = []

  if (!text) {
    return { ok: false, problems: ['empty'] }
  }
  if (text.length > MAX_CHARS) {
    problems.push(`too long (${text.length} chars, max ${MAX_CHARS})`)
  }

  const sentences = splitSentences(text)
  if (sentences.length !== SENTENCE_COUNT) {
    problems.push(`${sentences.length} sentence(s), expected ${SENTENCE_COUNT}`)
  }
  // A trailing terminator is what makes it two sentences rather than a fragment.
  if (!/[.!?]$/.test(text)) {
    problems.push('does not end in a full stop')
  }
  if (EMOJI_RE.test(text)) {
    problems.push('contains an emoji')
  }
  if (text.includes('!')) {
    problems.push('contains an exclamation mark')
  }

  const lower = text.toLowerCase()
  const hype = HYPE_WORDS.filter((w) => lower.includes(w))
  if (hype.length) {
    problems.push(`hype wording: ${hype.join(', ')}`)
  }

  return { ok: problems.length === 0, problems }
}
