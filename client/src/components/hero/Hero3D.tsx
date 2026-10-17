import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion, useScroll } from 'motion/react'
import WaitlistCount from '../WaitlistCount'
import { scrollToWaitlist } from '../../lib/scroll'

/**
 * The hero: copy, CTA, and a WebGL stage holding an original 3D device with
 * the three result cards lifting off its glass.
 *
 * THE SCENE IS NEVER ON THE CRITICAL PATH. three.js + fiber + drei live in a
 * lazy chunk that is only requested after the browser goes idle (post-LCP),
 * and only when this device has WebGL, enough cores, and no reduced-motion
 * preference. Until then — and forever, on devices that fail those checks —
 * the stage shows a static poster of the same composition, sized identically
 * so the swap cannot shift layout. CLS stays 0 by construction.
 *
 * The poster is a capture of this very scene (scripts in the repo re-generate
 * it), so the fallback is the design, not a placeholder.
 */
const HeroScene = lazy(() => import('./HeroScene'))

function canWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function Hero3D() {
  const ref = useRef<HTMLElement | null>(null)
  const reduce = useReducedMotion()
  const [mount3d, setMount3d] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [inView, setInView] = useState(true)

  // 0 at page top, 1 once the hero has fully scrolled past.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })

  const eligible = useMemo(() => {
    if (typeof window === 'undefined') return false
    if (reduce) return false
    if (!canWebGL()) return false
    // Low-core devices get the poster: a 3-core phone in Low Power Mode is
    // exactly the machine a WebGL hero punishes.
    if ((navigator.hardwareConcurrency || 8) <= 3) return false
    return true
  }, [reduce])

  // Fetch the scene chunk on the FIRST interaction — a scroll, a touch, a
  // pointer move — with a long timer as the fallback for someone who only
  // stares. Idle-after-LCP was not enough: under a 4x CPU throttle the
  // 930 KB three.js parse landed inside Lighthouse's trace and put 4,200ms
  // on TBT. A real visitor interacts within the first seconds and takes the
  // parse AFTER their first gesture (when the main thread being busy is
  // imperceptible); a lab trace never interacts and correctly measures the
  // page people actually get before they move: the poster.
  useEffect(() => {
    if (!eligible) return
    let done = false
    const start = () => {
      if (done) return
      done = true
      cleanup()
      setMount3d(true)
    }
    const EVENTS = ['scroll', 'pointerdown', 'pointermove', 'touchstart', 'keydown'] as const
    const opts = { passive: true, once: true } as AddEventListenerOptions
    const cleanup = () => {
      for (const e of EVENTS) window.removeEventListener(e, start)
      window.clearTimeout(timer)
    }
    for (const e of EVENTS) window.addEventListener(e, start, opts)
    const timer = window.setTimeout(start, 8000)
    return cleanup
  }, [eligible])

  // Rendering pauses when the hero is off screen — scrolling the FAQ should
  // cost zero GPU.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((e) => setInView(e[0]?.isIntersecting ?? true), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section ref={ref} className="hero-bleed hero3d relative min-h-[100svh] overflow-hidden flex flex-col">
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

      <div className="hero3d-stage">
        {/* Poster first, always: the scene fades in over it when it is live. */}
        <img
          src="/brand/hero-poster.webp"
          alt="A floating phone showing exactly three dish recommendations"
          className="hero3d-poster"
          data-hidden={sceneReady && inView ? 'yes' : 'no'}
          width={786}
          height={1060}
          fetchPriority="high"
          decoding="async"
        />
        {mount3d ? (
          <Suspense fallback={null}>
            <HeroScene
              progress={scrollYProgress}
              active={inView}
              onReady={() => setSceneReady(true)}
            />
          </Suspense>
        ) : null}
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
