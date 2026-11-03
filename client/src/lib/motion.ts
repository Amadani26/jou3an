/**
 * Motion tokens for the landing page.
 *
 * Two rules hold everywhere downstream:
 *   1. Transform and opacity only. Nothing animates a property that triggers
 *      layout or paint, because the target is a mid-range iPhone at 60fps.
 *   2. Every motion has a reduced-motion answer that keeps the CONTENT and
 *      drops the travel — never one that hides something instead.
 *
 * The built-in CSS easings are too weak to read as intentional at these sizes,
 * so the curves below are the stronger custom variants.
 */

/** Entering or exiting: starts fast, so the interface feels like it heard you. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** Moving or morphing on screen: accelerates and decelerates like a real thing. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

/**
 * Durations, in seconds.
 *
 * UI feedback stays under 300ms. The hero's one-time entrance is allowed to be
 * slower: it is explanatory, seen once, and never stands between the visitor
 * and something they are trying to do.
 */
export const DUR = {
  press: 0.16,
  micro: 0.22,
  enter: 0.5,
  hero: 0.9,
} as const

/** Short enough that a stagger reads as one cascade rather than a queue. */
export const STAGGER = 0.07

/** Apple's formulation — easier to reason about than mass/stiffness/damping. */
export const SPRING_SETTLE = { type: 'spring', duration: 0.62, bounce: 0.22 } as const
export const SPRING_PRESS = { type: 'spring', duration: 0.3, bounce: 0.1 } as const

/** Words rise into place one after another. Used by the hero headline. */
export const wordRise = {
  hidden: { opacity: 0, y: '0.42em' },
  shown: (i: number) => ({
    opacity: 1,
    y: '0em',
    transition: { duration: DUR.enter, ease: EASE_OUT, delay: 0.18 + i * STAGGER },
  }),
}
