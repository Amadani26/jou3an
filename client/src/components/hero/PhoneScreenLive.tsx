import { useEffect, useRef, useState } from 'react'
import { DISHES, SURVIVOR_INDEXES, SURVIVOR_REASONS } from '../../lib/dishes'
import { prefersReducedMotion } from '../../lib/reveal'

/**
 * The phone's screen as REAL, LIVE UI — HTML/CSS in the app's design
 * language, auto-playing the core flow on a seamless loop:
 *
 *   a mood chip is tapped → "Deciding" → 3 result cards animate in → hold.
 *
 * ⚠️ ZERO-RISK: content is the generic dish set (src/lib/dishes.ts) and our
 * own score chip — no venues, no third-party marks.
 *
 * The loop is a tiny state machine: one timeout at a time flips a data-phase
 * attribute, and every transition under it runs in CSS on the compositor.
 *
 * `holdAt` is the parent's grip on the story: while set, the DISPLAYED phase
 * is exactly that value and no timers run — whatever the internal step says.
 * This is what fixed the frozen-hero bug on iOS: the old `paused` flag only
 * stopped the clock, so the visibility reset (scroll away and back) could
 * rewind the screen to the chips view while the payoff held it "paused",
 * freezing the story on its first frame. A hold on the DISPLAYED phase
 * cannot desync from a reset clock. When the parent releases the hold
 * (desktop replay), the story restarts from the top.
 *
 * Reduced motion renders the STATIC results frame with no timers at all.
 */

export type Phase = 'idle' | 'tap' | 'deciding' | 'results' | 'select' | 'hold'

const SEQUENCE: [Phase, number][] = [
  ['idle', 1600],
  ['tap', 900],
  ['deciding', 1500],
  ['results', 2200],
  ['select', 1500],
  ['hold', 1500],
]

const CHIPS = ['Quick and cheap', 'Date night', 'Comfort food']

/** Local, reactive reduced-motion — keeps the motion library out of entry. */
function useRM(): boolean {
  const [rm, setRM] = useState(prefersReducedMotion)
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setRM(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return rm
}

export default function PhoneScreenLive({
  onPhase,
  holdAt = null,
}: {
  /** Fired on every DISPLAYED phase change — the hero syncs its payoff to this. */
  onPhase?: (phase: Phase) => void
  /** While set, this phase is displayed and the clock stops. See header. */
  holdAt?: Phase | null
}) {
  const reduce = useRM()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [step, setStep] = useState(0)
  const [running, setRunning] = useState(true)
  const prevHold = useRef<Phase | null>(holdAt)

  // One timeout at a time — the whole machine.
  useEffect(() => {
    if (reduce || !running || holdAt) return
    const id = window.setTimeout(
      () => setStep((s) => (s + 1) % SEQUENCE.length),
      SEQUENCE[step][1],
    )
    return () => window.clearTimeout(id)
  }, [step, running, holdAt, reduce])

  // Hold released (desktop replay): the story restarts from the top.
  useEffect(() => {
    if (prevHold.current && !holdAt) setStep(0)
    prevHold.current = holdAt
  }, [holdAt])

  // Off screen or tab hidden: stop burning timers; restart from the top when
  // back — unless the parent is holding a frame, which always wins.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let inView = true
    const decide = () => {
      const next = inView && !document.hidden
      setRunning((prev) => {
        if (!prev && next) setStep(0)
        return next
      })
    }
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((e) => {
            inView = e[0]?.isIntersecting ?? true
            decide()
          })
        : null
    io?.observe(el)
    document.addEventListener('visibilitychange', decide)
    return () => {
      io?.disconnect()
      document.removeEventListener('visibilitychange', decide)
    }
  }, [])

  const phase: Phase = reduce ? 'results' : (holdAt ?? SEQUENCE[step][0])

  useEffect(() => {
    onPhase?.(phase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  return (
    <div ref={rootRef} className="pscreen" data-phase={phase} aria-hidden="true">
      <header className="ps-top">
        <span className="ps-brand">
          Jou<b>3</b>an
        </span>
      </header>

      {/* ---- home: the brief ---- */}
      <div className="ps-view ps-home">
        <p className="ps-ask">What are you in the mood for?</p>
        <div className="ps-chips">
          {CHIPS.map((c, i) => (
            <span key={c} className="ps-chip">
              {c}
              {i === 0 ? <i className="ps-ring" /> : null}
            </span>
          ))}
        </div>
      </div>

      {/* ---- deciding: the one loud beat ---- */}
      <div className="ps-view ps-deciding">
        <span className="ps-dots">
          <i />
          <i />
          <i />
        </span>
        <p>Deciding</p>
      </div>

      {/* ---- results: exactly 3 ---- */}
      <div className="ps-view ps-results">
        <p className="ps-eyebrow">Decided for you</p>
        {SURVIVOR_INDEXES.map((di, i) => {
          const d = DISHES[di]
          return (
            <div key={di} className="ps-card" style={{ ['--i' as string]: String(i) }}>
              <span className="ps-rank">{i + 1}</span>
              <span className="ps-cardbody">
                <strong>{d.dish}</strong>
                <small>
                  {d.cuisine} · {d.area} · {d.price}
                </small>
                <em>{SURVIVOR_REASONS[i]}</em>
              </span>
              <span className="ps-score">{d.score.toFixed(1)}</span>
              {i === 0 ? <i className="ps-ring ps-ring-card" /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
