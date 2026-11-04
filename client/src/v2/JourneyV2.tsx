/**
 * WEB V2 — "The journey of 3", STEPPED-CHAPTER edition.
 * Storyboard + tech plan + polish backlog: docs/web-v2-storyboard.md.
 *
 * The ch1–5 story is no longer scroll-scrubbed. The stage is ONE 100svh
 * section and the page does not scroll while the story plays: one swipe /
 * wheel flick / keypress advances exactly ONE beat (timeline.ts BEATS),
 * and each beat is a TIME-BASED gsap tween on the scene's progress number
 * — the same ~1–2s for everyone, never flick speed. Input during a
 * transition is queued (max 1) or ignored; stepping back plays the beat
 * in reverse. After the last beat the page unlocks and the tail (live
 * demo → FAQ → join → footer) scrolls natively; an upward gesture at the
 * very top steps back INTO the story. "Skip to the live demo" and the
 * header Join pill work at any beat.
 *
 * ch4 is rebuilt as pure DOM: a dense field of REAL restaurant tiles (the
 * wall data) is narrowed by four labelled filter beats — Area → Budget →
 * Open now → Your taste (choreography of the engine's real stages, no
 * per-venue claims) — until exactly 3 remain and rise into the readable
 * HTML answer cards. Crisp at device DPR throughout: nothing readable is
 * rasterised into the canvas any more. A Refresh button under the 3 calls
 * GET /api/public/refresh with the already-shown ids excluded (read-only,
 * no DB writes) and cycles back gracefully when the pool runs dry.
 *
 * REAL DATA ONLY throughout; reduced motion / no WebGL get the static
 * fallback with NORMAL scrolling. ?fps=1 overlays a frame meter.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useShowcase } from '../lib/useShowcase'
import { metaLine, cuisineTone, getRefresh, type LivePick } from '../lib/live'
import { prefersReducedMotion } from '../lib/reveal'
import VenueNote from '../components/VenueNote'
import FAQ from '../components/FAQ'
import CTABand from '../components/CTABand'
import Footer from '../components/Footer'
import { BEATS, LAST_BEAT } from './timeline'
import type { PostJourneyEls } from './JourneyCanvas'
import '../v2/journey.css'

const JourneyCanvas = lazy(() => import('./JourneyCanvas'))
const DemoSection = lazy(() => import('../components/DemoSection'))

/** The beat whose transition hands the field's 3 survivors to the cards. */
const HANDOFF_BEAT = BEATS.findIndex((b) => b.field === 6)

/** ch4's filter beats, in play order. Labels only — no counters. */
const FILTERS = ['Area', 'Budget', 'Open now', 'Your taste'] as const

/** How each filter's eliminated tiles leave (CSS keys). */
const FILTER_EXIT = ['sweep', 'fall', 'fade', 'shrink'] as const

function webglOK(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/** The ONE waitlist shortcut: a compact pill pinned top-right in the
 *  header band on ALL widths. 44pt+ tap target, safe-area aware, hides
 *  while the waitlist band itself is in view. Works at any beat. */
function JoinPill({ onJoin }: { onJoin: () => void }) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const band = document.querySelector('#waitlist')
    if (!band || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting), { threshold: 0.15 })
    io.observe(band)
    return () => io.disconnect()
  }, [])
  return (
    <button
      type="button"
      className="j-joinpill"
      data-hidden={hidden ? '1' : '0'}
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden}
      onClick={onJoin}
    >
      Join waitlist
    </button>
  )
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

/** One REAL answer as HTML — crisp at device DPR by construction. */
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

interface FieldTile {
  pick: LivePick
  /** 0..2 = this tile IS answer #n+1 (survives); -1 = eliminated. */
  surviveIdx: number
  /** Which filter beat removes it (1..4); 0 = survivor. */
  step: number
}

/** Reduced-motion / no-WebGL fallback: every chapter readable, the demo,
 *  Refresh and waitlist fully functional — under NORMAL scrolling. */
