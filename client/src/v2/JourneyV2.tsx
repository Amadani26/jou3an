/**
 * WEB V2 TECH SPIKE — "The journey of 3", chapters 1→3 only.
 * Storyboard + tech plan: docs/web-v2-storyboard.md (repo root).
 *
 * Architecture under test:
 *   - ONE persistent R3F canvas FIXED behind an HTML layer; every word and
 *     control is HTML (accessible, selectable, SEO-visible) — the canvas is
 *     scenery, never the copy.
 *   - Lenis smooth scroll + GSAP ScrollTrigger scrub writing ONE progress
 *     number into a ref; the scene reads it in useFrame. No React state on
 *     the scroll path.
 *   - 3D lazy-mounts AFTER first paint (requestIdleCallback), so the HTML
 *     chapter stack is the LCP, not the WebGL bundle.
 *   - Static fallback (no canvas, no Lenis) for reduced-motion or no-WebGL
 *     visitors: the same chapters as plain readable sections.
 *
 * REAL DATA ONLY: tunnel cards are the live showcase's wall rows (real
 * names, real Google ratings with attribution or none) via the same
 * useShowcase() the production page uses — snapshot first, live replaces.
 *
 * ?fps=1 overlays a frame-time meter (dev/measurement aid).
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useShowcase } from '../lib/useShowcase'
import { prefersReducedMotion } from '../lib/reveal'
import VenueNote from '../components/VenueNote'
import '../v2/journey.css'

const JourneyCanvas = lazy(() => import('./JourneyCanvas'))

function webglOK(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Frame-time meter for the spike's measurements (?fps=1). */
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

function Chapter({
  kicker,
  title,
  sub,
  children,
}: {
  kicker: string
  title: React.ReactNode
  sub: string
  children?: React.ReactNode
}) {
  return (
    <section className="j-chapter">
      <div className="j-sticky">
        <p className="j-kicker">{kicker}</p>
        <h2 className="j-title">{title}</h2>
        <p className="j-sub">{sub}</p>
        {children}
      </div>
    </section>
  )
}

/** Reduced-motion / no-WebGL fallback: the same story as readable sections. */
function StaticJourney({ names }: { names: string[] }) {
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
    </div>
  )
}

export default function JourneyV2() {
  const { data } = useShowcase()
  const picks = data.wall.length ? data.wall : data.picks

  const [mode, setMode] = useState<'pending' | 'full' | 'static'>('pending')
  const [mount3d, setMount3d] = useState(false)
  const progress = useRef(0)
  const runwayRef = useRef<HTMLDivElement>(null)

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
        progress.current = self.progress
      },
    })

    // The scene mounts when the JOURNEY starts — first scroll/touch intent —
    // not at load: chapter 1's resting state is darkness and the ignition
    // only begins ~24vh in, so the ~300ms of three parse/compile happens
    // while the visitor is still reading the headline. A 6s timer catches
    // the visitor who waits. (This is also what keeps the WebGL bundle's
    // main-thread cost out of first load entirely.)
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

  if (mode === 'static') return <StaticJourney names={picks.map((p) => p.name)} />

  return (
    <div className="j-root">
      {/* The persistent scene, behind everything. */}
      <div className="j-canvas" aria-hidden="true">
        {mode === 'full' && mount3d ? (
          <Suspense fallback={null}>
            <JourneyCanvas picks={picks} progress={progress} isPhone={isPhone} />
          </Suspense>
        ) : null}
      </div>

      {/* The HTML story. 600vh runway: three chapters, 200vh each. */}
      <div ref={runwayRef} className="j-runway">
        <Chapter kicker="Chapter 1" title={<>Hungry?</>} sub="A food decision engine for Dubai." />
        <Chapter
          kicker="Chapter 2"
          title={<>Too many options.</>}
          sub="All of them open. All of them plausible."
        >
          <div className="j-note">
            <VenueNote />
          </div>
        </Chapter>
        <Chapter
          kicker="Chapter 3"
          title={
            <>
              Jou3an <em>decides</em>.
            </>
          }
          sub="Exactly 3 answers."
        />
      </div>

      <section className="j-end">
        <p className="j-kicker">End of the tech spike</p>
        <p className="j-sub">
          Chapters 4–7 — the three answers, the taste shift, the live demo and the waitlist — are
          storyboarded in <code>docs/web-v2-storyboard.md</code>.
        </p>
        <Link className="j-back" to="/">
          ← Back to the live site
        </Link>
      </section>

      {showFps ? <FpsMeter /> : null}
    </div>
  )
}
