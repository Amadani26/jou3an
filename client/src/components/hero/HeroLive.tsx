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
 * THE PAYOFF: the screen plays its story uncovered — nothing sits over the
 * glass while the loop runs. When it reaches the 3 results, the phone EASES
 * BACK (a small scale-down and rise) and the three cards lift OUT of the
 * screen toward the viewer — in front of the device now, spring, 60ms
 * stagger — and settle in clear view: fanned beside the phone on desktop,
 * stacked over its lower half on phone widths. Overlap is fine here: the
 * screen's story is finished, and the loop is PAUSED while the cards are
 * out. Desktop retracts them after a few seconds and lets the loop replay;
 * iPhone keeps them out (no auto-replay) and hands off to the scroll as
 * before — the latch and the --lift fan drift are unchanged, play-once.
 *
 * Reduced motion: the static final state — phone eased back, three cards in
 * front, no listeners, no timers.
 */

const LIFT_START = 0.03
const LIFT_SPAN = 0.47
/** Desktop keeps the payoff on screen this long before replaying the loop. */
const DESKTOP_HOLD_MS = 3600
const RETRACT_MS = 550

export default function HeroLive() {
  const ref = useRef<HTMLElement | null>(null)
  const liftLayerRef = useRef<HTMLDivElement | null>(null)
  // The payoff: cards out in front, loop held. The scroll latch keeps them
  // out forever (play-once); desktop otherwise retracts and replays.
  const [out, setOut] = useState(false)
  const [paused, setPaused] = useState(false)
  const [latched, setLatched] = useState(false)
  const latchedRef = useRef(false)
  const timersRef = useRef<number[]>([])

  const onPhase = useCallback((phase: Phase) => {
    if (phase !== 'results') return
    setOut(true)
    setPaused(true)
    // Desktop replays; a phone keeps the payoff (and the scroll latch makes
    // that permanent anyway the moment the visitor moves).
    const desktop = window.matchMedia('(min-width: 768px)').matches
    if (desktop) {
      timersRef.current.push(
        window.setTimeout(() => {
          if (latchedRef.current) return // scroll won: stay out
          setOut(false)
          timersRef.current.push(
            window.setTimeout(() => setPaused(false), RETRACT_MS),
          )
        }, DESKTOP_HOLD_MS),
      )
    }
  }, [])

  useEffect(() => () => {
    for (const t of timersRef.current) window.clearTimeout(t)
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
          setOut(true)
          setPaused(true)
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
        {/* data-back: the phone eases away while the cards are out. */}
        <div className="dev-wrap" data-back={out || latched ? 'yes' : 'no'}>
          <div className="dev-float">
            <div className="dev-tilt">
              <div className="dev-stage">
                <span className="dev-body" aria-hidden="true" />
                <div className="dev-face">
                  <PhoneScreenLive onPhase={onPhase} paused={paused} />
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
          data-out={out || latched ? 'yes' : 'no'}
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
