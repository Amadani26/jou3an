import { useEffect, useRef, useState } from 'react'
import { Navigation, Phone, ShoppingBag } from 'lucide-react'
import { DISHES, SURVIVOR_INDEXES } from '../lib/dishes'
import { prefersReducedMotion } from '../lib/reveal'

/**
 * DECIDE → ACT as a DEPARTURE BOARD.
 *
 * The app's payoff moment staged like an airport split-flap board: the
 * metadata line and then the dish name flip rapidly through characters and
 * lock left to right with a mechanical rhythm; a route then draws itself
 * from a "You" dot to a destination pin across an abstract grid of
 * street-like lines WE drew (an original SVG — not a map, no tiles, no
 * provider imagery); the pin pulses red once as the line arrives; and the
 * three action tiles spring in, each icon with its own signature move —
 * the Directions arrow traces forward, Call wiggles like a ring, Order's
 * bag drops in with a bounce. Tapping a tile replays its icon's move plus
 * the red ring. Tiles perform the UI without pretending to be it.
 *
 * ⚠️ PLAY ONCE: one IntersectionObserver fires the sequence the first time
 * the section enters and disconnects; every stage is a forward-only state,
 * so scrolling away and back finds the board in its final state.
 *
 * The flap is a single rAF loop writing ≤24 letter cells at ~20Hz for under
 * two seconds — no per-letter timers, no layout churn (cells are fixed-width
 * ch boxes, so the board never reflows: CLS 0 by construction). Everything
 * else is CSS transforms, opacity and SVG stroke-dashoffset.
 *
 * Reduced motion / no JS / prerender: the final frame — name set, line
 * drawn, tiles visible. The flap's initial state IS the final text, so the
 * prerendered page reads correctly before any script runs.
 */

const PICK = DISHES[SURVIVOR_INDEXES[0]]
const META = `${PICK.cuisine} · ${PICK.area} · ${PICK.price}`.toUpperCase()
const NAME = PICK.dish.toUpperCase()

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789–·'

type Stage = 'wait' | 'board' | 'route' | 'tiles'
const STAGE_RANK: Record<Stage, number> = { wait: 0, board: 1, route: 2, tiles: 3 }

/**
 * One split-flap line. `start` begins the animation; until then (and forever
 * under reduced motion) the final text shows. `lockMs` is the left-to-right
 * landing rhythm; unlocked cells churn every ~45ms.
 */
