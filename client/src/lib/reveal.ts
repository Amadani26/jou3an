import { useEffect, useRef, useState } from 'react'

/** True when the user has asked the OS to reduce motion. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Reveal-on-scroll. Returns a ref to attach to the element and whether it has
 * entered the viewport yet. Fires once, then disconnects — nothing re-hides on
 * scroll-up, and no listener survives the element.
 *
 * Degrades to "already visible" when motion is reduced or IntersectionObserver
 * is missing, so content is never stranded at opacity 0.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  // Decided at mount rather than in an effect, so the no-motion path paints
  // visible on the very first render instead of flashing through a hidden state.
  const [shown, setShown] = useState(
    () => prefersReducedMotion() || typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      // Trip a little before the element is fully in view so the motion reads
      // as the section "arriving" rather than catching up after the fact.
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  return { ref, shown }
}

/**
 * Light parallax: translates the element by `scrollY * speed` pixels.
 *
 * rAF-throttled, passive listener, transform-only (no layout, nothing repainted
 * off the compositor). Disabled outright under reduced motion. A negative speed
 * moves the element against the scroll.
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>(
  speed: number,
) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return

    let frame = 0

    const apply = () => {
      frame = 0
      el.style.transform = `translate3d(0, ${window.scrollY * speed}px, 0)`
    }

    const onScroll = () => {
      // Coalesce bursts of scroll events into one style write per frame.
      if (frame) return
      frame = window.requestAnimationFrame(apply)
    }

    apply()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
      el.style.transform = ''
    }
  }, [speed])

  return ref
}
