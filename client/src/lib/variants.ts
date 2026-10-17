import { useEffect, useState } from 'react'

/**
 * Hero variant, chosen by URL so the two device treatments can be compared on
 * a real phone without a deploy:
 *
 *   /?hero=1  WebGL device body (worker-rendered), live HTML screen
 *   /?hero=2  CSS 3D device body, same live HTML screen
 *
 * A review mechanism, not a feature — when one is picked, the loser and this
 * hook get deleted.
 */
export type HeroVariant = '1' | '2'

function read(): HeroVariant {
  if (typeof window === 'undefined') return '1'
  return new URLSearchParams(window.location.search).get('hero') === '2' ? '2' : '1'
}

export function useHeroVariant(): HeroVariant {
  const [v, setV] = useState<HeroVariant>(read)
  useEffect(() => {
    const sync = () => setV(read())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  return v
}