function FlapLine({
  text,
  start,
  lockMs,
  delay = 0,
  className,
  onDone,
}: {
  text: string
  start: boolean
  lockMs: number
  delay?: number
  className: string
  onDone?: () => void
}) {
  const chars = text.split('')
  const [cells, setCells] = useState<string[]>(chars)
  const [locked, setLocked] = useState(chars.length)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!start || doneRef.current) return
    doneRef.current = true
    if (prefersReducedMotion()) {
      onDone?.()
      return
    }
    let raf = 0
    let t0 = 0
    let lastChurn = 0
    const tick = (t: number) => {
      if (!t0) t0 = t
      const el = t - t0 - delay
      if (el < 0) {
        raf = requestAnimationFrame(tick)
        return
      }
      const lockedNow = Math.min(chars.length, Math.floor(el / lockMs))
      if (t - lastChurn > 45) {
        lastChurn = t
        setCells(
          chars.map((c, i) =>
            i < lockedNow || c === ' '
              ? c
              : FLAP_CHARS[(Math.random() * FLAP_CHARS.length) | 0],
          ),
        )
        setLocked(lockedNow)
      }
      if (lockedNow < chars.length) raf = requestAnimationFrame(tick)
      else {
        setCells(chars)
        setLocked(chars.length)
        onDone?.()
      }
    }
    // Blank the board, then run.
    setCells(chars.map((c) => (c === ' ' ? ' ' : '')))
    setLocked(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start])

  // Cells grouped by WORD, each word an unbreakable run — flex wrapping on
  // bare cells split "CHICKEN S / HAWARMA" across lines mid-word.
  const words: { cellIdx: number[] }[] = []
  {
    let cur: number[] = []
    chars.forEach((c, i) => {
      if (c === ' ') {
        if (cur.length) words.push({ cellIdx: cur })
        cur = []
      } else cur.push(i)
    })
    if (cur.length) words.push({ cellIdx: cur })
  }

  return (
    <span className={className} role="text" aria-label={text}>
      {words.map((wd, w) => (
        <span key={w} className="flap-word" aria-hidden="true">
          {wd.cellIdx.map((i) => (
            <span key={i} className="flap-c" data-locked={i < locked ? 'yes' : 'no'}>
              {cells[i]}
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}

/** The abstract route: our own street-like lines, a You dot, a pin. */
function RouteBoard() {
  return (
    <svg
      className="route-svg"
      viewBox="0 0 400 170"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Street-like background — original abstract lines, deliberately NOT
          a map of anywhere. */}
      <g className="route-streets" stroke="#1d1d1d" strokeWidth="2">
        <path d="M-10 128 L410 96" />
        <path d="M-10 58 L410 84" />
        <path d="M96 -10 L122 180" />
        <path d="M236 -10 L212 180" />
        <path d="M318 -10 L352 180" />
        <path d="M-10 22 L410 10" />
      </g>
      {/* The route itself: drawn by stroke-dashoffset when the stage lands. */}
      <path
        className="route-path"
        d="M52 138 L150 120 L176 76 L296 56 L330 40"
        stroke="#FE0000"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
      />
      {/* You */}
      <circle className="route-you" cx="52" cy="138" r="5" fill="#F2EDE8" />
      <text className="route-label" x="52" y="158" textAnchor="middle">
        You
      </text>
      {/* Destination pin + the one red pulse on arrival */}
      <g className="route-dest">
        <circle className="route-pulse" cx="330" cy="40" r="7" />
        <circle cx="330" cy="40" r="7" fill="#FE0000" />
        <circle cx="330" cy="40" r="2.6" fill="#080808" />
      </g>
    </svg>
  )
}

const TILES = [
  { label: 'Directions', Icon: Navigation, kind: 'dir' },
  { label: 'Call', Icon: Phone, kind: 'call' },
  { label: 'Order', Icon: ShoppingBag, kind: 'order' },
] as const

function ActionTile({
  label,
  Icon,
  kind,
}: {
  label: string
  Icon: typeof Navigation
  kind: string
}) {
  // Keyed remount replays the icon's signature move + the ring on every tap.
  const [pulse, setPulse] = useState(0)
  return (
    <button
      type="button"
      className="act-tile"
      aria-label={`${label} — demo only`}
      onClick={() => setPulse((n) => n + 1)}
    >
      {pulse > 0 ? <span key={`r${pulse}`} className="act-ring" aria-hidden="true" /> : null}
      <span key={`i${pulse}`} className={`act-ico act-ico-${kind}`} aria-hidden="true">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span>{label}</span>
    </button>
  )
}

export default function DecideAct() {
  const ref = useRef<HTMLElement | null>(null)
  const [stage, setStage] = useState<Stage>('wait')
  const timers = useRef<number[]>([])

  const advance = (s: Stage, ms: number) =>
    timers.current.push(window.setTimeout(() => setStage(s), ms))

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setStage('tiles')
      return
    }
    const io = new IntersectionObserver(
      (e) => {
        if (!e[0]?.isIntersecting) return
        io.disconnect()
        if (prefersReducedMotion()) {
          setStage('tiles')
          return
        }
        setStage('board')
        // The board's own timings: meta (~0.6s) then name (~1.5s), so the
        // route starts as the last letters land, and the tiles follow the
        // draw (900ms) + the pin's pulse.
        advance('route', 2050)
        advance('tiles', 3150)
      },
      { rootMargin: '-15% 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      for (const t of timers.current) window.clearTimeout(t)
    }
  }, [])

  const rank = STAGE_RANK[stage]
  const flapping = stage !== 'wait'

  return (
    <section ref={ref} className="act-section" data-stage={stage}>
      <div className="act-stage">
        <p className="act-eyebrow">You&apos;re going to</p>

        <FlapLine text={META} start={flapping} lockMs={32} className="act-meta-board" />
        <FlapLine
          text={NAME}
          start={flapping}
          lockMs={80}
          delay={550}
          className="act-name-board"
        />

        <RouteBoard />

        <div className="act-tiles" data-shown={rank >= 3 ? 'yes' : 'no'}>
          {TILES.map((t, i) => (
            <div key={t.label} className="act-tile-slot" style={{ ['--d' as string]: `${i * 90}ms` }}>
              <ActionTile label={t.label} Icon={t.Icon} kind={t.kind} />
            </div>
          ))}
        </div>

        <p className="act-sub">
          Decided, saved, and on your way. The whole thing took three taps.
        </p>
      </div>
    </section>
  )
}
