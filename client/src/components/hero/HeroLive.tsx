import { useCallback, useEffect, useRef, useState } from 'react'
import WaitlistCount from '../WaitlistCount'
import PhoneScreenLive, { type Phase } from './PhoneScreenLive'
import { scrollToWaitlist } from '../../lib/scroll'
import { DISHES, SURVIVOR_INDEXES, SURVIVOR_REASONS } from '../../lib/dishes'
import { prefersReducedMotion } from '../../lib/reveal'

/**
 * The hero: copy, the CSS device, and THE SEQUENCE — a 6s one-shot story
 * that replaces the old card fan:
 *
 *   in     0–1.5s  the Higgsfield streak clip floods toward the phone, the
 *                  screen says "Deciding…" and its glow brightens
 *   deal   1.5–2.5 three cards slide out of the glass FACE-DOWN (black back,
 *                  red 3), 120ms stagger, landing around the device
 *   flip   2.5–3.5 each card flips face-up (rotateY under perspective),
 *                  a red under-glow lighting as it reveals
 *   orbit  3.5–6s  the cards orbit the phone in 3D — scaled down and dimmed
 *                  while behind — easing out into the settled arrangement:
 *                  #1 largest in front, #2/#3 smaller beside/behind
 *
 * ONE rAF timeline drives the card transforms (transform/opacity/z-index
 * only); the stage attribute (`data-seq`) lets CSS run the cheap parts
 * (video fade, screen glow, under-glows). Plays ONCE per visit — a module
 * flag — and scrolling back never replays it. Desktop gets a whisper of
 * idle drift after settling; phones hold still.
 *
 * GEOMETRY: everything is a fraction of the device width (--pw in CSS, the
 * measured dev-wrap width in JS), so the JS timeline's final frame and the
 * CSS static pose (reduced motion / no-JS) are the same arithmetic.
 *
 * The clip never gates anything: it loads after the page is interactive,
 * waits at most VIDEO_GRACE_MS at trigger time, and an autoplay rejection
 * (iOS Low Power Mode) falls back to a pure CSS bloom behind the device.
 *
 * ?debug=1 renders a diagnostic overlay: stage, video state, reduced-motion
 * detection, and a live fps meter.
 */

/** Play-once per visit. Module scope: survives re-renders, dies on reload. */
let seqPlayed = false

const DESKTOP_MQ = '(min-width: 768px)'

/* ---- the timeline (ms) ---- */
const T_DEAL = 1500
const T_FLIP = 2500
const T_ORBIT = 3500
const T_END = 6000
const DEAL_STAGGER = 120
const DEAL_DUR = 560
const FLIP_STAGGER = 200
const FLIP_DUR = 460
/** How long the trigger waits for the clip before playing without it. */
const VIDEO_GRACE_MS = 900

/* ---- the shared geometry (fractions of the device width) ----
   ⚠️ The SETTLE_* targets are mirrored by the .seq-slot CSS vars in
   sections.css (the static pose) — change both together.

   The orbit and the settle are DECOUPLED: the orbit sweeps a wide ring
   (even past the viewport edge on a phone — transient), then the last
   700ms lerps each card from its ring pose to an explicit settle target.
   On a 393 viewport there is no "beside the phone", so the mobile settle
   is a diagonal — #2 peeking above-left, #1 front over the lower glass,
   #3 below-right — keeping every name fully visible. */
const THETA = [90, 210, 330] // ring angles, degrees; 90° = front centre
const ORBIT_RX = { mobile: 0.55, desktop: 1.28 }
const ORBIT_Y = { mobile: [0.45, -0.35, 0.25], desktop: [0.66, -0.08, 0.16] }
const SETTLE_X = { mobile: [0, -0.3, 0.26], desktop: [0, -1.11, 1.11] }
const SETTLE_Y = { mobile: [0.6, -1.18, 1.18], desktop: [0.66, -0.08, 0.16] }
const SETTLE_SCALE = { mobile: [1.04, 0.84, 0.84], desktop: [1.04, 0.86, 0.86] }
const SETTLE_OPACITY = { mobile: [1, 0.92, 0.92], desktop: [1, 0.88, 0.88] }
/** When the ring → settle-target lerp begins. */
const T_SETTLE_BLEND = 5300

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3
const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

