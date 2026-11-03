/**
 * WEB V2 — "The journey of 3", chapters 1→5 (phase 2 checkpoint).
 * Storyboard + tech plan: docs/web-v2-storyboard.md (repo root).
 *
 * Architecture (unchanged from the approved spike):
 *   - ONE persistent R3F canvas FIXED behind an HTML layer; every word and
 *     control is HTML. Readable content never lives in the canvas — ch4's
 *     orbiting cards settle onto, and hand off to, their real HTML twins.
 *   - Lenis + GSAP ScrollTrigger scrub → ONE progress number in a ref.
 *     State the CSS needs (handoff, chapter copy, the ch5 swipe) is
 *     written as data-attributes straight onto the section — no React
 *     state on the scroll path.
 *   - 3D lazy-mounts on first scroll intent; static fallback (no canvas,
 *     no Lenis) for reduced-motion / no-WebGL with every chapter readable.
 *
 * REAL DATA ONLY: the showcase picks/wall via useShowcase() — real names,
 * real Google ratings with attribution or none, real prices or omitted,
 * the engine's own reason lines. VenueNote wherever real venues appear.
 *
 * ?fps=1 overlays a frame-time meter.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useShowcase } from '../lib/useShowcase'
import { metaLine, type LivePick } from '../lib/live'
import { prefersReducedMotion } from '../lib/reveal'
import VenueNote from '../components/VenueNote'
import {
  CHAPTER_VH, P3, SETTLE_END, HANDOFF_END, CH5_COPY_AT, SWIPE_AT,
} from './timeline'
import type { CardRectTargets } from './JourneyCanvas'
import '../v2/journey.css'

const JourneyCanvas = lazy(() => import('./JourneyCanvas'))

const HANDOFF_FLIP = (SETTLE_END + HANDOFF_END) / 2

function webglOK(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Frame-time meter for measurements (?fps=1). */
function FpsMeter() {
  const [stats, setStats] = useState('—')
  useEffect(() => {
    let last = performance.now()
    let frames: number[] = []
    let raf = 0
    const tick = (now: number) => {
      frames.push(now - last)
      last = now
      if (frames.length >= 60) {
        const avg = frames.reduce((a, b) => a + b, 0) / frames.length
        const worst = Math.max(...frames)
        setStats(`${(1000 / avg).toFixed(0)} fps avg · ${avg.toFixed(1)} ms · worst ${worst.toFixed(0)} ms`)
        frames = []
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <div className="j-fps">{stats}</div>
}

/** One REAL answer as HTML — the thing the 3D card hands off to. Name,
 *  cuisine · area · price (metaLine omits what is null), the real Google
 *  rating with attribution or nothing, and the engine's reason line. */
function PickCard({
  pick,
  rank,
  cardRef,
  className,
}: {
  pick: LivePick
  rank: number
  cardRef?: (el: HTMLDivElement | null) => void
  className?: string
}) {
  return (
    <div ref={cardRef} className={'jp-card' + (className ? ' ' + className : '')}>
      <span className="jp-rank">{rank}</span>
      <div className="jp-body">
        <p className="jp-name">{pick.name}</p>
        <p className="jp-meta">{metaLine(pick)}</p>
        {pick.rating != null ? (
          <p className="jp-rating">
            <span className="jp-star">★</span> {pick.rating.toFixed(1)}
            {pick.ratingCount != null ? ` (${pick.ratingCount.toLocaleString('en-US')})` : ''} · Google
          </p>
        ) : null}
        {pick.reason ? <p className="jp-reason">{pick.reason}</p> : null}
      </div>
    </div>
  )
}

function Chapter({
  heightVh,
  kicker,
  title,
  sub,
  children,
}: {
  heightVh: number
  kicker: string
  title: React.ReactNode
  sub: string
  children?: React.ReactNode
}) {
  return (
    <section className="j-chapter" style={{ height: `${heightVh}svh` }}>
      <div className="j-sticky">
        <p className="j-kicker">{kicker}</p>
        <h2 className="j-title">{title}</h2>
        <p className="j-sub">{sub}</p>
        {children}
      </div>
    </section>
  )
}

/** Reduced-motion / no-WebGL / no-JS-adjacent fallback: every chapter's
 *  content as plain readable sections. */
function StaticJourney({ picks, names }: { picks: LivePick[]; names: string[] }) {
  return (
    <div className="j-static">
      <section className="j-static-ch">
        <span className="j-static-3" aria-hidden="true">3</span>
        <h2 className="j-title">Hungry?</h2>
        <p className="j-sub">A food decision engine for Dubai.</p>
      </section>
      <section className="j-static-ch">
        <h2 className="j-title">Too many options.</h2>
        <p className="j-sub">All of them open. All of them plausible.</p>
        <ul className="j-static-names">
          {names.slice(0, 6).map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <VenueNote />
      </section>
      <section className="j-static-ch">
        <h2 className="j-title">
          Jou3an <em>decides</em>.
        </h2>
        <p className="j-sub">Exactly 3 answers.</p>
      </section>
      <section className="j-static-ch">
        <h2 className="j-title">Exactly 3 answers.</h2>
        <p className="j-sub">Where you are. What you feel like. What you spend.</p>
        <div className="jp-grid is-static">
          {picks.map((p, i) => (
            <div className="jp-slot" key={p.id}>
              <PickCard pick={p} rank={i + 1} />
            </div>
          ))}
        </div>
        <VenueNote />
      </section>
      <section className="j-static-ch">
        <h2 className="j-title">It learns you.</h2>
        <p className="j-sub">Swipe to teach it.</p>
      </section>
    </div>
  )
}

export default function JourneyV2() {
  const { data } = useShowcase()
  const picks = useMemo(() => data.picks.slice(0, 3), [data])
  const wall = data.wall.length ? data.wall : data.picks
  /** ch5's replacement card: a real wall restaurant that is not already a
   *  pick. Excluded by id AND name — picks and wall rows are built
   *  separately server-side, so the same venue must never slip through on
   *  an id mismatch and "replace" itself. */
  const replacement = useMemo(
    () => wall.find((w) => !picks.some((p) => p.id === w.id || p.name === w.name)) ?? null,
    [wall, picks],
  )

  const [mode, setMode] = useState<'pending' | 'full' | 'static'>('pending')
  const [mount3d, setMount3d] = useState(false)
  const progress = useRef(0)
  const runwayRef = useRef<HTMLDivElement>(null)
  const answersRef = useRef<HTMLElement>(null)
  const swiped = useRef(false)
  const rects = useRef<CardRectTargets>({ els: [null, null, null] }).current

  const showFps = typeof window !== 'undefined' && window.location.search.includes('fps=1')
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    setMode(prefersReducedMotion() || !webglOK() ? 'static' : 'full')
  }, [])

  // Lenis + ScrollTrigger — only in full mode.
  useEffect(() => {
    if (mode !== 'full') return
    gsap.registerPlugin(ScrollTrigger)
    const lenis = new Lenis({ smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    const st = ScrollTrigger.create({
      trigger: runwayRef.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress
        progress.current = p
        // CSS-side chapter state as data-attributes — no React re-renders.
        const sec = answersRef.current
        if (sec) {
          sec.dataset.handoff = p >= HANDOFF_FLIP ? '1' : '0'
          sec.dataset.copy = p >= CH5_COPY_AT ? '5' : '4'
          // the swipe is one-shot-feeling: fired crossing SWIPE_AT, only
          // re-armed by leaving the whole answers section backwards.
          if (p >= SWIPE_AT) swiped.current = true
          else if (p < P3) swiped.current = false
          sec.dataset.swipe = swiped.current ? '1' : '0'
        }
      },
    })

    // The scene mounts when the journey starts — first scroll/touch intent
    // (ch1's resting state is darkness; ignition begins ~25vh in, so the
    // three parse/compile happens while the visitor reads). 6s timer for
    // the visitor who waits.
    const arm = () => setMount3d(true)
    const opts = { once: true, passive: true } as const
    window.addEventListener('wheel', arm, opts)
    window.addEventListener('touchstart', arm, opts)
    window.addEventListener('scroll', arm, opts)
    window.addEventListener('keydown', arm, opts)
    const timer = window.setTimeout(arm, 6000)

    return () => {
      st.kill()
      gsap.ticker.remove(tick)
      lenis.destroy()
      window.removeEventListener('wheel', arm)
      window.removeEventListener('touchstart', arm)
      window.removeEventListener('scroll', arm)
      window.removeEventListener('keydown', arm)
      window.clearTimeout(timer)
    }
  }, [mode])

  if (mode === 'static') return <StaticJourney picks={picks} names={wall.map((p) => p.name)} />

  return (
    <div className="j-root">
      {/* The persistent scene, behind everything. */}
      <div className="j-canvas" aria-hidden="true">
        {mode === 'full' && mount3d ? (
          <Suspense fallback={null}>
            <JourneyCanvas picks={picks} wall={wall} progress={progress} rects={rects} isPhone={isPhone} />
          </Suspense>
        ) : null}
      </div>

      {/* The HTML story. Section heights come from timeline.ts — the scene
          reads the same boundaries. */}
      <div ref={runwayRef} className="j-runway">
        <Chapter heightVh={CHAPTER_VH.ch1} kicker="Chapter 1" title={<>Hungry?</>} sub="A food decision engine for Dubai." />
        <Chapter heightVh={CHAPTER_VH.ch2} kicker="Chapter 2" title={<>Too many options.</>} sub="All of them open. All of them plausible.">
          <div className="j-note">
            <VenueNote />
          </div>
        </Chapter>
        <Chapter
          heightVh={CHAPTER_VH.ch3}
          kicker="Chapter 3"
          title={<>Jou3an <em>decides</em>.</>}
          sub="Exactly 3 answers."
        />

        {/* ch4 + ch5 share ONE sticky frame: the answer cards must survive
            the chapter change. The headline block crossfades via
            data-copy; the cards appear via data-handoff; the middle card
            swipes away via data-swipe. */}
        <section
          ref={answersRef}
          className="j-chapter j-answers"
          style={{ height: `${CHAPTER_VH.answers}svh` }}
          data-handoff="0"
          data-copy="4"
          data-swipe="0"
        >
          <div className="j-sticky j-answers-frame">
            <div className="j-copy-stack">
              <header className="j-copy j-copy-4">
                <p className="j-kicker">Chapter 4</p>
                <h2 className="j-title">Exactly 3 answers.</h2>
                <p className="j-sub">Where you are. What you feel like. What you spend.</p>
              </header>
              <header className="j-copy j-copy-5" aria-hidden="true">
                <p className="j-kicker">Chapter 5</p>
                <h2 className="j-title">It learns you.</h2>
                <p className="j-sub">Swipe to teach it.</p>
              </header>
            </div>

            <div className="jp-grid">
              {picks.map((p, i) => (
                <div className="jp-slot" key={p.id}>
                  <PickCard
                    pick={p}
                    rank={i + 1}
                    cardRef={(el) => { rects.els[i] = el }}
                    className={i === 1 ? 'jp-out' : undefined}
                  />
                  {i === 1 && replacement ? (
                    <PickCard pick={replacement} rank={2} className="jp-in" />
                  ) : null}
                </div>
              ))}
            </div>

            <div className="j-note j-note-answers">
              <VenueNote />
            </div>
          </div>
        </section>
      </div>

      <section className="j-end">
        <p className="j-kicker">End of the phase-2 checkpoint</p>
        <p className="j-sub">
          Chapters 6–7 — the live demo and the waitlist — come after this review. The full plan
          lives in <code>docs/web-v2-storyboard.md</code>.
        </p>
        <Link className="j-back" to="/">
          ← Back to the live site
        </Link>
      </section>

      {showFps ? <FpsMeter /> : null}
    </div>
  )
}
