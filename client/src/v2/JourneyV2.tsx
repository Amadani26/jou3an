/**
 * WEB V2 — "The journey of 3", the full first draft (chapters 1→7).
 * Storyboard + tech plan + polish backlog: docs/web-v2-storyboard.md.
 *
 * Page anatomy:
 *   [scrubbed runway: ch1 ignition → ch2 tunnel → ch3 collapse+burst →
 *    ch4 split/settle/handoff → ch5 swipe + taste shift]
 *   then NORMAL document flow, deliberately OUTSIDE the main scrub (so the
 *   future chapter-snapping system only ever regulates the runway):
 *   ch6 the EXISTING live demo (the 3 parks as a corner element) →
 *   FAQ → ch7 the 3 glides into the HTML wordmark above the existing
 *   CTA band → footer. The park and the glide are driven by live DOM
 *   rects measured in the scene — no extra ScrollTriggers, immune to the
 *   demo changing its own height mid-session.
 *
 * Carried over from the live site: DemoSection (area chips → 3 strictly
 * in-area picks, photos with attribution, VenueNote), FAQ, CTABand
 * (waitlist — Supabase direct, MOCKED on Vercel previews, the
 * production-only waitlist_join analytics event), Footer (legal links,
 * wordmark monument), FloatingCTA (phone-only, hides over #waitlist).
 * Analytics/OG are app-/document-level and apply here unchanged.
 *
 * REAL DATA ONLY throughout; static fallback renders every chapter's
 * content readable with zero WebGL. ?fps=1 overlays a frame meter.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useShowcase } from '../lib/useShowcase'
import { metaLine, type LivePick } from '../lib/live'
import { prefersReducedMotion } from '../lib/reveal'
import VenueNote from '../components/VenueNote'
import FAQ from '../components/FAQ'
import CTABand from '../components/CTABand'
import Footer from '../components/Footer'
import FloatingCTA from '../components/FloatingCTA'
import {
  CHAPTER_VH, P3, SETTLE_END, HANDOFF_END, CH5_COPY_AT, SWIPE_AT,
} from './timeline'
import type { CardRectTargets, PostJourneyEls } from './JourneyCanvas'
import '../v2/journey.css'

const JourneyCanvas = lazy(() => import('./JourneyCanvas'))
const DemoSection = lazy(() => import('../components/DemoSection'))

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

/** One REAL answer as HTML — the thing the 3D card hands off to. */
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

/** ch7's join block: the wordmark the 3 glides into, above the existing
 *  waitlist band. The "3" span starts coal-dark; the scene lights it the
 *  moment the lacquer 3 lands (data-lit), then the canvas bows out. */
function JoinSection({
  wm3Ref,
  lit,
}: {
  wm3Ref?: (el: HTMLSpanElement | null) => void
  lit?: boolean
}) {
  return (
    <section className="j-join">
      <p className="j-kicker">Chapter 7</p>
      <p className="j-wordmark" aria-label="Jou3an">
        Jou
        <span ref={wm3Ref} className="j-wm3" data-lit={lit ? '1' : '0'}>
          3
        </span>
        an
      </p>
    </section>
  )
}

/** Reduced-motion / no-WebGL fallback: every chapter readable, the demo
 *  and waitlist fully functional. */
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
   *  pick (excluded by id AND name — the live payload can carry the same
   *  venue in both arrays under different ids). */
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
  const post = useRef<PostJourneyEls>({ demoEl: null, wm3El: null, canvasWrapEl: null }).current

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
        const sec = answersRef.current
        if (sec) {
          sec.dataset.handoff = p >= HANDOFF_FLIP ? '1' : '0'
          sec.dataset.copy = p >= CH5_COPY_AT ? '5' : '4'
          if (p >= SWIPE_AT) swiped.current = true
          else if (p < P3) swiped.current = false
          sec.dataset.swipe = swiped.current ? '1' : '0'
        }
      },
    })

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

  // Everything after the runway: the live demo, FAQ, the join (wordmark +
  // waitlist band) and the footer — identical in full and static modes,
  // only the wordmark's 3 differs (scene-lit vs always lit).
  const tail = (
    <div className="j-tail">
      <section
        className="j-demo"
        ref={(el) => { post.demoEl = el }}
      >
        <Suspense fallback={<div style={{ minHeight: '80svh' }} aria-hidden="true" />}>
          <DemoSection />
        </Suspense>
      </section>
      <FAQ />
      <JoinSection
        wm3Ref={mode === 'full' ? (el) => { post.wm3El = el } : undefined}
        lit={mode !== 'full'}
      />
      <CTABand />
      <Footer />
      <FloatingCTA />
    </div>
  )

  if (mode === 'static') {
    return (
      <div className="j-root">
        <StaticJourney picks={picks} names={wall.map((p) => p.name)} />
        {tail}
      </div>
    )
  }

  return (
    <div className="j-root">
      {/* The persistent scene, behind everything. */}
      <div className="j-canvas" aria-hidden="true" ref={(el) => { post.canvasWrapEl = el }}>
        {mode === 'full' && mount3d ? (
          <Suspense fallback={null}>
            <JourneyCanvas
              picks={picks}
              wall={wall}
              progress={progress}
              rects={rects}
              post={post}
              isPhone={isPhone}
            />
          </Suspense>
        ) : null}
      </div>

      {/* The scrubbed story. Section heights come from timeline.ts. */}
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

      {tail}

      {showFps ? <FpsMeter /> : null}
    </div>
  )
}
