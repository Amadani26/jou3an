import { useEffect, useState } from 'react'
import { SNAPSHOT, getShowcase, type Showcase } from './live'

/**
 * The page-wide restaurant data. ALWAYS real restaurants:
 *
 *   - first paint (and prerender, and any network failure) renders the
 *     build-time SNAPSHOT — real servable rows captured from the
 *     production API at build time, bars/lounges excluded server-side
 *   - the live /api/public/showcase answer replaces it when it arrives
 *
 * Dishes are never presented as picks in any state. One underlying fetch
 * per visit (memoised in live.ts), shared by the hero, the wall and
 * Decide→Act.
 */
export function useShowcase(): { data: Showcase; isLive: boolean } {
  const [state, setState] = useState<{ data: Showcase; isLive: boolean }>({
    data: SNAPSHOT,
    isLive: false,
  })
  useEffect(() => {
    let on = true
    getShowcase().then((d) => {
      if (on && d) setState({ data: d, isLive: true })
    })
    return () => {
      on = false
    }
  }, [])
  return state
}
