/**
 * Curated Unsplash food photography used as placeholder card imagery until real
 * Google Places photos are wired in Phase 4. These are direct image URLs at a
 * good resolution (w=800, q=80). Varied styles: plated dishes, bowls, grills, etc.
 */
export const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80', // plated spread
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80', // healthy bowl
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80', // pizza
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80', // fresh salad
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80', // grilled burger
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80', // breakfast
  'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&q=80', // pasta
  'https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&q=80', // grilled steak
  'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=800&q=80', // grill skewers
  'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80', // seafood
]

/**
 * Deterministic image pick for an index (e.g. a restaurant's rank/position),
 * so the same slot always shows the same photo. Wraps around and tolerates
 * negative or out-of-range indices.
 */
export function getPlaceholderImage(index: number): string {
  const n = PLACEHOLDER_IMAGES.length
  const i = ((Math.floor(index) % n) + n) % n
  return PLACEHOLDER_IMAGES[i]
}
