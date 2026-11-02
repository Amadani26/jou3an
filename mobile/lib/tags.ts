/**
 * Highlight-tag display — pure, so it is testable under the lib-only vitest
 * scope (the resultsFlow.ts pattern).
 *
 * MIRRORS `server/src/lib/restaurantTags.ts` (the vocabulary's source of
 * truth, where tags are generated). Drift degrades gracefully by design: a
 * slug this file does not know still renders via `prettyTag` ("new-slug" →
 * "New Slug") and sorts after the known ones — never a crash, never a blank
 * chip.
 *
 * ⚠️ Tags are FACTUAL CATEGORIES generated from stored data (Google's own
 * taxonomy, hours, price band) — never review-derived sentiment. Don't add a
 * label here that implies "people say…"; that claim has no data behind it.
 */

/** Tags that must never render anywhere in the app (e.g. lingering in old data). */
export const HIDDEN_TAGS = ['halal']

/** "late-night" → "Late Night" — the fallback for slugs with no label below. */
export const prettyTag = (tag: string) =>
  tag
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/** Strip hidden tags before displaying a restaurant's tag list. */
export const visibleTags = (tags: string[] = []) =>
  tags.filter((t) => !HIDDEN_TAGS.includes(t.toLowerCase()))

/**
 * Chip copy per slug, in DISPLAY PRIORITY order (food specialty → meal/time →
 * format → diet → price) — the same order as the server vocabulary. When a
 * row carries more tags than a chip row shows, the most distinctive ones win.
 */
export const TAG_LABELS: ReadonlyArray<readonly [slug: string, label: string]> = [
  ['steakhouse', 'Steakhouse'],
  ['seafood', 'Seafood'],
  ['bbq', 'Grills & BBQ'],
  ['shisha', 'Shisha'],
  ['buffet', 'Buffet'],
  ['dessert', 'Desserts'],
  ['breakfast', 'Breakfast'],
  ['brunch', 'Brunch'],
  ['fine-dining', 'Fine dining'],
  ['quick', 'Quick bite'],
  ['family-friendly', 'Family-friendly'],
  ['live-music', 'Live music'],
  ['vegetarian-friendly', 'Vegetarian-friendly'],
  ['healthy', 'Healthy'],
  // `cheap` is legacy-only (4 hand-seeded rows; generation never writes it).
  ['cheap', 'Budget-friendly'],
  // LOWEST priority on purpose: ~52% of the catalogue is open past 01:00, so
  // on a row with anything more distinctive, "Open late" falls off the 3-cap
  // first. (`bar` was cut at vocabulary review — not reliable enough a claim.)
  ['late-night', 'Open late'],
] as const

const LABEL_OF = new Map(TAG_LABELS)
const PRIORITY_OF = new Map(TAG_LABELS.map(([slug], i) => [slug, i]))

/** What a chip says for a slug — the curated label, or prettified fallback. */
export const tagLabel = (tag: string) =>
  LABEL_OF.get(tag.toLowerCase()) ?? prettyTag(tag)

/** The chip rows never show more than this — the rest is vector food. */
export const HIGHLIGHT_LIMIT = 3

/**
 * The tags a chip row actually renders: hidden ones stripped, ordered by
 * display priority (unknown slugs last, keeping their stored order among
 * themselves), capped at `max`. Returns [] when there is nothing to show —
 * callers hide the row entirely, the same null-is-a-real-answer rule as
 * description, rating and phone.
 */
export function highlightTags(tags: string[] = [], max = HIGHLIGHT_LIMIT): string[] {
  const shown = visibleTags(tags)
  return shown
    .map((tag, i) => ({ tag, i, p: PRIORITY_OF.get(tag.toLowerCase()) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .slice(0, max)
    .map((e) => e.tag)
}
