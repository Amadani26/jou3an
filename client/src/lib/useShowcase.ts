import { useEffect, useState } from 'react'
import { getShowcase, type Showcase } from './live'

/**
 * The page-wide live data, as a three-state hook:
 *   pending  — prerender/first paint: neutral placeholders, fixed geometry
 *   live     — real restaurants from /api/public/showcase
 *   fallback — API unreachable: the generic-dish page (the old zero-risk
 *              content) renders exactly as before
 * One underlying fetch per visit (memoised in live.ts), shared by the hero,
 * the wall and Decide→Act.
 */
export type ShowcaseState =
  | { status: 'pending' }
  | { status: 'live'; data: Showcase }
  | { status: 'fallback' }

export function useShowcase(): ShowcaseState {
  const [state, setState] = useState<ShowcaseState>({ status: 'pending' })
  useEffect(() => {
    let on = true
    getShowcase().then((d) => {
      if (on) setState(d ? { status: 'live', data: d } : { status: 'fallback' })
    })
    return () => {
      on = false
    }
  }, [])
  return state
}
