import { useEffect, useRef, useState } from 'react'

/**
 * FEATURES — show, don't tell.
 *
 * Four cards, each a looping LIVE HTML VIGNETTE of the feature — a mood chip
 * being tapped, exactly-3 results landing, a swipe teaching taste, the Daily
 * Top 3 refreshing — with a 3–5 word label. A swipeable snap rail with a
 * peeking next card on iPhone; a grid on desktop.
 *
 * The vignettes are pure CSS keyframe loops, all driven by one section-level
 * IntersectionObserver that flips data-play — they run only while the
 * section is on screen, and the tab being hidden pauses them for free
 * (CSS animations stop in background tabs). Reduced motion kills the
 * animations, and every loop's 0% frame is designed to read as a complete
 * static scene, so the still is the fallback.
 *
 * Copy per the approved cut: one headline, one line, four labels, one
 * caption. "Daily Top 3" carries no freshness claim (ruling).
 */

const VIGNETTES = [
  { key: 'vibe', label: 'Tell it your vibe' },
  { key: 'three', label: 'Exactly 3, with reasons' },
  { key: 'swipe', label: 'Swipe to teach it' },
  { key: 'daily', label: 'Daily Top 3' },
] as const

function Vignette({ kind }: { kind: string }) {
  switch (kind) {
    case 'vibe':
      return (
        <div className="vig-stage vig-vibe" aria-hidden="true">
          <span className="vg-chip vg-chip-1">
            Quick and cheap
            <i className="vg-ring" />
          </span>
          <span className="vg-chip vg-chip-2">Date night</span>
          <span className="vg-dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )
    case 'three':
      return (
        <div className="vig-stage vig-three" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`vg-row vg-row-${n}`}>
              <b>{n}</b>
              <span className="vg-line" />
              {n === 1 ? <em>Close to you</em> : null}
            </span>
          ))}
        </div>
      )
    case 'swipe':
      return (
        <div className="vig-stage vig-swipe" aria-hidden="true">
          <span className="vg-deckcard vg-under" />
          <span className="vg-deckcard vg-mover">
            <span className="vg-photo" />
            <span className="vg-bar" />
          </span>
          <em className="vg-learn">Taste noted</em>
        </div>
      )
    case 'daily':
      return (
        <div className="vig-stage vig-daily" aria-hidden="true">
          <span className="vg-date">Today</span>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`vg-row vg-drow vg-drow-${n}`}>
              <b>{n}</b>
              <span className="vg-line" />
            </span>
          ))}
        </div>
      )
    default:
      return null
  }
}

export default function Features() {
  const ref = useRef<HTMLElement | null>(null)
  const [play, setPlay] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setPlay(true)
      return
    }
    const io = new IntersectionObserver(
      (e) => setPlay(e[0]?.isIntersecting ?? false),
      { rootMargin: '10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section ref={ref} className="feat-section" data-play={play ? 'yes' : 'no'}>
      <div className="feat-head">
        <h2 className="feat-title">You already know you&apos;re hungry.</h2>
        <p className="feat-lede">Jou3an knows where.</p>
      </div>

      <div className="feat-rail" role="list">
        {VIGNETTES.map((v) => (
          <article key={v.key} className="feat-card" role="listitem">
            <Vignette kind={v.key} />
            <h3 className="feat-label">{v.label}</h3>
          </article>
        ))}
      </div>

      <p className="feat-caption">No menus. No scrolling.</p>
    </section>
  )
}
