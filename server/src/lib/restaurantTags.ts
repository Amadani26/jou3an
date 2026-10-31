/**
 * Highlight tags — the pure half of `npm run generate:tags`.
 *
 * Fills `Restaurant.tags` for the whole servable catalogue (it was 8 hand-seeded
 * rows out of 580). Two passes, both defined here:
 *
 *   1. RULES — deterministic, free: Google's own taxonomy
 *      (`googlePrimaryType`/`googleTypes`), the stored opening hours and the
 *      AED price band each map onto a tag. No model involved.
 *   2. LLM — a Haiku-class pass for the rows the rules leave thin, choosing
 *      from the SAME closed vocabulary over STORED FACTS ONLY (name, cuisine,
 *      types, price band, hours, description). The model may pick fewer tags,
 *      or none; it may never invent a tag outside the vocabulary — the parser
 *      rejects the reply rather than trimming it.
 *
 * ⚠️ FACTUAL CATEGORIES ONLY. Every slug is a checkable claim about what kind
 * of place this is (a steakhouse, open past midnight, has a buffet) — never a
 * sentiment ("cozy", "good ambience") and never anything derived from review
 * text, which Google's terms do not let us synthesise from. A tag that cannot
 * be defended from a stored column does not belong in the vocabulary.
 *
 * The slugs feed three readers that must agree:
 *   - the chip rows on RestaurantDetailSheet / SelectionReward (display),
 *   - the taste vector's `tag:` namespace (tasteDimensions.ts),
 *   - the engine's MEAL_TAGS substring matching (engine/config.ts) — which is
 *     why `late-night`, `breakfast`, `brunch`, `fine-dining`, `quick`, `bar`
 *     and `shisha` reuse the exact spellings that table already matches.
 */
import { parsePeriods, type HoursPeriod } from './hours'
import { bandFor } from './priceBands'

/** The stored columns a tag may be derived from — nothing else exists to us. */
export interface TagSource {
  name: string
  cuisineType: string
  tags: string[]
  /** Null = Google has no price signal; the band fact is then OMITTED. */
  priceMin: number | null
  priceMax: number | null
  googlePrimaryType?: string | null
  googleTypes: string[]
  openingHours?: unknown
  description?: string | null
}

export interface TagDef {
  slug: string
  /** What the chip says — the slug is storage, this is display. */
  label: string
  /** Google place types that assert this tag. Empty = not type-derived. */
  types: readonly string[]
  /** One line for the LLM explaining when the tag applies. */
  hint: string
  /**
   * false = RULES-ONLY: the LLM may not assign it, and `parseTagsReply`
   * rejects it in a reply. ⚠️ Added after the 2026-10-20 accuracy audit:
   * the LLM inflated `quick` 34→269 and `family-friendly` 37→194 from
   * CIRCULAR evidence (our own GENERATED descriptions saying "quick meal" /
   * "with friends or family" — text that was itself spun from cuisine and
   * price band), `bbq` 13→37 from names ("...Grill") against contradicting
   * taxonomy (a hot-pot restaurant tagged bbq), and `fine-dining` 18→60
   * against rows' own stored price bands. Rules-only tags come from the
   * taxonomy/hours alone, where every assignment is checkable.
   */
  llm?: boolean
}

/**
 * The CLOSED vocabulary, in DISPLAY PRIORITY order (what the app shows first
 * when it caps a chip row at 3): food specialty → meal/time → format → diet →
 * price. Both passes draw from this list and nothing else.
 *
 * Deliberately absent:
 *   - cuisine-shaped types (pizza_restaurant, sushi_restaurant…) — the cuisine
 *     is already printed on the meta line next to the chips; a chip repeating
 *     it is the same fact twice.
 *   - `cafe`/`coffee_shop` — cafes are a PARKED venue type, and half of
 *     Dubai's restaurants carry `cafe` in `types` as noise (the venue
 *     classifier learned this the hard way).
 *   - anything about ambience, decor or service — no stored column supports
 *     those claims, and review-derived wording is off-limits.
 */
