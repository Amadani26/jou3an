import { useEffect, useRef, useState } from 'react'
import { MapPin, Navigation, Phone, ShoppingBag } from 'lucide-react'
import { DISHES, SURVIVOR_INDEXES } from '../lib/dishes'
import { prefersReducedMotion } from '../lib/reveal'

/**
 * DECIDE → ACT — the mini story of what happens after you pick.
 *
 *   1. CARD   the chosen result, large: licensed dish photo, name,
 *             cuisine · area · price, and the three action buttons.
 *   2. TAP    a simulated tap lands on Directions — a ripple blooms on the
 *             button — and the card MORPHS into the map: the photo scales
 *             and fades away inside the same panel while the map scales in
 *             beneath it (one shared element, so the photo visibly BECOMES
 *             the map), and the card chrome slides out.
 *   3. MAP    an ORIGINAL stylised map — our own SVG: dark blocks, a few
 *             street lines, nothing traced from any real place, no tiles,
 *             no provider imagery. The route draws itself from a "You" dot
 *             to the destination pin, the pin pulses red once, and a small
 *             arrival chip slides in.
 *
 * ⚠️ PLAY ONCE: one once-and-disconnect IntersectionObserver starts the
 * story; stages only move forward, so scrolling away and back finds the
 * final map state. All hidden/waiting states are gated under `html.js`, and
 * the DEFAULT (no JS, prerender, reduced motion) is the finished map —
 * paint-first content everywhere.
 *
 * Everything animates with transforms, opacity and SVG stroke-dashoffset;
 * the panel has a fixed aspect ratio so no stage change moves layout
 * (CLS 0 by construction).
 */

const PICK = DISHES[SURVIVOR_INDEXES[0]]

type Stage = 'wait' | 'card' | 'tap' | 'map' | 'arrived'
const ORDER: Stage[] = ['wait', 'card', 'tap', 'map', 'arrived']

const TILES = [
  { label: 'Directions', Icon: Navigation, kind: 'dir' },
  { label: 'Call', Icon: Phone, kind: 'call' },
  { label: 'Order', Icon: ShoppingBag, kind: 'order' },
] as const

/** Our own abstract neighbourhood: blocks, streets, a route, a pin. */
function StylisedMap() {
  return (
    <svg
      className="story-map"
      viewBox="0 0 440 300"
      fill="none"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* City blocks — plain rounded rectangles, an invented layout. */}
      <g fill="#111111" stroke="#1e1e1e" strokeWidth="1.5">
        <rect x="18" y="22" width="96" height="70" rx="6" />
        <rect x="134" y="16" width="120" height="58" rx="6" />
        <rect x="274" y="30" width="80" height="84" rx="6" />
        <rect x="26" y="116" width="78" height="92" rx="6" />
        <rect x="124" y="96" width="92" height="74" rx="6" />
        <rect x="238" y="136" width="108" height="64" rx="6" />
        <rect x="42" y="230" width="120" height="58" rx="6" />
        <rect x="186" y="192" width="74" height="96" rx="6" />
        <rect x="372" y="60" width="60" height="120" rx="6" />
        <rect x="286" y="222" width="130" height="66" rx="6" />
      </g>
      {/* Streets between the blocks. */}
      <g stroke="#262626" strokeWidth="3" strokeLinecap="round">
        <path d="M0 102 H440" />
        <path d="M0 212 H440" />
        <path d="M116 0 V300" />
        <path d="M226 0 V300" />
        <path d="M362 0 V300" />
      </g>
      {/* The route: along the streets, You -> destination. */}
      <path
        className="story-route"
        d="M62 272 H116 V212 H226 V102 H322"
        stroke="#FE0000"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
      />
      {/* You */}
      <circle cx="62" cy="272" r="6" fill="#F2EDE8" />
      <text className="story-you" x="62" y="256" textAnchor="middle">
        You
      </text>
      {/* Destination pin + one red pulse on arrival */}
      <g className="story-dest">
        <circle className="story-pulse" cx="322" cy="102" r="9" />
        <circle cx="322" cy="102" r="9" fill="#FE0000" />
        <circle cx="322" cy="102" r="3.4" fill="#0a0a0a" />
      </g>
    </svg>
  )
}

export default function DecideAct() {
  const ref = useRef<HTMLElement | null>(null)
  const [stage, setStage] = useState<Stage>('wait')
  const timers = useRef<number[]>([])

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
        const at = (s: Stage, ms: number) =>
          timers.current.push(window.setTimeout(() => setStage(s), ms))
        setStage('card')
        at('tap', 1500) // read the card, then the tap lands
        at('map', 2150) // ripple finishes, the morph begins
        at('arrived', 3400) // route drawn, pin pulsed, chip in
      },
      { rootMargin: '-15% 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      for (const t of timers.current) window.clearTimeout(t)
    }
  }, [])

  const rank = ORDER.indexOf(stage)

  return (
    <section ref={ref} className="act-section" data-stage={stage}>
      <div className="act-stage">
        <p className="act-eyebrow">You&apos;re going to</p>
        <h2 className="story-name">{PICK.dish}</h2>

        {/* THE PANEL — one shared element for the whole story. */}
        <div className="story-panel">
          {/* The map lives underneath from the start; the photo above it is
              what morphs away, so the photo visibly becomes the map. */}
          <div className="story-maplayer">
            <StylisedMap />
            <span className="story-chip" role="status">
              <MapPin size={13} strokeWidth={2.2} aria-hidden="true" />
              On your way
            </span>
          </div>

          <div className="story-cardlayer" aria-hidden={rank >= 3}>
            {PICK.photo ? (
              <img
                src={`/brand/dishes/${PICK.photo}.webp`}
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
                {PICK.cuisine} · {PICK.area} · {PICK.price}
                <span className="story-score">{PICK.score.toFixed(1)}</span>
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

        <p className="act-sub">
          Three taps, start to table.
        </p>
      </div>
    </section>
  )
}
