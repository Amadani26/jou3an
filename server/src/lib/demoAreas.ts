/**
 * The public demo's HARD area filter.
 *
 * "Pick an area. Get 3 places there." — THERE, literally. The demo never
 * widens: no radius ladder, no city-wide fallback, no neighbouring area.
 * Membership is decided by `areaName` (the real Google neighbourhood),
 * matched EXACTLY against the spellings the catalogue actually holds —
 * English and Arabic — so Marina is Dubai Marina alone (not JBR, not
 * Bluewaters, not JLT), and likewise for every chip.
 *
 * ⚠️ JBR is deliberately NOT a chip: the catalogue holds only 3 non-bar
 * servable rows there (2026-11-02), which cannot RELIABLY field three.
 * Add it back when the area is imported more deeply.
 *
 * When an area cannot field three OPEN places (late at night), the engine
 * relaxes its hours gate WITHIN the same pool — never the area — and the
 * route reports "Opens at HH:MM" per closed pick so the card can say so.
 */
import type { Candidate, Decision3 } from '../services/engine/types'
import type { EngineInput } from '../services/engine/types'
import { decide } from '../services/engine'
import { toEngineContext } from '../services/engine/request'
import { isServeable } from './venueType'
import { isBarLike } from './barLike'

export interface DemoArea {
  key: string
  label: string
  /** Exact `areaName` spellings that belong to this chip — nothing else. */
  names: readonly string[]
}

export const DEMO_AREAS: readonly DemoArea[] = [
  { key: 'MARINA', label: 'Marina', names: ['Dubai Marina', 'دبي مارينا'] },
  {
    key: 'DOWNTOWN',
    label: 'Downtown',
    // Dubai Mall is physically inside Downtown — same neighbourhood.
    names: ['Downtown Dubai', 'وسط مدينة دبي', 'Dubai Mall'],
  },
  {
    key: 'JLT',
    label: 'JLT',
    names: ['Jumeirah Lakes Towers', 'أبراج بحيرات الجميرا', 'JLT Cluster J'],
  },
  { key: 'DIFC', label: 'DIFC', names: ['DIFC', 'Dubai International Financial Center'] },
  { key: 'BUSINESS_BAY', label: 'Business Bay', names: ['Business Bay', 'الخليج التجاري'] },
] as const

export const demoArea = (key: string): DemoArea | null =>
  DEMO_AREAS.find((a) => a.key === key) ?? null

/** Strict membership: a row with no areaName belongs to no chip. */
export function matchesDemoArea(
  r: { areaName?: string | null },
  area: DemoArea,
): boolean {
  return !!r.areaName && area.names.includes(r.areaName)
}

/**
 * The demo's decision: exactly three places IN the area.
 *
 * The pool handed to the engine is already area-filtered (and bar-free),
 * and no coordinates are passed, so the engine's radius ladder has nothing
 * to widen — its only remaining relaxation inside this pool is the hours
 * gate, which is exactly the one we want ("Opens at…" beats leaving the
 * area). Throws when the area cannot field three servable rows at all;
 * the chip list above is curated so that cannot happen.
 */
export function decideForArea(
  candidates: Candidate[],
  area: DemoArea,
  date: Date,
  refreshNonce: number = 0,
): Decision3 {
  const pool = candidates.filter(
    (r) => isServeable(r) && !isBarLike(r) && matchesDemoArea(r, area),
  )
  const input: EngineInput = {
    candidates: pool,
    taste: {},
    context: toEngineContext({ refreshNonce }, null, date),
    userId: null,
    recentSelections: [],
    pickRates: {},
  }
  return decide(input)
}