type Stage = 'idle' | 'in' | 'deal' | 'flip' | 'orbit' | 'settled'
const stageAt = (t: number): Stage =>
  t < T_DEAL ? 'in' : t < T_FLIP ? 'deal' : t < T_ORBIT ? 'flip' : t < T_END ? 'orbit' : 'settled'

export default function HeroLive() {
  const ref = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const devRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef(0)
  const startedRef = useRef(seqPlayed)

  const [reduce] = useState(prefersReducedMotion)
  /** Mounted with the story already told (remount after play): static pose. */
  const [mountedSettled] = useState(seqPlayed)
  const [stage, setStage] = useState<Stage>(() => (reduce || seqPlayed ? 'settled' : 'idle'))
  const [hold, setHold] = useState<Phase>(() => (reduce || seqPlayed ? 'results' : 'idle'))
  const [videoState, setVideoState] = useState<'cold' | 'arming' | 'ready' | 'off'>('cold')
  const videoStateRef = useRef(videoState)
  useEffect(() => {
    videoStateRef.current = videoState
  }, [videoState])

  /* ---- the timeline ---- */
  const run = useCallback(() => {
    const stageEl = stageRef.current
    const dev = devRef.current
    const section = ref.current
    if (!stageEl || !dev || !section) return

    const pw = dev.getBoundingClientRect().width || 240
    const bp = window.matchMedia(DESKTOP_MQ).matches ? 'desktop' : 'mobile'
    const rx = pw * ORBIT_RX[bp]
    const ys = ORBIT_Y[bp].map((f) => f * pw)
    const sx = SETTLE_X[bp].map((f) => f * pw)
    const sy = SETTLE_Y[bp].map((f) => f * pw)
    const ss = SETTLE_SCALE[bp]
    const so = SETTLE_OPACITY[bp]
    const dSettle = THETA.map((a) => (Math.sin((a * Math.PI) / 180) + 1) / 2)

    const slots = slotRefs.current
    const movers = slots.map((s) => s?.querySelector<HTMLElement>('.seq-move') ?? null)
    const cards = slots.map((s) => s?.querySelector<HTMLElement>('.seq-card3d') ?? null)

    let shownStage: Stage = 'idle'
    const lit = [false, false, false]
    const t0 = performance.now()

    const frame = (now: number) => {
      const t = now - t0
      const st = stageAt(t)
      if (st !== shownStage) {
        shownStage = st
        stageEl.dataset.seq = st
        setStage(st)
        if (st === 'deal') setHold('results')
        if (st === 'settled') {
          const v = videoRef.current
          if (v && !v.paused) v.pause()
        }
      }

      for (let i = 0; i < 3; i++) {
        const slot = slots[i]
        const move = movers[i]
        const card = cards[i]
        if (!slot || !move || !card) continue

        /* flip angle: 180 (face-down) until this card's flip window */
        const flipP = clamp01((t - T_FLIP - i * FLIP_STAGGER) / FLIP_DUR)
        const rot = 180 + 180 * easeInOutCubic(flipP)
        if (flipP > 0 && !lit[i]) {
          lit[i] = true
          slot.dataset.lit = 'yes'
        }

        /* the ring: a full revolution, easing out as it comes home */
        const orbP = easeInOutCubic(clamp01((t - T_ORBIT) / (T_END - T_ORBIT)))
        const ang = ((THETA[i] + 360 * orbP) * Math.PI) / 180
        const d = (Math.sin(ang) + 1) / 2
        const ringX = rx * Math.cos(ang)
        const ringS = (ss[i] * (0.8 + 0.2 * d)) / (0.8 + 0.2 * dSettle[i])
        const ringO = Math.min(1, (so[i] * (0.6 + 0.4 * d)) / (0.6 + 0.4 * dSettle[i]))

        /* ring → settle target, over the last stretch of the revolution */
        const blend = easeInOutCubic(clamp01((t - T_SETTLE_BLEND) / (T_END - T_SETTLE_BLEND)))
        const targetX = ringX + (sx[i] - ringX) * blend
        const targetY = ys[i] + (sy[i] - ys[i]) * blend
        const scale = ringS + (ss[i] - ringS) * blend
        const op = ringO + (so[i] - ringO) * blend

        /* deal: from the centre of the glass to the ring's start pose */
        const dealP = easeOutCubic(clamp01((t - T_DEAL - i * DEAL_STAGGER) / DEAL_DUR))
        const x = targetX * dealP
        const y = -pw * 0.1 + (targetY + pw * 0.1) * dealP
        const s = 0.32 + (scale - 0.32) * dealP
        const o = Math.min(1, dealP * 2.4) * op

        move.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`
        move.style.opacity = o.toFixed(3)
        card.style.transform = `perspective(800px) rotateY(${rot.toFixed(1)}deg)`
        slot.style.zIndex = String(50 + Math.round(Math.sin(ang) * 12) + (Math.sin(ang) >= 0 ? 2 : -2))
      }

      /* the device turns a little with the orbit, returning home at the end */
      const orbP = clamp01((t - T_ORBIT) / (T_END - T_ORBIT))
      section.style.setProperty(
        '--seq-turn',
        `${(6 * Math.sin(easeInOutCubic(orbP) * Math.PI * 2)).toFixed(2)}deg`,
      )

      if (t < T_END) rafRef.current = requestAnimationFrame(frame)
      else section.style.setProperty('--seq-turn', '0deg')
    }
    rafRef.current = requestAnimationFrame(frame)
  }, [])

  const start = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    seqPlayed = true
    const v = videoRef.current
    if (v && videoStateRef.current !== 'off') {
      v.play().catch(() => setVideoState('off'))
    }
    setHold('deciding')
    run()
  }, [run])

  /* Arm the clip only once the page is interactive — it must never compete
     with the LCP — then trigger the sequence when the device is in view. */
  useEffect(() => {
    if (reduce || startedRef.current) return
    const dev = devRef.current
    if (!dev) return

    const arm = () => {
      setVideoState((s) => (s === 'cold' ? 'arming' : s))
      const v = videoRef.current
      if (!v) return
      const ready = () => setVideoState((s) => (s === 'off' ? s : 'ready'))
      v.addEventListener('canplaythrough', ready, { once: true })
      v.addEventListener('error', () => setVideoState('off'), { once: true })
      v.load()
    }
    if (document.readyState === 'complete') arm()
    else window.addEventListener('load', arm, { once: true })

    let graceTimer = 0
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || startedRef.current) return
        io.disconnect()
        // The clip gets a short grace to finish buffering; the story never
        // waits longer than that for it.
        if (videoStateRef.current === 'ready' || videoStateRef.current === 'off') start()
        else {
          const v = videoRef.current
          const go = () => {
            window.clearTimeout(graceTimer)
            start()
          }
          v?.addEventListener('canplaythrough', go, { once: true })
          graceTimer = window.setTimeout(go, VIDEO_GRACE_MS)
        }
      },
      { threshold: 0.55 },
    )
    io.observe(dev)
    return () => {
      io.disconnect()
      window.clearTimeout(graceTimer)
      window.removeEventListener('load', arm)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [reduce, start])

  // The mobile entrance ratchet + scroll-cue fade (unchanged from the fan
  // era): one rAF scroll listener writing --enter. The sequence itself is
  // IO-triggered and play-once, so scroll position never replays anything.
  useEffect(() => {
    const section = ref.current
    if (!section || prefersReducedMotion()) return
    let frame = 0
    const apply = () => {
      frame = 0
      const p = window.scrollY / Math.max(1, section.offsetHeight)
      section.style.setProperty('--enter', Math.min(1, Math.max(0, p / 0.4)).toFixed(4))
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(apply)
    }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const staticPose = reduce || mountedSettled

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
          <b>A food decision engine for Dubai.</b> Exactly 3 places — no menus,
          no scrolling, just a decision.
        </p>

        {/* Phone widths only (CSS): the first frame is copy alone, so the cue
            is what says the story continues below. Fades as the device beat
            approaches; hidden whenever --enter stays at its no-JS default. */}
        <div className="hero-scrollcue" aria-hidden="true">
          <span>Scroll</span>
          <i />
        </div>
      </div>

      <div
        ref={stageRef}
        className="hero-live-stage"
        data-seq={stage}
        data-static={staticPose ? 'yes' : 'no'}
        data-video={videoState}
      >
        {/* The Higgsfield streak clip — behind the device, edge-masked, only
            audible to the eye during the 'in' beat. Sources: AV1 → HEVC →
            H.264; poster is a dark frame so a slow decode shows nothing odd.
            Reduced motion never mounts it (CSS glow carries the beat). */}
        {reduce ? null : (
          <div className="seq-video" aria-hidden="true">
            <video
              ref={videoRef}
              muted
              playsInline
              preload="none"
              poster="/hero/streaks-poster.jpg"
              disablePictureInPicture
            >
              <source src="/hero/streaks-av1.mp4" type='video/mp4; codecs="av01.0.04M.08"' />
              <source src="/hero/streaks-hevc.mp4" type='video/mp4; codecs="hvc1.1.6.L90.B0"' />
              <source src="/hero/streaks-h264.mp4" type='video/mp4; codecs="avc1.64001f"' />
            </video>
          </div>
        )}
        {/* CSS stand-in for the clip when autoplay is refused (Low Power
            Mode) or the sources fail: a red bloom swelling behind the glass. */}
        <span className="seq-bloom" aria-hidden="true" />

        <div ref={devRef} className="dev-wrap">
          <div className="dev-float">
            <div className="dev-tilt">
              <div className="dev-stage">
                <span className="dev-body" aria-hidden="true" />
                <div className="dev-face">
                  <PhoneScreenLive holdAt={hold} />
                  <span className="dev-glowup" aria-hidden="true" />
                  <span className="dev-sheen" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
          <span className="dev-shadow" aria-hidden="true" />
        </div>

        <div className="seq-layer" aria-hidden="true">
          {SURVIVOR_INDEXES.map((di, i) => {
            const d = DISHES[di]
            return (
              <div
                key={di}
                ref={(el) => {
                  slotRefs.current[i] = el
                }}
                className={`seq-slot seq-slot-${i + 1}`}
              >
                <div className="seq-move">
                  <span className="seq-glow" />
                  <div className="seq-card3d">
                    <article className="seq-fc">
                      <header className="seq-fc-top">
                        <span className="seq-rank">{i + 1}</span>
                        <span className="seq-score">{d.score.toFixed(1)}</span>
                      </header>
                      <h3 className="seq-name">{d.dish}</h3>
                      <p className="seq-meta">
                        {d.cuisine} · {d.area} · {d.price}
                      </p>
                      <span className="seq-reason">{SURVIVOR_REASONS[i]}</span>
                    </article>
                    <div className="seq-back">
                      <span>3</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="product-cta">
        <button type="button" onClick={scrollToWaitlist} className="hero-cta">
          Join the waitlist
        </button>
        <WaitlistCount className="hero-count" />
      </div>

      <HeroDebug stage={stage} video={videoState} />
    </section>
  )
}

/**
 * ?debug=1 — the on-device diagnostic: sequence stage, video state,
 * reduced-motion detection, and a live fps meter. Renders nothing without
 * the flag.
 */
function HeroDebug({ stage, video }: { stage: Stage; video: string }) {
  const [enabled] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1',
  )
  const [fps, setFps] = useState(0)
  const [rm, setRM] = useState(false)

  useEffect(() => {
    if (!enabled) return
    setRM(prefersReducedMotion())
    let frames = 0
    let last = performance.now()
    let raf = 0
    const tick = (t: number) => {
      frames++
      if (t - last >= 1000) {
        setFps(Math.round((frames * 1000) / (t - last)))
        frames = 0
        last = t
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled])

  if (!enabled) return null
  return (
    <div className="hero-debug" role="status">
      <span>seq: {stage}</span>
      <span>video: {video}</span>
      <span>reduced-motion: {String(rm)}</span>
      <span>fps: {fps}</span>
    </div>
  )
}
