import { useEffect, useRef } from 'react'
import WaitlistCount from '../WaitlistCount'
import PhoneScreenLive from './PhoneScreenLive'
import { scrollToWaitlist } from '../../lib/scroll'
import { DISHES, SURVIVOR_INDEXES, SURVIVOR_REASONS } from '../../lib/dishes'
import { prefersReducedMotion } from '../../lib/reveal'

/**
 * The hero: copy, the CSS device, and the handoff. (The WebGL variant was
 * reviewed against this one and cut — this is the keeper.)
 *
 * ALIVE FROM FIRST PAINT, and deliberately MOTION-LIBRARY-FREE: everything
 * here is either a CSS animation (float, sheen, the screen's loop, the
 * entrance) or one scroll-driven CSS custom property. That keeps the
 * animation library out of the ENTRY CHUNK entirely — it had pulled the entry
 * from 105 to 151 KB gzip when this section imported it, and the hero is the
 * LCP, so it pays for every byte. The below-the-fold sections load motion in
 * their own lazy chunks, where it costs the first paint nothing.
 *
 * THE HANDOFF: as scrolling starts, the three result cards lift off the
 * glass into the page. One rAF-coalesced scroll listener writes a single
 * custom property (--lift, 0..1) on the layer; each card's transform is a
 * calc() on that variable, so the whole choreography is one style write per
 * frame. The value is a RATCHET — it only ever rises — so the lift plays
 * once, forward, and scrolling back up never re-docks the cards.
 *
 * Reduced motion: static final frame — screen on its selected state, float
 * and sheen off (CSS), no scroll listener, cards docked.
 */

const LIFT_START = 0.03
const LIFT_SPAN = 0.47

export default function HeroLive() {
  const ref = useRef<HTMLElement | null>(null)
  const liftLayerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const section = ref.current
    const layer = liftLayerRef.current
    if (!section || !layer || prefersReducedMotion()) return

    let frame = 0
    let max = 0

    const apply = () => {
      frame = 0
      // Progress 0..1 across the hero's own height (it starts at page top).
      const p = window.scrollY / Math.max(1, section.offsetHeight)
      const lift = Math.min(1, Math.max(0, (p - LIFT_START) / LIFT_SPAN))
      // ⚠️ PLAY ONCE: the ratchet. Only ever forward.
      if (lift > max) {
        max = lift
        layer.style.setProperty('--lift', max.toFixed(4))
      }
    }

    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(apply)
    }

    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section
      ref={ref}
      className="hero-bleed hero-live relative min-h-[100svh] overflow-hidden flex flex-col"
    >
      <span aria-hidden="true" className="hero-glow hero-glow-product" />

      <div className="product-copy">
        <h1 className="hero-h product-h">
          <span className="hero-line">
            <span className="hero-word">Hungry?</span>
          </span>
          <span>
            <span className="hero-word">We</span>{' '}
            <span className="hero-word hero-accent">decide</span>
          </span>
        </h1>
        <p className="hero-sub product-sub">
          <b>Dubai&apos;s first food decision engine.</b> Exactly 3 places — no
          menus, no scrolling, just a decision.
        </p>
      </div>

      <div className="hero-live-stage">
        <div className="dev-wrap">
          <div className="dev-float">
            <div className="dev-tilt">
              <div className="dev-stage">
                <span className="dev-body" aria-hidden="true" />
                <div className="dev-face">
                  <PhoneScreenLive />
                  <span className="dev-sheen" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
          <span className="dev-shadow" aria-hidden="true" />
        </div>

        <div ref={liftLayerRef} className="lift-layer" aria-hidden="true">
          {SURVIVOR_INDEXES.map((di, i) => {
            const d = DISHES[di]
            return (
              <div key={di} className={`lift-slot lift-slot-${i + 1}`}>
                <div className="lift-move">
                  <article className="fcard lift-fc">
                    <span className="fcard-rank">{i + 1}</span>
                    <div className="fcard-body">
                      <h3 className="fcard-name">{d.dish}</h3>
                      <p className="fcard-meta">
                        {d.cuisine} · {d.area} · {d.price}
                      </p>
                      <span className="fcard-reason">{SURVIVOR_REASONS[i]}</span>
                    </div>
                    <span className="fcard-score">{d.score.toFixed(1)}</span>
                  </article>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="product-cta">
        <button type="button" onClick={scrollToWaitlist} className="hero-cta">
          Join the waitlist
        </button>
        <WaitlistCount className="hero-count" />
      </div>
    </section>
  )
}