export const TAG_VOCABULARY: readonly TagDef[] = [
  {
    slug: 'steakhouse',
    label: 'Steakhouse',
    types: ['steak_house'],
    hint: 'a steakhouse',
  },
  {
    slug: 'seafood',
    label: 'Seafood',
    types: ['seafood_restaurant', 'oyster_bar_restaurant'],
    hint: 'specialises in seafood',
  },
  {
    slug: 'bbq',
    label: 'Grills & BBQ',
    types: ['barbecue_restaurant', 'korean_barbecue_restaurant'],
    hint: 'grills, barbecue or mixed-grill cooking',
    llm: false,
  },
  {
    slug: 'shisha',
    label: 'Shisha',
    types: ['hookah_bar'],
    hint: 'serves shisha',
  },
  {
    slug: 'buffet',
    label: 'Buffet',
    types: ['buffet_restaurant'],
    hint: 'offers a buffet',
  },
  {
    slug: 'dessert',
    label: 'Desserts',
    types: [
      'dessert_restaurant',
      'dessert_shop',
      'cake_shop',
      'pastry_shop',
      'ice_cream_shop',
    ],
    hint: 'known as a dessert place',
  },
  {
    slug: 'breakfast',
    label: 'Breakfast',
    types: ['breakfast_restaurant'],
    hint: 'a breakfast place',
  },
  {
    slug: 'brunch',
    label: 'Brunch',
    types: ['brunch_restaurant'],
    hint: 'a brunch place',
  },
  {
    slug: 'fine-dining',
    label: 'Fine dining',
    types: ['fine_dining_restaurant'],
    hint: 'a fine-dining restaurant',
    llm: false,
  },
  {
    slug: 'quick',
    label: 'Quick bite',
    types: ['fast_food_restaurant', 'meal_takeaway', 'sandwich_shop', 'food_court'],
    hint: 'fast food / counter service / grab-and-go',
    llm: false,
  },
  {
    slug: 'family-friendly',
    label: 'Family-friendly',
    types: ['family_restaurant'],
    hint: 'a family restaurant',
    llm: false,
  },
  {
    slug: 'live-music',
    label: 'Live music',
    types: ['live_music_venue'],
    hint: 'a live-music venue',
  },
  {
    slug: 'vegetarian-friendly',
    label: 'Vegetarian-friendly',
    types: ['vegetarian_restaurant', 'vegan_restaurant'],
    hint: 'vegetarian or vegan focused',
  },
  {
    slug: 'healthy',
    label: 'Healthy',
    types: ['salad_shop', 'juice_shop'],
    hint: 'salads, juices, health-focused food',
  },
  // Last ON PURPOSE: ~52% of the catalogue is open past 01:00 (Dubai eats
  // late), so on a row with anything more distinctive to say, "Open late"
  // should be the chip that falls off the 3-cap first.
  {
    slug: 'late-night',
    label: 'Open late',
    types: [], // derived from opening hours, not from the taxonomy
    hint: 'open past midnight (only if the hours given say so)',
  },
] as const

/*
 * ⚠️ `bar` ("Bar & lounge") was CUT at vocabulary review: Google's `bar` type
 * on a Dubai restaurant usually means a licensed venue, but not reliably
 * enough to put a claim-shaped chip on 75 rows. Do not re-add it without a
 * column that actually supports the claim.
 */

/*
 * ⚠️ `cheap` is DELIBERATELY NOT in the vocabulary. The first dry-run derived
 * it from the LOW price band and it landed on 530 of 580 rows — the same ~91%
 * saturation as the `price:LOW` taste dimension, and for the same reason: the
 * import pipeline DEFAULTS unpriced rows to AED 45–100, so the band is a guess
 * on most of the catalogue, not a fact. A chip must be a checkable claim, and
 * the real AED range is already printed on the same screen. The 4 hand-seeded
 * `cheap` tags survive untouched (mergeTags never removes), and the mobile
 * label map still renders them as "Budget-friendly".
 */

export const TAG_SLUGS: readonly string[] = TAG_VOCABULARY.map((t) => t.slug)

/** The subset the LLM pass may assign — rules-only slugs excluded. */
export const LLM_TAG_VOCABULARY: readonly TagDef[] = TAG_VOCABULARY.filter(
  (t) => t.llm !== false,
)
export const LLM_TAG_SLUGS: readonly string[] = LLM_TAG_VOCABULARY.map((t) => t.slug)

const BY_TYPE = new Map<string, string>()
for (const def of TAG_VOCABULARY) for (const t of def.types) BY_TYPE.set(t, def.slug)

/* ------------------------------------------------------------------ */
/* The rules pass                                                      */
/* ------------------------------------------------------------------ */

/**
 * "Open late" = still open at `LATE_NIGHT_HOUR` (01:00 local) on at least
 * `LATE_NIGHT_MIN_NIGHTS` nights a week. The threshold exists because one late
 * Friday is a weekend exception, not what anyone means by an open-late place.
 * A no-close period is Google's encoding for 24/7, which qualifies outright.
 */
export const LATE_NIGHT_HOUR = 1
export const LATE_NIGHT_MIN_NIGHTS = 2

export function isLateNight(openingHours: unknown): boolean {
  const periods = parsePeriods(openingHours)
  if (!periods) return false

  let nights = 0
  for (const p of periods as HoursPeriod[]) {
    if (!p.close) return true // 24/7
    const crossesMidnight = p.close.day !== p.open.day
    if (crossesMidnight && p.close.hour >= LATE_NIGHT_HOUR) nights++
  }
  return nights >= LATE_NIGHT_MIN_NIGHTS
}

/**
 * Every tag the stored facts assert mechanically. Pure: same row in, same
 * tags out, in vocabulary order.
 */
export function rulesTagsFor(r: TagSource): string[] {
  const types = new Set<string>(
    [r.googlePrimaryType, ...r.googleTypes].filter((t): t is string => !!t),
  )

  const found = new Set<string>()
  for (const t of types) {
    const slug = BY_TYPE.get(t)
    if (slug) found.add(slug)
  }
  if (isLateNight(r.openingHours)) found.add('late-night')

  return TAG_SLUGS.filter((s) => found.has(s))
}

