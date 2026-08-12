import type { Restaurant } from '@prisma/client'

/**
 * Placeholder decision engine.
 *
 * Later this will call the Anthropic API. For now it does a lightweight
 * tag/keyword match against the seeded restaurants and returns the top 3.
 */

// Mood chip label (from the client) -> restaurant tag
const CHIP_TO_TAG: Record<string, string> = {
  '🔥 Cheap': '__cheap__',
  '🥗 Healthy': 'healthy',
  '🌙 Late Night': 'late-night',
  '💪 High Protein': 'high-protein',
  '🛋️ Comfort Food': 'comfort-food',
  '⚡ Quick': 'quick',
  '🌹 Date Night': 'date-night',
  '✅ Halal': 'halal',
}

// Free-text keyword -> restaurant tag
const KEYWORD_TO_TAG: Record<string, string> = {
  healthy: 'healthy',
  protein: 'high-protein',
  late: 'late-night',
  night: 'late-night',
  quick: 'quick',
  fast: 'quick',
  comfort: 'comfort-food',
  cozy: 'comfort-food',
  date: 'date-night',
  romantic: 'date-night',
  halal: 'halal',
  veg: 'vegetarian-friendly',
  vegetarian: 'vegetarian-friendly',
  vegan: 'vegetarian-friendly',
}

export function decideRestaurants(
  prompt: string,
  moodChips: string[],
  restaurants: Restaurant[],
): Restaurant[] {
  const text = prompt.toLowerCase()

  const wantedTags = new Set<string>()
  let wantsCheap = false

  for (const chip of moodChips) {
    const tag = CHIP_TO_TAG[chip]
    if (tag === '__cheap__') wantsCheap = true
    else if (tag) wantedTags.add(tag)
  }

  for (const [keyword, tag] of Object.entries(KEYWORD_TO_TAG)) {
    if (text.includes(keyword)) wantedTags.add(tag)
  }
  if (text.includes('cheap') || text.includes('budget') || text.includes('affordable')) {
    wantsCheap = true
  }

  const scored = restaurants.map((r) => {
    let score = 0

    // Tag matches are the strongest signal
    for (const tag of r.tags) {
      if (wantedTags.has(tag)) score += 3
    }

    // Cuisine mentioned by name in the prompt
    if (text.includes(r.cuisineType.toLowerCase())) score += 4

    // Area mentioned
    if (text.includes(r.area.toLowerCase().replace('_', ' '))) score += 2

    // Cheaper is better when budget-conscious
    if (wantsCheap) score += Math.max(0, 4 - Math.floor(r.priceMax / 40))

    // Rating as a gentle tiebreaker
    score += r.ratingScore

    return { restaurant: r, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 3).map((s) => s.restaurant)
}
