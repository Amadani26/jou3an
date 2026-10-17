import { useMemo, useRef } from 'react'
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import WaitlistCount from '../WaitlistCount'
import PhoneScreenLive from './PhoneScreenLive'
import DeviceGL from './DeviceGL'
import { scrollToWaitlist } from '../../lib/scroll'
import { DISHES, SURVIVOR_INDEXES, SURVIVOR_REASONS } from '../../lib/dishes'
import type { HeroVariant } from '../../lib/variants'

/**
 * The hero: copy, the device, and the handoff.
 *
 * ALIVE FROM FIRST PAINT. The device is a CSS composition (body, bevel, red
 * rim, sheen, contact shadow, float) around a LIVE HTML screen that plays the
 * app's core flow on a loop — none of it waits for WebGL, a chunk, or a
 * gesture. ?hero=1 layers a worker-rendered WebGL body on top (real metal,
 * moving light) that fades in when its first frame lands; ?hero=2 stays pure
 * CSS. Nothing is draggable and nothing orbits: the motion is scripted —
 * a slow float, a fixed cinematic tilt, light doing the living.
 *
 * THE HANDOFF. As you start scrolling, the three result cards lift off the
 * glass into the page in 3D and lead into the problem section. The lift is a
 * RATCHET: it plays once, forward — scrolling back up does not re-dock the
 * cards, per the play-once rule for every scroll-scrubbed sequence.
 *
 * Reduced motion: static final frame — screen on its selected state, float
 * and sheen off, cards docked.
 */

function canWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const LIFTS = [
  // fy on card 1 kept modest so it never climbs into the nav wordmark.
  { fx: -0.92, fy: -0.38, rot: -14, top: '36%' },
  { fx: 0.98, fy: -0.06, rot: 15, top: '52%' },
  { fx: -0.78, fy: 0.4, rot: -11, top: '68%' },
] as const

function LiftCard({ lift, index }: { lift: MotionValue<number>; index: number }) {
  const cfg = LIFTS[index]
  const d = DISHES[SURVIVOR_INDEXES[index]]
  const x = useTransform(lift, (v) => `calc(min(30vw, 330px) * ${(cfg.fx * v).toFixed(4)})`)
  const y = useTransform(lift, (v) => `calc(min(20vh, 210px) * ${(cfg.fy * v).toFixed(4)})`)
  const rotateY = useTransform(lift, (v) => cfg.rot * v)
  const scale = useTransform(lift, (v) => 0.9 + 0.22 * v)
  const opacity = useTransform(lift, [0, 0.1, 1], [0, 1, 1])

  return (
    <div className="lift-slot" style={{ top: cfg.top }}>
      <motion.div
        className="lift-move"
        style={{ x, y, rotateY, scale, opacity, transformPerspective: 900 }}
      >
        <article className="fcard lift-fc">
          <span className="fcard-rank">{index + 1}</span>
          <div className="fcard-body">
            <h3 className="fcard-name">{d.dish}</h3>
            <p className="fcard-meta">
              {d.cuisine} · {d.area} · {d.price}
            </p>
            <span className="fcard-reason">{SURVIVOR_REASONS[index]}</span>
          </div>
          <span className="fcard-score">{d.score.toFixed(1)}</span>
        </article>
      </motion.div>
    </div>
  )
}

export default function HeroLive({ variant }: { variant: HeroVariant }) {
  const ref = useRef<HTMLElement | null>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })

  // ⚠️ PLAY ONCE: the lift only ever moves forward. Scrolling back up leaves
  // the cards where the story put them.
  const ratchet = useMotionValue(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (v > ratchet.get()) ratchet.set(v)
  })
  const lift = useTransform(ratchet, [0.03, 0.5], [0, 1], { clamp: true })

  const gl = useMemo(
    () =>
      variant === '1' &&
      !reduce &&
      typeof window !== 'undefined' &&
      (navigator.hardwareConcurrency || 8) > 3 &&
      canWebGL(),
    [variant, reduce],
  )

  return (
    <section
      ref={ref}
      className="hero-bleed hero-live relative min-h-[100svh] overflow-hidden flex flex-col"
    >
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

      <div className="hero-live-stage">
        <div className="dev-wrap">
          <div className="dev-float">
            <div className="dev-tilt">
              <div className="dev-stage">
                <span className="dev-body" aria-hidden="true" />
                {gl ? <DeviceGL /> : null}
                <div className="dev-face">
                  <PhoneScreenLive />
                  <span className="dev-sheen" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
          <span className="dev-shadow" aria-hidden="true" />
        </div>

        {reduce ? null : (
          <div className="lift-layer" aria-hidden="true">
            {LIFTS.map((_, i) => (
              <LiftCard key={i} lift={lift} index={i} />
            ))}
          </div>
        )}
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
