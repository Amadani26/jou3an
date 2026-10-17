import { useCallback, useEffect, useRef, useState } from 'react'
import WaitlistCount from '../WaitlistCount'
import PhoneScreenLive, { type Phase } from './PhoneScreenLive'
import { scrollToWaitlist } from '../../lib/scroll'
import { DISHES, SURVIVOR_INDEXES, SURVIVOR_REASONS } from '../../lib/dishes'
import { prefersReducedMotion } from '../../lib/reveal'

/**
 * The hero: copy, the CSS device, and the payoff.
 *
 * THE PAYOFF, MEASURED FROM THE GLASS: when the screen's loop reaches its 3
 * results, each payoff card is positioned — by measuring the live DOM — to
 * start at the EXACT rect of its counterpart row on the screen (position and
 * scale), then spring toward the viewer: scaling up off the screen plane,
 * un-tilting as it rises, 80ms stagger, a red under-glow, while the phone
 * dims and eases back. It is unmistakable that the cards came out of the
 * screen, because they literally start where their pixels were.
 *
 * While the cards are out the screen is HELD on its results frame via
 * `holdAt` — a grip on the displayed phase, not a paused clock, which is the
 * fix for the iOS freeze: the old pause let a visibility reset rewind the
 * screen to the chips view and strand it there. Desktop retracts after a few
 * seconds, releases the hold, and the story replays; a phone keeps the
 * payoff out, and the scroll handoff latches it permanently (play-once).
 *
 * MOTION-LIBRARY-FREE, like everything above the fold.
 *
 * ?debug=1 renders a diagnostic overlay: displayed phase, hold/out/latch
 * state, reduced-motion detection, and a live fps meter.
 */

const LIFT_START = 0.03
const LIFT_SPAN = 0.47
/** Desktop keeps the payoff on screen this long before replaying the loop. */
const DESKTOP_HOLD_MS = 3800
const RETRACT_MS = 600
/** Let the screen's own result rows finish springing in before measuring. */
const MEASURE_DELAY_MS = 800