function StaticJourney({
  picks,
  names,
  onRefresh,
  refreshing,
}: {
  picks: LivePick[]
  names: string[]
  onRefresh: () => void
  refreshing: boolean
}) {
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
        <h2 className="j-title">
          From all the options, exactly <em>3</em>.
        </h2>
        <p className="j-sub">Where you are. What you spend. What&apos;s open. What you like.</p>
        <div className="jp-grid is-static">
          {picks.map((p, i) => (
            <div className="jp-slot" key={p.id}>
              <PickCard pick={p} rank={i + 1} />
            </div>
          ))}
        </div>
        <button type="button" className="j-refreshbtn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Deciding…' : 'Refresh — 3 new picks'}
        </button>
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
  const basePicks = useMemo(() => data.picks.slice(0, 3), [data])
  const wall = data.wall.length ? data.wall : data.picks

  // The trio currently on the cards: the showcase picks until the first
  // Refresh, then whatever the refresh endpoint handed back. Stepping back
  // below the handoff resets it — the story replays canonically.
  const [override, setOverride] = useState<LivePick[] | null>(null)
  const picks = override ?? basePicks

  /** ch5's replacement card: a real wall restaurant that is not already on
   *  the cards (excluded by id AND name — the live payload can carry the
   *  same venue in both arrays under different ids). */
  const replacement = useMemo(
    () => wall.find((w) => !picks.some((p) => p.id === w.id || p.name === w.name)) ?? null,
    [wall, picks],
  )

  /** ch4's options field: every wall row that is not one of the answers,
   *  with the 3 answers spread through it as the survivors. Each non-
   *  survivor is assigned to one of the four filter beats, round-robin, so
   *  every step visibly removes a share of the field. */
  const fieldTiles = useMemo<FieldTile[]>(() => {
    const others = wall.filter((w) => !basePicks.some((p) => p.id === w.id || p.name === w.name))
    const tiles: FieldTile[] = others.map((p, i) => ({
      pick: p,
      surviveIdx: -1,
      step: (i % 4) + 1,
    }))
    const n = tiles.length
    const at = [Math.floor(n * 0.18), Math.floor(n * 0.5), Math.floor(n * 0.82)]
    basePicks.forEach((p, i) => {
      tiles.splice(Math.min(at[i] + i, tiles.length), 0, { pick: p, surviveIdx: i, step: 0 })
    })
    return tiles
  }, [wall, basePicks])

  const [mode, setMode] = useState<'pending' | 'full' | 'static'>('pending')
  const [mount3d, setMount3d] = useState(false)
  const progress = useRef(0)
  const post = useRef<PostJourneyEls>({ demoEl: null, wm3El: null, canvasWrapEl: null }).current

  // ---- the beat engine ----
  const [beat, setBeat] = useState(0)
  const beatRef = useRef(0)
  const animRef = useRef(false)
  const queueRef = useRef(0) // -1 | 0 | +1 — at most ONE queued step
  const lockedRef = useRef(true) // the story owns input until the last beat
  const [storyDone, setStoryDone] = useState(false)
  const pickTileEls = useRef<(HTMLLIElement | null)[]>([null, null, null])
  const cardEls = useRef<(HTMLDivElement | null)[]>([null, null, null])

  const showFps = typeof window !== 'undefined' && window.location.search.includes('fps=1')
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(() => {
    setMode(prefersReducedMotion() || !webglOK() ? 'static' : 'full')
  }, [])

  /** The handoff one-shot: the 3 surviving tiles glide onto their answer
   *  cards' live rects while crossfading (FLIP-lite). The resting states
   *  are pure CSS (data-field), so skip/back stay correct without it. */
  const runRise = useCallback(() => {
    for (let i = 0; i < 3; i++) {
      const a = pickTileEls.current[i]
      const b = cardEls.current[i]
      if (!a || !b) continue
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      if (!ra.width || !rb.width) continue
      gsap.fromTo(
        a,
        { x: 0, y: 0, scale: 1 },
        {
          x: rb.left + rb.width / 2 - (ra.left + ra.width / 2),
          y: rb.top + rb.height / 2 - (ra.top + ra.height / 2),
          scale: rb.width / ra.width,
          duration: 0.75,
          ease: 'power2.inOut',
          delay: i * 0.07,
          overwrite: true,
        },
      )
    }
  }, [])

  const resetRise = useCallback(() => {
    for (const el of pickTileEls.current) {
      if (el) gsap.set(el, { clearProps: 'transform' })
    }
  }, [])

  const unlock = useCallback(() => {
    if (!lockedRef.current) return
    lockedRef.current = false
    setStoryDone(true)
  }, [])

  const relock = useCallback(() => {
    lockedRef.current = true
    setStoryDone(false)
  }, [])

  // step() and runBeat() call each other (queue consumption), so the input
  // handlers and the tween callback go through this ref.
  const stepRef = useRef<(dir: number) => void>(() => {})

  const runBeat = useCallback(
    (target: number) => {
      const from = beatRef.current
      if (target === from) return
      animRef.current = true
      beatRef.current = target
      setBeat(target)
      if (override && target < HANDOFF_BEAT) setOverride(null)
      if (post.canvasWrapEl && post.canvasWrapEl.dataset.scrolled !== '1') {
        post.canvasWrapEl.dataset.scrolled = '1'
      }
      if (target === HANDOFF_BEAT && from < HANDOFF_BEAT) runRise()
      if (from >= HANDOFF_BEAT && target < HANDOFF_BEAT) resetRise()
      const dur = target > from ? BEATS[target].dur : Math.max(0.6, BEATS[from].dur * 0.75)
      gsap.to(progress, {
        current: BEATS[target].p,
        duration: dur,
        ease: 'power2.inOut',
        overwrite: true,
        onComplete: () => {
          animRef.current = false
          if (beatRef.current === LAST_BEAT) unlock()
          const q = queueRef.current
          queueRef.current = 0
          if (q) stepRef.current(q)
        },
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [override, runRise, resetRise, unlock],
  )

  const step = useCallback(
    (dir: number) => {
      const target = Math.min(LAST_BEAT, Math.max(0, beatRef.current + dir))
      if (target === beatRef.current) return
      if (animRef.current) {
        queueRef.current = dir // max 1: a newer request replaces the queue
        return
      }
      runBeat(target)
    },
    [runBeat],
  )
  stepRef.current = step

  /** Jump the story to its settled end (Skip / Join pill while locked). */
  const finishStory = useCallback(() => {
    queueRef.current = 0
    animRef.current = false
    beatRef.current = LAST_BEAT
    setBeat(LAST_BEAT)
    gsap.to(progress, { current: 1, duration: 0.6, ease: 'power1.out', overwrite: true })
    if (post.canvasWrapEl) post.canvasWrapEl.dataset.scrolled = '1'
    resetRise() // CSS owns the settled states; stale FLIP transforms would fight it
    unlock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetRise, unlock])

  // ---- input capture: wheel, touch, keys — stepped, queued, reversible ----
  useEffect(() => {
    if (mode !== 'full') return

    // iOS pull-to-refresh / rubber band would fight the lock
    const prevOB = document.documentElement.style.overscrollBehaviorY
    document.documentElement.style.overscrollBehaviorY = 'none'
    window.scrollTo(0, 0)

    let wheelArmed = true
    let wheelAcc = 0
    let lastWheelT = 0
    const onWheel = (e: WheelEvent) => {
      const now = performance.now()
      // a real gap between events = a new gesture; inertia tails stay gated
      if (now - lastWheelT > 180) {
        wheelArmed = true
        wheelAcc = 0
      }
      lastWheelT = now
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      if (lockedRef.current) {
        e.preventDefault()
        if (!wheelArmed) return
        wheelAcc += dy
        if (Math.abs(wheelAcc) >= 26) {
          wheelArmed = false
          stepRef.current(wheelAcc > 0 ? 1 : -1)
          wheelAcc = 0
        }
      } else if (window.scrollY <= 0 && dy < -8 && wheelArmed) {
        // unlocked, at the very top, gesturing up: back into the story
        e.preventDefault()
        wheelArmed = false
        relock()
        stepRef.current(-1)
      }
    }

    const touch = { y0: 0, lastY: 0, t0: 0, fired: false, topAtStart: false }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      touch.y0 = e.touches[0].clientY
      touch.lastY = touch.y0
      touch.t0 = performance.now()
      touch.fired = false
      touch.topAtStart = window.scrollY <= 0
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      touch.lastY = e.touches[0].clientY
      const dy = touch.y0 - touch.lastY // >0: finger up = forward
      if (lockedRef.current) {
        e.preventDefault() // the story owns the gesture (kills rubber-banding too)
        if (touch.fired) return
        if (Math.abs(dy) >= 46) {
          touch.fired = true
          stepRef.current(dy > 0 ? 1 : -1)
        }
      } else if (touch.topAtStart && window.scrollY <= 0 && dy < -36 && !touch.fired) {
        e.preventDefault()
        touch.fired = true
        relock()
        stepRef.current(-1)
      }
    }
    const onTouchEnd = () => {
      // a short, fast flick that never reached the move threshold still
      // counts as exactly one step
      if (!lockedRef.current || touch.fired) return
      const dy = touch.y0 - touch.lastY
      const dt = performance.now() - touch.t0
      if (Math.abs(dy) >= 22 && dt < 260) {
        touch.fired = true
        stepRef.current(dy > 0 ? 1 : -1)
      }
    }

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const fwd = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)
      const back = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)
      if (lockedRef.current) {
        if (fwd || back) {
          e.preventDefault()
          stepRef.current(fwd ? 1 : -1)
        }
      } else if (back && window.scrollY <= 0) {
        e.preventDefault()
        relock()
        stepRef.current(-1)
      }
    }

    // scrollbar-drag guard: while the story plays, the page stays at 0
    const onScroll = () => {
      if (lockedRef.current && window.scrollY !== 0) window.scrollTo(0, 0)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })

    // FIRST-IMPRESSION LOAD: the poster paints instantly; the 3D chunk
    // mounts after first paint goes idle, staying at opacity 0 while
    // shaders compile — then the poster crossfades out. Input intent arms
    // it even earlier.
    const arm = () => setMount3d(true)
    const opts = { once: true, passive: true } as const
    window.addEventListener('wheel', arm, opts)
    window.addEventListener('touchstart', arm, opts)
    window.addEventListener('keydown', arm, opts)
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    const kick = () => (typeof w.requestIdleCallback === 'function'
      ? w.requestIdleCallback!(arm, { timeout: 1200 })
      : window.setTimeout(arm, 400))
    let timer = 0
    if (document.readyState === 'complete') timer = window.setTimeout(kick, 150)
    else window.addEventListener('load', () => { timer = window.setTimeout(kick, 150) }, { once: true })
    if (window.location.search.includes('freeze3')) arm()

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('wheel', arm)
      window.removeEventListener('touchstart', arm)
      window.removeEventListener('keydown', arm)
      window.clearTimeout(timer)
      document.documentElement.style.overscrollBehaviorY = prevOB
      gsap.killTweensOf(progress)
    }
  }, [mode, relock])

  // ---- Refresh: 3 NEW real options, already-shown ids excluded ----
  const [refreshing, setRefreshing] = useState(false)
  const [cycledNote, setCycledNote] = useState(false)
  const seenIds = useRef(new Set<string>())
  const seenNames = useRef(new Set<string>())
  const refreshBusy = useRef(false)

  const refresh = useCallback(async () => {
    if (refreshBusy.current) return
    refreshBusy.current = true
    setRefreshing(true)
    setCycledNote(false)
    for (const p of picks) {
      seenIds.current.add(p.id)
      seenNames.current.add(p.name)
    }
    const req = getRefresh([...seenIds.current]) // in flight during the leave animation
    const leave = new Promise((r) => window.setTimeout(r, 380))
    const [res] = await Promise.all([req, leave])
    let next: LivePick[]
    let cycled = false
    if (res) {
      next = res.picks
      cycled = res.cycled
    } else {
      // API unreachable: cycle REAL wall rows we have not shown yet — real
      // names, real facts; their reason line is the plain cuisine label.
      const pool = wall.filter(
        (w) =>
          !seenIds.current.has(w.id) &&
          !seenNames.current.has(w.name) &&
          !picks.some((p) => p.id === w.id || p.name === w.name),
      )
      if (pool.length >= 3) next = pool.slice(0, 3)
      else {
        next = basePicks // the pool ran dry: back to the top picks
        cycled = true
      }
    }
    if (cycled) {
      // seen everything — restart the exclusion set from this trio and say
      // so quietly, once (the app's own "Back to our top picks" rule)
      seenIds.current.clear()
      seenNames.current.clear()
      setCycledNote(true)
    }
    for (const p of next) {
      seenIds.current.add(p.id)
      seenNames.current.add(p.name)
    }
    setOverride(next)
    setRefreshing(false)
    refreshBusy.current = false
  }, [picks, wall, basePicks])

  /** The pill's jump: finish the story if it is still playing, then native
   *  smooth scroll; focuses the email after. */
  const jumpToWaitlist = useCallback(() => {
    if (lockedRef.current) finishStory()
    const el = document.querySelector('#waitlist')
    if (!el) return
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => {
        ;(document.querySelector('#waitlist-email') as HTMLInputElement | null)?.focus({ preventScroll: true })
      }, 900)
    }, 30)
  }, [finishStory])

  const skipToDemo = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (lockedRef.current) finishStory()
      window.setTimeout(() => {
        post.demoEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 30)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finishStory],
  )

  // Everything after the stage: the live demo, FAQ, the join (wordmark +
  // waitlist band) and the footer — identical in full and static modes,
  // only the wordmark's 3 differs (scene-lit vs always lit).
  const tail = (
    <div className="j-tail">
      <section
        id="demo"
        className="j-demo"
        ref={(el) => { post.demoEl = el }}
      >
        <Suspense fallback={<div style={{ minHeight: '80svh' }} aria-hidden="true" />}>
          <DemoSection />
        </Suspense>
      </section>
      <FAQ />
      <section className="j-join">
        <p className="j-wordmark" aria-label="Jou3an">
          Jou
          <span
            ref={mode === 'full' ? (el) => { post.wm3El = el } : undefined}
            className="j-wm3"
            data-lit={mode !== 'full' ? '1' : '0'}
          >
            3
          </span>
          an
        </p>
      </section>
      <CTABand />
      <Footer />
    </div>
  )

  if (mode === 'static') {
    return (
      <div className="j-root">
        <JoinPill onJoin={jumpToWaitlist} />
        <StaticJourney
          picks={picks}
          names={wall.map((p) => p.name)}
          onRefresh={refresh}
          refreshing={refreshing}
        />
        {tail}
      </div>
    )
  }

  const spec = BEATS[beat]

  return (
    <div className="j-root">
      <JoinPill onJoin={jumpToWaitlist} />

      {/* The persistent scene, behind everything. The poster is a still of
          the lacquer 3 rendered from THIS scene at its exact resting pose
          (scripts: build, open /v2?freeze3=1, capture — see
          ASSET_CREDITS.md): it paints on first byte, and when the live
          canvas has compiled its shaders and warmed the composer
          (data-ready) the two crossfade — same pose, no pop. */}
      <div className="j-canvas" aria-hidden="true" data-ready="0" data-scrolled="0" ref={(el) => { post.canvasWrapEl = el }}>
        <img
          className="j-poster"
          src="/v2/three-poster.webp"
          alt=""
          width={900}
          height={900}
          fetchPriority="high"
          decoding="async"
        />
        {mode === 'full' && mount3d ? (
          <Suspense fallback={null}>
            <JourneyCanvas
              wall={wall}
              progress={progress}
              post={post}
              isPhone={isPhone}
              onReady={() => { if (post.canvasWrapEl) post.canvasWrapEl.dataset.ready = '1' }}
            />
          </Suspense>
        ) : null}
      </div>

      {/* The stepped stage: ONE viewport, beats change only transforms and
          opacity (CLS 0 by construction). overflow: clip contains every
          fly-out — nothing here may ever widen the page. */}
      <div
        className="j-stage"
        data-beat={beat}
        data-copy={spec.copy}
        data-field={spec.field}
        data-swipe={beat === LAST_BEAT ? '1' : '0'}
        data-done={storyDone ? '1' : '0'}
      >
        {/* ch1–3: centered headlines */}
        <div className="j-copy-center" aria-hidden={spec.copy > 3}>
          <header className="j-copy j-copy-1">
            <h2 className="j-title">Hungry?</h2>
            <p className="j-sub">A food decision engine for Dubai.</p>
          </header>
          <header className="j-copy j-copy-2">
            <h2 className="j-title">Too many options.</h2>
            <p className="j-sub">All of them open. All of them plausible.</p>
            <div className="j-note">
              <VenueNote />
            </div>
          </header>
          <header className="j-copy j-copy-3">
            <h2 className="j-title">Jou3an <em>decides</em>.</h2>
            <p className="j-sub">Exactly 3 answers.</p>
          </header>
        </div>

        {/* ch4+ch5: the narrowing field and the three answers */}
        <div className="j-answers" aria-hidden={spec.field === 0}>
          <div className="j-copy-stack">
            <header className="j-copy j-copy-4">
              <h2 className="j-title j-title-s">
                From all the options, exactly <em>3</em>.
              </h2>
            </header>
            <header className="j-copy j-copy-5" aria-hidden="true">
              <h2 className="j-title j-title-s">It learns you.</h2>
              <p className="j-sub">Swipe to teach it.</p>
            </header>
          </div>

          {/* the four filter labels — lit one by one, no counters */}
          <div className="j-filters" aria-hidden="true">
            {FILTERS.map((label, i) => (
              <span
                key={label}
                className="j-filterchip"
                data-state={spec.field >= i + 2 ? (spec.field === i + 2 ? 'active' : 'done') : 'idle'}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="j-arena">
            <ul className="j-field">
              {fieldTiles.map((t, i) => (
                <li
                  key={t.pick.id + ':' + i}
                  ref={t.surviveIdx >= 0 ? (el) => { pickTileEls.current[t.surviveIdx] = el } : undefined}
                  className="j-tile"
                  data-pick={t.surviveIdx >= 0 ? '1' : '0'}
                  data-exit={t.step > 0 ? FILTER_EXIT[t.step - 1] : undefined}
                  data-gone={t.step > 0 && spec.field >= t.step + 1 ? '1' : '0'}
                  style={{ transitionDelay: `${(i % 7) * 45}ms` }}
                >
                  <span className="j-tile-dot" style={{ background: cuisineTone(t.pick.cuisine) }} />
                  <span className="j-tile-name">{t.pick.name}</span>
                </li>
              ))}
            </ul>

            <div className="jp-gridwrap">
              <div className="jp-grid" data-leaving={refreshing ? '1' : '0'}>
                {picks.map((p, i) => (
                  <div className="jp-slot" key={p.id}>
                    <PickCard
                      pick={p}
                      rank={i + 1}
                      cardRef={(el) => { cardEls.current[i] = el }}
                      className={i === 1 ? 'jp-out' : undefined}
                    />
                    {i === 1 && replacement ? (
                      <PickCard pick={replacement} rank={2} className="jp-in" />
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="j-refresh-row">
                {cycledNote ? <p className="j-cycled">Back to our top picks</p> : null}
                <button
                  type="button"
                  className="j-refreshbtn"
                  onClick={refresh}
                  disabled={refreshing}
                  tabIndex={spec.field === 6 && spec.copy === 4 ? 0 : -1}
                >
                  {refreshing ? 'Deciding…' : 'Refresh — 3 new picks'}
                </button>
              </div>
            </div>
          </div>

          <div className="j-note j-note-answers">
            <VenueNote />
          </div>
        </div>

        {/* persistent stage chrome */}
        <p className="j-stephint" data-hidden={beat > 0 ? '1' : '0'} aria-hidden="true">
          Scroll — one step at a time
        </p>
        <a className="j-skip" href="#demo" onClick={skipToDemo} data-hidden={storyDone ? '1' : '0'}>
          Skip to the live demo ↓
        </a>
      </div>

      {tail}

      {showFps ? <FpsMeter /> : null}
    </div>
  )
}
