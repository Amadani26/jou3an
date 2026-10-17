import { useCallback, useEffect, useRef, useState } from 'react'
import WaitlistCount from '../WaitlistCount'
import PhoneScreenLive, { type Phase } from './PhoneScreenLive'
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
 * THE CARDS ARE THE LOOP'S PAYOFF, and they live BEHIND the device — the
 * lift layer stacks under the phone, so no geometry can ever put a card over
 * the glass. The first build floated them in front, and the scroll ratchet
 * could strand a half-lifted card on top of the screen's story; both are
 * impossible now by construction.
 *
 *   - Desktop: when the screen's loop reaches its 3 results, the three cards
 *     spring out from behind the glass and settle BESIDE the phone (60ms
 *     stagger); when the loop restarts they ease back in behind it. It reads
 *     as "the app just produced these".
 *   - iPhone widths: no room beside and none below (the device fills the
 *     stage), so the cards stay out of the hero entirely until the SCROLL
 *     HANDOFF — then they slide out from behind the device as the hero
 *     leaves. Never over the glass at any width.
 *
 * The scroll handoff is unchanged in spirit: one rAF listener writes --lift
 * (a ratchet, play-once) and LATCHES the cards visible permanently, so the
 * loop can no longer retract them once the story has moved on.
 *
 * Reduced motion: static device on its selected screen; cards shown settled
 * beside the phone on desktop, absent on phone widths (no overlap anywhere);
 * no listeners, no timers.
 */

const LIFT_START = 0.03
const LIFT_SPAN = 0.47

export default function HeroLive() {
  const ref = useRef<HTMLElement | null>(null)
  const liftLayerRef = useRef<HTMLDivElement | null>(null)
  // The loop's payoff state: true while the screen is showing its 3 results.
  const [popped, setPopped] = useState(false)
  // The scroll latch: once true, the cards stay out forever (play-once).
  const [latched, setLatched] = useState(false)
  const latchedRef = useRef(false)

  const onPhase = useCallback((phase: Phase) => {
    setPopped(phase === 'results' || phase === 'select' || phase === 'hold')
  }, [])

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
        if (max > 0.04 && !latchedRef.current) {
          latchedRef.current = true
          setLatched(true)
        }
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
                  <PhoneScreenLive onPhase={onPhase} />
                  <span className="dev-sheen" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
          <span className="dev-shadow" aria-hidden="true" />
        </div>

        <div
          ref={liftLayerRef}
          className="lift-layer"
          data-pop={popped ? 'yes' : 'no'}
          data-latch={latched ? 'yes' : 'no'}
          aria-hidden="true"
        >
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
