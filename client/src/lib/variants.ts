import { useEffect, useState } from 'react'

/**
 * Section variants, chosen by URL so two builds can be compared on a real
 * phone without a deploy:
 *
 *   /?hero=a&problem=b
 *
 * Read once at mount and again on back/forward, not on every render. It is a
 * review mechanism, not a feature — when a variant is chosen, the loser gets
 * deleted and this goes with it.
 */
export type Variant = 'a' | 'b'

function read(name: string): Variant {
  if (typeof window === 'undefined') return 'a'
  const v = new URLSearchParams(window.location.search).get(name)
  return v === 'b' ? 'b' : 'a'
}

export function useVariant(name: 'hero' | 'problem'): Variant {
  const [v, setV] = useState<Variant>(() => read(name))

  useEffect(() => {
    const sync = () => setV(read(name))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [name])

  return v
}