/**
 * Existing tags are NEVER removed or reordered — the 8 hand-curated rows keep
 * what a human wrote (and the taste vector keeps the dimensions users have
 * already trained on). New tags are appended in vocabulary order.
 */
export function mergeTags(existing: string[], derived: string[]): string[] {
  const seen = new Set(existing.map((t) => t.trim().toLowerCase()))
  const merged = [...existing]
  for (const slug of derived) {
    if (!seen.has(slug)) {
      merged.push(slug)
      seen.add(slug)
    }
  }
  return merged
}

/* ------------------------------------------------------------------ */
/* The LLM pass                                                        */
/* ------------------------------------------------------------------ */

/**
 * The system prompt. Mirrors DESCRIPTION_SYSTEM's discipline: closed
 * vocabulary, stored facts only, "none" is a respectable answer.
 */
export const TAGS_SYSTEM = `You classify restaurants for a Dubai food app by picking tags from a fixed list. You are given only stored facts about a restaurant; you know nothing else about it.

The ONLY allowed tags, and when each applies:
${LLM_TAG_VOCABULARY.map((t) => `- ${t.slug}: ${t.hint}`).join('\n')}

Rules:
- Reply with at most 3 tags, comma-separated, exactly as spelled above.
- Reply with the single word "none" if no tag clearly applies. Guessing is worse than none.
- A tag must be supported by the facts given (the name, the category, the description, the price band, the hours). Never infer atmosphere, quality or popularity.
- Do not tag the cuisine itself — the app already shows it.
- Reply with the tags only. No preamble, no explanations, no quotes.`

/** Google's types are snake_case labels — "fine_dining_restaurant". */
const prettyType = (t: string) => t.replace(/_/g, ' ').trim()

/** Types that say nothing about what kind of restaurant this is. */
const GENERIC_TYPES = new Set([
  'restaurant',
  'food',
  'point_of_interest',
  'establishment',
  'store',
  'food_store',
  'service',
])

/**
 * The per-row user message — the same "omit unknowns, never say 'unknown'"
 * rule as buildDescriptionPrompt, for the same reason: a prompt that mentions
 * a gap invites the model to fill it.
 */
export function buildTagsPrompt(r: TagSource): string {
  const facts: string[] = [`Name: ${r.name}`, `Cuisine: ${r.cuisineType}`]
  // Unknown price is omitted, never written as "unknown" — a prompt that
  // mentions a gap invites the model to fill it.
  if (r.priceMin != null && r.priceMax != null) {
    facts.push(
      `Price band: ${bandFor({ priceMin: r.priceMin, priceMax: r.priceMax })} ` +
        `(AED ${r.priceMin}–${r.priceMax} per person)`,
    )
  }
  const informative = [r.googlePrimaryType, ...r.googleTypes]
    .filter((t): t is string => !!t && !GENERIC_TYPES.has(t))
    .map(prettyType)
  if (informative.length) {
    facts.push(`Google's categories for it: ${[...new Set(informative)].join(', ')}`)
  }
  facts.push(`Open past midnight: ${isLateNight(r.openingHours) ? 'yes' : 'no'}`)
  if (r.description?.trim()) facts.push(`Description: ${r.description.trim()}`)

  return `Pick the tags for this restaurant.\n\n${facts.join('\n')}`
}

export interface TagsParse {
  ok: boolean
  tags: string[]
  /** Human-readable reasons, for the console and for the retry nudge. */
  problems: string[]
}

/** Maximum tags one LLM reply may assert. */
export const MAX_LLM_TAGS = 3

/**
 * Parses a model reply into vocabulary slugs. Strict on purpose: an unknown
 * token is a rejection (retried once with the problem named), never something
 * to silently drop — a model that invents tags needs to be told, not indulged.
 */
export function parseTagsReply(raw: string): TagsParse {
  const text = (raw ?? '')
    .trim()
    .replace(/^(here (is|are)[^:\n]*|tags?|answer|output)\s*:\s*/i, '')
    .replace(/[*_`#"'“”‘’]/g, '')
    .trim()

  if (!text) return { ok: false, tags: [], problems: ['empty reply'] }
  if (/^none[.!]?$/i.test(text)) return { ok: true, tags: [], problems: [] }

  const tokens = text
    .split(/[,\n]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)

  const problems: string[] = []
  // Validated against the LLM subset: a rules-only slug in a reply is as
  // invalid as an invented one — the model was never offered it.
  const unknown = tokens.filter((t) => !LLM_TAG_SLUGS.includes(t))
  if (unknown.length) {
    problems.push(`not in the vocabulary: ${unknown.join(', ')}`)
  }
  if (tokens.length > MAX_LLM_TAGS) {
    problems.push(`${tokens.length} tags, maximum ${MAX_LLM_TAGS}`)
  }
  if (problems.length) return { ok: false, tags: [], problems }

  // De-dupe, in vocabulary order.
  const picked = new Set(tokens)
  return { ok: true, tags: TAG_SLUGS.filter((s) => picked.has(s)), problems: [] }
}
