import { useEffect, useRef, useState } from 'react'
import WaitlistCount from '../WaitlistCount'
import { scrollToWaitlist } from '../../lib/scroll'
import { MORPH_FRAMES, MORPH_VIEWBOX } from '../../lib/threeAinMorph'

/**
 * HERO A — "3 becomes ع".
 *
 * The page opens by performing the one fact no competitor can borrow: in
 * Arabizi the digit 3 IS the Arabic letter ع, so the 3 in Jou3an is at once a
 * letter of جوعان and the number of answers. The glyph morphs from one into
 * the other, the wordmark resolves underneath it, and only then does the
 * headline arrive. Two seconds, once, and it could not belong to anyone else.
 *
 * The morph is 30 precomputed path frames (scripts/build-morph.mjs) stepped by
 * one rAF loop — one attribute write per frame, no morph library at runtime.
 * It is a d-attribute change on a single small SVG, which costs a path re-raster
 * and nothing else: no layout, no reflow, no compositing of anything else.
 *
 * ⚠️ The ع is REAL TEXT to a screen reader and to search: the <svg> carries
 * role="img" and a label naming the brand, and the visible wordmark below is
 * ordinary text. Nothing here is an image of words pretending to be words.
 */

const HOLD_MS = 420 // the 3 is itself before anything happens
const MORPH_MS = 760

export default function HeroMorph() {
  const pathRef = useRef<SVGPathElement | null>(null)
  const [phase, setPhase] = useState<'glyph' | 'word' | 'done'>('glyph')

  useEffect(() => {
    const path = pathRef.current
    if (!path) return

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      // Keep the destination, drop the journey: the ع is the meaningful state.
      path.setAttribute('d', MORPH_FRAMES[MORPH_FRAMES.length - 1])
      setPhase('done')
      return
    }

    let raf = 0
    let start = 0
    const last = MORPH_FRAMES.length - 1

    const tick = (t: number) => {
      if (!start) start = t
      const elapsed = t - start

      if (elapsed < HOLD_MS) {
        raf = requestAnimationFrame(tick)
        return
      }

      const p = Math.min(1, (elapsed - HOLD_MS) / MORPH_MS)
      // Ease-in-out: the glyph is MOVING between two states rather than
      // entering, so it should accelerate away and decelerate into its answer.
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      const frame = Math.round(eased * last)
      path.setAttribute('d', MORPH_FRAMES[frame])

      if (p < 1) raf = requestAnimationFrame(tick)
      else {
        setPhase('word')
        window.setTimeout(() => setPhase('done'), 420)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section
      className="hero-bleed hero-morph relative min-h-[100svh] overflow-hidden flex flex-col"
      data-phase={phase}
    >
      <span aria-hidden="true" className="hero-glow" />

      <div className="morph-stage">
        <svg
          className="morph-svg"
          viewBox={MORPH_VIEWBOX}
          role="img"
          aria-label="Jou3an — the 3 is the Arabic letter ain"
        >
          <path ref={pathRef} d={MORPH_FRAMES[0]} fill="var(--red)" />
        </svg>

        {/* Resolves under the glyph once it has landed on ع. */}
        <div className="morph-names">
          <span className="morph-ar" dir="rtl" lang="ar">
            جوعان
          </span>
          <span className="morph-latin">
            Jou<span>3</span>an
          </span>
        </div>
      </div>

      <div className="hero-body morph-body">
        <h1 className="hero-h">
          <span className="hero-line">
            <span className="hero-word">Hungry?</span>
          </span>
          <span>
            <span className="hero-word">We</span>{' '}
            <span className="hero-word hero-accent">decide</span>
          </span>
        </h1>

        <p className="hero-sub">
          <b>Dubai&apos;s first food decision engine.</b> Tell us what
          you&apos;re craving and get exactly 3 places — no menus, no scrolling,
          just a decision.
        </p>

        <div className="w-full max-w-[460px]">
          <button type="button" onClick={scrollToWaitlist} className="hero-cta">
            Join the waitlist
          </button>
          <WaitlistCount className="hero-count" />
          <p className="hero-meta">Launching in Dubai · Invites in batches</p>
        </div>
      </div>
    </section>
  )
}
