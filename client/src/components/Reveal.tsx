import type { ReactNode } from 'react'
import { useReveal } from '../lib/reveal'

/**
 * Wraps children in a translate+fade that plays once, when the element scrolls
 * into view. `delay` (ms) is what produces the stagger on grids — pass the
 * item's index times a small step.
 *
 * The motion itself lives in `.reveal` / `.reveal.is-visible` in index.css,
 * which is also where prefers-reduced-motion flattens it.
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const { ref, shown } = useReveal<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
