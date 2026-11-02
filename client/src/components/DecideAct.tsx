import { useEffect, useRef, useState } from 'react'
import { MapPin, Navigation, Phone, ShoppingBag } from 'lucide-react'
import { DISHES, SURVIVOR_INDEXES } from '../lib/dishes'
import { prefersReducedMotion } from '../lib/reveal'
import { cuisineTone, metaLine } from '../lib/live'
import { useShowcase } from '../lib/useShowcase'
import VenueNote from './VenueNote'

/**
 * DECIDE → ACT — the mini story of what happens after you pick.
 *
 *   1. CARD    the chosen result, large: licensed dish photo, name,
 *              cuisine · area · price, the three action buttons.
 *   2. TAP     a simulated tap lands on Directions — ripple blooms — and
 *              the card fades off the SCENE behind it.
 *   3. JOURNEY a full-bleed 3D navigation view: our own abstract blocks
 *              extruded as softly lit buildings on a tilted plane (CSS 3D,
 *              nothing traced from anywhere real — no tiles, no streets of
 *              any actual city). The You dot travels the red route with a
 *              light trail while the camera pans with it and banks into
 *              each turn (~2.3s, time-based).
 *   4. ARRIVED the camera pulls back, a pulse bursts at the destination,
 *              the "On your way" chip pops in — and the scene never goes
 *              still: light pulses run the route, the camera drifts, the
 *              pin glow breathes. The idle loop pauses off-screen.
 *
 * ⚠️ PLAY ONCE: a once-and-disconnect IntersectionObserver starts the
 * story; stages only move forward, so scrolling away and back finds the
 * arrived scene (idle loop running). The DEFAULT (no JS, prerender,
 * reduced motion) is the arrived frame — paint-first everywhere. A second
 * cheap observer only toggles `data-live` to pause the idle animations
 * while the section is off-screen.
 *
 * THE CAMERA is one rAF writing a single transform on the world plane
 * (scale · rotateX · rotateZ · translate — the translate keeps the dot's
 * route point glued to screen centre regardless of yaw), plus the dot
 * transform and the trail dash-offsets. Everything else is CSS keyed off
 * `data-stage`. The scene wrapper has a fixed height, so CLS is 0 by
 * construction.
 */

/** The generic-dish fallback: today's zero-risk content, unchanged. */
const DISH_PICK = DISHES[SURVIVOR_INDEXES[0]]

type Stage = 'wait' | 'card' | 'tap' | 'map' | 'arrived'
const ORDER: Stage[] = ['wait', 'card', 'tap', 'map', 'arrived']

const TILES = [
  { label: 'Directions', Icon: Navigation, kind: 'dir' },
  { label: 'Call', Icon: Phone, kind: 'call' },
  { label: 'Order', Icon: ShoppingBag, kind: 'order' },
] as const

/* ------------------------------------------------------------------ */
/* The invented city — 640×420 world units, authored so no block ever  */
/* crosses a street. {x, y, w, d, h}: footprint + extrusion height.    */
/* ------------------------------------------------------------------ */

const WORLD_W = 640
const WORLD_H = 420

const BLOCKS: [number, number, number, number, number][] = [
  [118, 82, 96, 70, 26],
  [234, 76, 84, 58, 34],
  [374, 90, 80, 58, 22], // the destination's block
  [126, 176, 78, 92, 18],
  [224, 176, 92, 74, 30],
  [338, 196, 108, 64, 24],
  [122, 344, 88, 56, 20],
  [236, 282, 80, 66, 28],
  [472, 172, 60, 90, 32],
  [386, 282, 66, 66, 16],
  [18, 180, 70, 80, 22],
  [30, 352, 70, 56, 14],
  [540, 196, 66, 64, 26],
  [476, 296, 90, 60, 18],
  [236, 16, 80, 52, 20],
  [480, 20, 100, 56, 28],
  [20, 20, 80, 70, 16],
  [472, 352, 110, 56, 12],
  [560, 100, 60, 52, 20],
]

/** The route, street by street: You → the door. Axis-aligned on purpose. */
const ROUTE: [number, number][] = [
  [162, 332],
  [216, 332],
  [216, 272],
  [326, 272],
  [326, 162],
  [414, 162],
]
const ROUTE_D = 'M162 332 H216 V272 H326 V162 H414'
const DEST = ROUTE[ROUTE.length - 1]

/** Per-segment camera bank (deg) — leaning into each turn, not a compass. */
const SEG_YAW = [-12, 12, -10, 14, -8]

/* Segment lengths + total, for the dot's arc-length parametrisation. */
const SEG_LEN = ROUTE.slice(1).map(
  (p, i) => Math.abs(p[0] - ROUTE[i][0]) + Math.abs(p[1] - ROUTE[i][1]),
)
const ROUTE_LEN = SEG_LEN.reduce((a, b) => a + b, 0)