export default function HeroLive() {
  const ref = useRef<HTMLElement | null>(null)
  const liftLayerRef = useRef<HTMLDivElement | null>(null)
  const [out, setOut] = useState(false)
  const [hold, setHold] = useState(false)
  const [latched, setLatched] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const latchedRef = useRef(false)
  const outRef = useRef(false)
  const timersRef = useRef<number[]>([])

  /**
   * Measure where the screen's three result rows actually are, relative to
   * each card's slot anchor, and write per-slot vars: the card's hidden
   * state IS that rect (offset + scale), so the lift starts from the glass.
   */
  const measureFrom = useCallback(() => {
    const layer = liftLayerRef.current
    if (!layer) return
    const rows = document.querySelectorAll('.pscreen .ps-card')
    const slots = layer.querySelectorAll<HTMLElement>('.lift-slot')
    slots.forEach((slot, i) => {
      const row = rows[i]
      const card = slot.querySelector<HTMLElement>('.lift-fc')
      if (!row || !card) return
      const r = row.getBoundingClientRect()
      const a = slot.getBoundingClientRect()
      // offsetWidth, NOT the rect: the card is sitting in its hidden state,
      // already scaled, and a rect measurement would bake that scale into
      // the ratio (first attempt measured fs ≈ 1.05 instead of ≈ 0.55).
      const cw = card.offsetWidth
      slot.style.setProperty('--fx', `${(r.left + r.width / 2 - a.left).toFixed(1)}px`)
      slot.style.setProperty('--fy', `${(r.top + r.height / 2 - a.top).toFixed(1)}px`)
      slot.style.setProperty('--fs', Math.max(0.2, r.width / Math.max(1, cw)).toFixed(3))
    })
  }, [])

  const deploy = useCallback(() => {
    if (outRef.current) return
    outRef.current = true
    measureFrom()
    setOut(true)
    setHold(true)
  }, [measureFrom])

  const onPhase = useCallback(
    (p: Phase) => {
      setPhase(p)
      if (p !== 'results' || outRef.current || latchedRef.current) return
      // Small beat so the screen's rows finish landing before they lift off.
      timersRef.current.push(
        window.setTimeout(() => {
          deploy()
          const desktop = window.matchMedia('(min-width: 768px)').matches
          if (desktop && !prefersReducedMotion()) {
            timersRef.current.push(
              window.setTimeout(() => {
                if (latchedRef.current) return // scroll won: stay out
                setOut(false)
                outRef.current = false
                timersRef.current.push(
                  window.setTimeout(() => setHold(false), RETRACT_MS),
                )
              }, DESKTOP_HOLD_MS),
            )
          }
        }, MEASURE_DELAY_MS),
      )
    },
    [deploy],
  )

  useEffect(
    () => () => {
      for (const t of timersRef.current) window.clearTimeout(t)
    },
    [],
  )

  // The scroll handoff: one rAF listener writing the --lift ratchet, and the
  // permanent latch (play-once).
  useEffect(() => {
    const section = ref.current
    const layer = liftLayerRef.current
    if (!section || !layer || prefersReducedMotion()) return

    let frame = 0
    let max = 0

    const apply = () => {
      frame = 0
      const p = window.scrollY / Math.max(1, section.offsetHeight)
      const lift = Math.min(1, Math.max(0, (p - LIFT_START) / LIFT_SPAN))
      if (lift > max) {
        max = lift
        layer.style.setProperty('--lift', max.toFixed(4))
        if (max > 0.04 && !latchedRef.current) {
          latchedRef.current = true
          setLatched(true)
          deploy()
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
  }, [deploy])

  const showing = out || latched
  const holdAt: Phase | null = hold || latched ? 'results' : null

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
          <b>A food decision engine for Dubai.</b> Exactly 3 places — no menus,
          no scrolling, just a decision.
        </p>
      </div>

      <div className="hero-live-stage">
        {/* data-back: the phone dims and eases away while the cards are out. */}
        <div className="dev-wrap" data-back={showing ? 'yes' : 'no'}>
          <div className="dev-float">
            <div className="dev-tilt">
              <div className="dev-stage">
                <span className="dev-body" aria-hidden="true" />
                <div className="dev-face">
                  <PhoneScreenLive onPhase={onPhase} holdAt={holdAt} />
                  <span className="dev-sheen" aria-hidden="true" />
                  <span className="dev-dim" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
          <span className="dev-shadow" aria-hidden="true" />
        </div>

        <div
          ref={liftLayerRef}
          className="lift-layer"
          data-out={showing ? 'yes' : 'no'}
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

      <HeroDebug phase={phase} out={showing} hold={holdAt !== null} latched={latched} />
    </section>
  )
}

/**
 * ?debug=1 — the on-device diagnostic the review asked for: displayed phase,
 * payoff/hold/latch state, reduced-motion detection, and a live fps meter.
 * Renders nothing without the flag.
 */
function HeroDebug({
  phase,
  out,
  hold,
  latched,
}: {
  phase: Phase
  out: boolean
  hold: boolean
  latched: boolean
}) {
  const [enabled] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1',
  )
  const [fps, setFps] = useState(0)
  const [rm, setRM] = useState(false)

  useEffect(() => {
    if (!enabled) return
    setRM(prefersReducedMotion())
    let frames = 0
    let last = performance.now()
    let raf = 0
    const tick = (t: number) => {
      frames++
      if (t - last >= 1000) {
        setFps(Math.round((frames * 1000) / (t - last)))
        frames = 0
        last = t
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled])

  if (!enabled) return null
  return (
    <div className="hero-debug" role="status">
      <span>phase: {phase}</span>
      <span>out: {String(out)}</span>
      <span>hold: {String(hold)}</span>
      <span>latch: {String(latched)}</span>
      <span>reduced-motion: {String(rm)}</span>
      <span>fps: {fps}</span>
    </div>
  )
}
