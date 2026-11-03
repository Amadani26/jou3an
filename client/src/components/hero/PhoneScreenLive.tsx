import { useEffect, useRef, useState } from 'react'
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

export type Phase =
  | 'idle'
  | 'tap'
  | 'deciding'
  | 'results'
  | 'select'
  | 'hold'
  | 'detail'
  | 'detailtap'
  | 'route'

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

/** A result row on the glass — always a REAL restaurant (live or snapshot). */
export type ScreenRow = {
  name: string
  sub: string
  chip: string
  /** "★ 4.8" (real Google rating) or null to hide the pill entirely. */
  score: string | null
}

/** What the detail beat shows for pick #1 — real fields only. */
export type ScreenDetail = {
  name: string
  meta: string
  /** "4.8" + count label, or null: no rating is a real state. */
  rating: string | null
  ratingCount: string | null
  /** Up to 3 real highlight tags; cuisine/area stand in when none. */
  chips: string[]
  /** The engine's own anonymous reason line. */
  reason: string
  tone: string
}

export default function PhoneScreenLive({
  onPhase,
  holdAt = null,
  rows,
  detail,
}: {
  /** Fired on every DISPLAYED phase change — the hero syncs its payoff to this. */
  onPhase?: (phase: Phase) => void
  /** While set, this phase is displayed and the clock stops. See header. */
  holdAt?: Phase | null
  /** The three restaurants on the glass. Real data in every state. */
  rows: ScreenRow[]
  /** Pick #1, as the detail beat renders it. */
  detail: ScreenDetail
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

  const phase: Phase = reduce ? 'route' : (holdAt ?? SEQUENCE[step][0])

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

      {/* ---- results: exactly 3 real restaurants ---- */}
      <div className="ps-view ps-results">
        <p className="ps-eyebrow">Decided for you</p>
        {rows.map((r, i) => (
          <div key={i} className="ps-card" style={{ ['--i' as string]: String(i) }}>
            <span className="ps-rank">{i + 1}</span>
            <span className="ps-cardbody">
              <strong>{r.name}</strong>
              <small>{r.sub}</small>
              <em>{r.chip}</em>
            </span>
            {r.score ? <span className="ps-score">{r.score}</span> : null}
            {i === 0 ? <i className="ps-ring ps-ring-card" /> : null}
          </div>
        ))}
        {/* Ratings are Google's — attributed wherever they show. */}
        <p className="ps-attr">Ratings by Google</p>
      </div>

      {/* ---- detail: pick #1 expanded, the app's own sheet in miniature ---- */}
      <div className="ps-view ps-detail">
        <div className="psd-hero" style={{ background: detail.tone }}>
          <span className="psd-scrim" aria-hidden="true" />
          <h3 className="psd-name">{detail.name}</h3>
        </div>
        <p className="psd-meta">{detail.meta}</p>
        {detail.rating ? (
          <p className="psd-rating">
            <span className="psd-star">★</span> {detail.rating}
            {detail.ratingCount ? <span className="psd-count"> ({detail.ratingCount})</span> : null}
            <span className="psd-on"> on Google</span>
          </p>
        ) : null}
        {detail.chips.length ? (
          <div className="psd-chips">
            {detail.chips.map((c) => (
              <span key={c} className="psd-chip">{c}</span>
            ))}
          </div>
        ) : null}
        <span className="psd-reason">{detail.reason}</span>
        <div className="psd-actions">
          {['Directions', 'Call', 'Order'].map((label, i) => (
            <span key={label} className="psd-btn" data-k={i}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {i === 0 ? <polygon points="3 11 22 2 13 21 11 13 3 11" /> : null}
                {i === 1 ? <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /> : null}
                {i === 2 ? <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></> : null}
              </svg>
              {label}
              {i === 0 ? <i className="ps-ring psd-ring" /> : null}
            </span>
          ))}
        </div>
      </div>

      {/* ---- route: "On your way" — OUR OWN stylised illustration. No map
           tiles, no real streets, no provider styling: abstract blocks and a
           red route drawing itself from You to the pin. ---- */}
      <div className="ps-view ps-route">
        <span className="psr-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          On your way
        </span>
        <svg className="psr-map" viewBox="0 0 220 460" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
          {/* invented blocks — nobody's city */}
          <g fill="#141415" stroke="#1f1f20" strokeWidth="1.2">
            <rect x="14" y="28" width="46" height="72" rx="5" />
            <rect x="84" y="18" width="52" height="82" rx="5" />
            <rect x="164" y="40" width="44" height="60" rx="5" />
            <rect x="16" y="140" width="40" height="100" rx="5" />
            <rect x="88" y="140" width="48" height="96" rx="5" />
            <rect x="166" y="150" width="46" height="90" rx="5" />
            <rect x="14" y="282" width="42" height="76" rx="5" />
            <rect x="88" y="278" width="48" height="84" rx="5" />
            <rect x="166" y="286" width="46" height="70" rx="5" />
            <rect x="30" y="392" width="76" height="52" rx="5" />
            <rect x="130" y="384" width="72" height="60" rx="5" />
          </g>
          {/* streets */}
          <g stroke="#242426" strokeWidth="2.4" strokeLinecap="round">
            <path d="M0 120 H220" />
            <path d="M0 260 H220" />
            <path d="M0 372 H220" />
            <path d="M70 0 V460" />
            <path d="M150 0 V460" />
          </g>
          {/* the route, You -> pin */}
          <path className="psr-route" d="M34 420 H70 V260 H150 V120 H182" pathLength={100} />
          <circle className="psr-you" cx="34" cy="420" r="5" />
          <g className="psr-dest">
            <circle className="psr-pulse" cx="182" cy="120" r="7" />
            <circle cx="182" cy="120" r="7" fill="#FE0000" />
            <circle cx="182" cy="120" r="2.6" fill="#0a0a0a" />
          </g>
        </svg>
      </div>
    </div>
  )
}