/** Point + segment index at arc length s. */
function routeAt(s: number): { x: number; y: number; seg: number } {
  let rest = Math.max(0, Math.min(ROUTE_LEN, s))
  for (let i = 0; i < SEG_LEN.length; i++) {
    if (rest <= SEG_LEN[i] || i === SEG_LEN.length - 1) {
      const t = SEG_LEN[i] ? rest / SEG_LEN[i] : 1
      const [ax, ay] = ROUTE[i]
      const [bx, by] = ROUTE[i + 1]
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, seg: i }
    }
    rest -= SEG_LEN[i]
  }
  return { x: DEST[0], y: DEST[1], seg: SEG_LEN.length - 1 }
}

/* ---- the camera (shared by the rAF's last frame and the CSS default;
        FINAL_* are mirrored by .nav-world's resting transform) ---- */
const TILT = 55
const JOURNEY_MS = 2300
const PULLBACK_MS = 520
const FINAL_FOCUS = [300, 250] // what the resting camera centres on
const FINAL_ZOOM_MOBILE = 1.18
const FINAL_ZOOM_DESKTOP = 1.0
const TRAVEL_ZOOM_MOBILE = 1.62
const TRAVEL_ZOOM_DESKTOP = 1.34

const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const worldTransform = (zoom: number, yaw: number, fx: number, fy: number) =>
  `scale(${zoom.toFixed(3)}) rotateX(${TILT}deg) rotateZ(${yaw.toFixed(2)}deg) ` +
  `translate3d(${(WORLD_W / 2 - fx).toFixed(1)}px, ${(WORLD_H / 2 - fy).toFixed(1)}px, 0)`

/** The 3D neighbourhood: ground SVG + extruded blocks + the destination. */
function NavWorld() {
  return (
    <div className="nav-world">
      <svg
        className="nav-ground"
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        width={WORLD_W}
        height={WORLD_H}
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        {/* Streets of nowhere. */}
        <g stroke="#1d1d1d" strokeWidth="7" strokeLinecap="round">
          <path d="M0 162 H640" />
          <path d="M0 272 H640" />
          <path d="M0 332 H216" />
          <path d="M216 0 V420" />
          <path d="M326 0 V420" />
          <path d="M462 0 V420" />
        </g>
        {/* The route: a soft glow under a solid core, both revealed by the
            same dash-offset as the dot travels (pathLength-normalised). */}
        <path className="nav-rglow" d={ROUTE_D} pathLength={1000} />
        <path className="nav-rcore" d={ROUTE_D} pathLength={1000} />
        {/* The idle comet: a short bright pulse looping the route forever. */}
        <path className="nav-comet" d={ROUTE_D} pathLength={1000} />
      </svg>

      {BLOCKS.map(([x, y, w, d, h], i) => (
        <div
          key={i}
          className="bld"
          style={{
            left: x,
            top: y,
            width: w,
            height: d,
            ['--h' as string]: `${h}px`,
          }}
        >
          <span className="bld-s" />
          <span className="bld-e" />
          <span className="bld-top" />
        </div>
      ))}

      {/* You — a lit dot on the ground; the rAF drives it along the route. */}
      <span className="nav-you" />

      {/* The destination: ground rings + a beam of red light at the door,
          breathing forever once arrived; the burst fires once on arrival. */}
      <div className="nav-dest" style={{ left: DEST[0], top: DEST[1] }}>
        <span className="nav-ring" />
        <span className="nav-burst" />
        <span className="nav-beam" />
      </div>
    </div>
  )
}

