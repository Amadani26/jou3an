/**
 * The cuisine vocabulary the app offers, shared by the Decide flow's cuisine
 * step and the onboarding taste quiz.
 *
 * Extracted from decide.tsx when the quiz needed the same grid: two copies of
 * this list would drift, and the quiz's answers are stored as taste weights
 * keyed on these exact names — a name that differs by a word matches nothing.
 */
import type { Ionicons } from '@expo/vector-icons'

export interface Cuisine {
  name: string
  descriptor: string
  icon: keyof typeof Ionicons.glyphMap
}

export const CUISINES: Cuisine[] = [
  { name: 'Lebanese', descriptor: 'Mezze & Grills', icon: 'flame-outline' },
  { name: 'Japanese', descriptor: 'Sushi & Ramen', icon: 'fish-outline' },
  { name: 'American', descriptor: 'Burgers & Comfort', icon: 'fast-food-outline' },
  { name: 'Pakistani', descriptor: 'Curries & Rice', icon: 'restaurant-outline' },
  { name: 'Emirati', descriptor: 'Local & Traditional', icon: 'moon-outline' },
  { name: 'Healthy', descriptor: 'Clean & Light', icon: 'leaf-outline' },
  { name: 'Pizza', descriptor: 'Wood-fired & Delivery', icon: 'pizza-outline' },
  { name: 'Asian', descriptor: 'Pan-Asian Fusion', icon: 'nutrition-outline' },
]

/**
 * A quiet identity colour per cuisine, used ONLY for the icon inside its chip.
 *
 * Muted and desaturated on purpose: eight saturated hues on a #080808 screen
 * reads as a toy, and the red is the brand's — nothing here may compete with
 * it. The two exceptions are design-system tokens already in use elsewhere
 * (#2DCE89 green, #FFB547 gold).
 */
export const CUISINE_ACCENT: Record<string, string> = {
  Lebanese: '#D9A05B',
  Japanese: '#D96C6C',
  American: '#B2705B',
  Pakistani: '#C9963F',
  Emirati: '#9AA0C9',
  Healthy: '#2DCE89',
  Pizza: '#FFB547',
  Asian: '#5FB3A6',
}

/** Fallback for a cuisine added to CUISINES without an accent. */
export const ACCENT_FALLBACK = '#8A847E'

export const accentFor = (name: string) => CUISINE_ACCENT[name] ?? ACCENT_FALLBACK

/** Chunks the list into rows for a fixed-column grid. */
export function cuisineRows(columns = 2, list: Cuisine[] = CUISINES): Cuisine[][] {
  const rows: Cuisine[][] = []
  for (let i = 0; i < list.length; i += columns) rows.push(list.slice(i, i + columns))
  return rows
}

/** Pre-chunked 2-column rows — what both the Decide step and the quiz render. */
export const CUISINE_ROWS: Cuisine[][] = cuisineRows(2)