export default function DecideAct() {
  const ref = useRef<HTMLElement | null>(null)
  const [stage, setStage] = useState<Stage>('wait')
  const [live, setLive] = useState(true)
  const timers = useRef<number[]>([])
  const rafRef = useRef(0)

  /* The journey: one rAF writing the camera, the dot and the trail. */
  const drive = () => {
    const world = ref.current?.querySelector<HTMLElement>('.nav-world')
    if (!world) return
    const dot = world.querySelector<HTMLElement>('.nav-you')
    const glow = world.querySelector<SVGPathElement>('.nav-rglow')
    const core = world.querySelector<SVGPathElement>('.nav-rcore')
    const desktop = window.matchMedia('(min-width: 768px)').matches
    const travelZoom = desktop ? TRAVEL_ZOOM_DESKTOP : TRAVEL_ZOOM_MOBILE
    const finalZoom = desktop ? FINAL_ZOOM_DESKTOP : FINAL_ZOOM_MOBILE

    let yaw = SEG_YAW[0]
    let last = performance.now()
    const t0 = last

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now - t0

      if (t <= JOURNEY_MS) {
        const s = ROUTE_LEN * easeInOutCubic(clamp01(t / JOURNEY_MS))
        const p = routeAt(s)
        yaw += (SEG_YAW[p.seg] - yaw) * Math.min(1, 6 * dt)
        world.style.transform = worldTransform(travelZoom, yaw, p.x, p.y)
        if (dot) dot.style.transform = `translate3d(${p.x}px, ${p.y}px, 1px)`
        const off = String(1000 - (s / ROUTE_LEN) * 1000)
        if (glow) glow.style.strokeDashoffset = off
        if (core) core.style.strokeDashoffset = off
      } else {
        /* pull back to the resting frame */
        const q = easeInOutCubic(clamp01((t - JOURNEY_MS) / PULLBACK_MS))
        const zoom = travelZoom + (finalZoom - travelZoom) * q
        const fx = DEST[0] + (FINAL_FOCUS[0] - DEST[0]) * q
        const fy = DEST[1] + (FINAL_FOCUS[1] - DEST[1]) * q
        yaw += (0 - yaw) * Math.min(1, 7 * dt)
        world.style.transform = worldTransform(zoom, q >= 1 ? 0 : yaw, fx, fy)
        if (dot) dot.style.transform = `translate3d(${DEST[0]}px, ${DEST[1]}px, 1px)`
        if (glow) glow.style.strokeDashoffset = '0'
        if (core) core.style.strokeDashoffset = '0'
        if (q >= 1) {
          setStage('arrived')
          return
        }
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const finish = () => setStage('arrived')
    if (typeof IntersectionObserver === 'undefined') {
      finish()
      return
    }
    const io = new IntersectionObserver(
      (e) => {
        if (!e[0]?.isIntersecting) return
        io.disconnect()
        if (prefersReducedMotion()) {
          finish()
          return
        }
        const at = (fn: () => void, ms: number) =>
          timers.current.push(window.setTimeout(fn, ms))
        setStage('card')
        at(() => setStage('tap'), 1400) // read the card, then the tap lands
        at(() => {
          setStage('map') // card morphs off the scene...
          drive() // ...and the journey rolls (sets 'arrived' itself)
        }, 2050)
      },
      { rootMargin: '-15% 0px' },
    )
    io.observe(el)

    // Idle-loop economy: pause the forever-animations while off screen.
    const liveIO = new IntersectionObserver((e) =>
      setLive(e[0]?.isIntersecting ?? true),
    )
    liveIO.observe(el)

    return () => {
      io.disconnect()
      liveIO.disconnect()
      for (const t of timers.current) window.clearTimeout(t)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rank = ORDER.indexOf(stage)

  // The destination: the engine's live #1 pick (real facts only — a Google
  // rating with its attribution or no score, a real price or none), falling
  // back to the generic dish while pending or when the API is down.
  const showcase = useShowcase()
  const livePick = showcase.status === 'live' ? showcase.data.picks[0] : null
  const title = livePick ? livePick.name : DISH_PICK.dish
  const meta = livePick
    ? metaLine(livePick)
    : `${DISH_PICK.cuisine} · ${DISH_PICK.area} · ${DISH_PICK.price}`
  const score = livePick
    ? livePick.rating != null
      ? `★ ${livePick.rating.toFixed(1)} · Google`
      : null
    : DISH_PICK.score.toFixed(1)

  return (
    <section
      ref={ref}
      className="act-section"
      data-stage={stage}
      data-live={live ? 'yes' : 'no'}
    >
      <div className="act-stage">
        <p className="act-eyebrow">You&apos;re going to</p>
        <h2 className="story-name">{title}</h2>

        {/* Full-bleed stage: the 3D scene behind, the chosen-dish card
            floating over it until the tap sends it on its way. Fixed
            height — no stage change can move layout. */}
        <div className="story-stagewrap">
          <div className="story-scene" aria-hidden="true">
            {/* The drift wrapper owns the idle camera sway (2D) and the
                perspective the 3D world renders under. */}
            <div className="nav-drift">
              <NavWorld />
            </div>
          </div>

          <span className="story-chip" role="status">
            <MapPin size={13} strokeWidth={2.2} aria-hidden="true" />
            On your way
          </span>

          <div className="story-cardlayer" aria-hidden={rank >= 3}>
            {/* A real restaurant never wears a stock photo: live picks get
                their cuisine's colour field. The dish fallback keeps its
                licensed photo as before. */}
            {livePick ? (
              <span
                className="story-photo story-field"
                style={{ background: cuisineTone(livePick.cuisine) }}
                aria-hidden="true"
              />
            ) : DISH_PICK.photo ? (
              <img
                src={`/brand/dishes/${DISH_PICK.photo}.webp`}
                alt=""
                className="story-photo"
                width={800}
                height={600}
                loading="lazy"
                decoding="async"
              />
            ) : null}
            <span className="story-scrim" aria-hidden="true" />
            <div className="story-info">
              <p className="story-meta">
                {meta}
                {score ? <span className="story-score">{score}</span> : null}
              </p>
              <div className="story-actions">
                {TILES.map((t) => (
                  <span
                    key={t.label}
                    className={`story-btn story-btn-${t.kind}`}
                    aria-hidden="true"
                  >
                    <t.Icon size={17} strokeWidth={1.9} />
                    {t.label}
                    {t.kind === 'dir' ? <i className="story-ripple" /> : null}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="act-sub">Three taps, start to table.</p>
        {livePick ? <VenueNote /> : null}
      </div>
    </section>
  )
}
