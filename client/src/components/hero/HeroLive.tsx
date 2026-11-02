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
 *   orbit  3.5–5.2 the cards make one revolution around the phone in 3D —
 *                  scaled down and dimmed while behind
 *   return 5.2–6.4 each card flies BACK INTO THE GLASS, shrinking onto the
 *                  rect of its own result row (measured live, the shared-
 *                  element handoff) while the screen's rows spring in under
 *                  them on the same stagger
 *   settle         just the device, scaled up a touch, results readable —
 *                  the cards never duplicate the screen they came from
 *
 * ONE rAF timeline drives the card transforms (transform/opacity/z-index
 * only); the stage attribute (`data-seq`) lets CSS run the cheap parts
 * (video fade, screen glow, under-glows, the final device scale-up). Plays
 * ONCE per visit — a module flag — and scrolling back never replays it.
 * The final frame is the device alone, so it fits one viewport below the
 * nav at every phone width by construction.
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
const T_RETURN = 5200
const T_END = 6400
const DEAL_STAGGER = 120
const DEAL_DUR = 560
const FLIP_STAGGER = 200
const FLIP_DUR = 460
/** ⚠️ 130ms matches the .ps-card results-transition stagger (sections.css),
    so each flying card and the row it becomes move on the same beat. */
const RETURN_STAGGER = 130
const RETURN_DUR = 650
/** How long the trigger waits for the clip before playing without it. */
const VIDEO_GRACE_MS = 900

/* ---- the ring geometry (fractions of the device width) ----
   The ring may sweep past a phone viewport's edges mid-orbit — transient
   and deliberate. Nothing settles OUT here any more: the return targets
   are the screen's own result-row rects, measured when the return begins. */
const THETA = [90, 210, 330] // ring angles, degrees; 90° = front centre
const ORBIT_RX = { mobile: 0.55, desktop: 1.28 }
const ORBIT_Y = { mobile: [0.45, -0.35, 0.25], desktop: [0.66, -0.08, 0.16] }

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3
const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

type Stage = 'idle' | 'in' | 'deal' | 'flip' | 'orbit' | 'return' | 'settled'
const stageAt = (t: number): Stage =>
  t < T_DEAL
    ? 'in'
    : t < T_FLIP
      ? 'deal'
      : t < T_ORBIT
        ? 'flip'
        : t < T_RETURN
          ? 'orbit'
          : t < T_END
            ? 'return'
            : 'settled'

export default function HeroLive() {
  const ref = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const devRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef(0)
  const startedRef = useRef(seqPlayed)

  const [reduce] = useState(prefersReducedMotion)
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

    const slots = slotRefs.current
    const movers = slots.map((s) => s?.querySelector<HTMLElement>('.seq-move') ?? null)
    const cards = slots.map((s) => s?.querySelector<HTMLElement>('.seq-card3d') ?? null)

    /* The shared-element targets: each card's own result row on the glass,
       measured the moment the return begins (the rows are laid out while
       still invisible). The hidden row carries a +4.5cqh pre-spring offset
       (sections.css) — subtracted so cards land on the FINAL row positions
       the spring is heading for. */
    let targets: { x: number; y: number; s: number }[] | null = null
    const measureTargets = () => {
      const stageRect = stageEl.getBoundingClientRect()
      const faceH =
        stageEl.querySelector('.dev-face')?.getBoundingClientRect().height ?? 0
      const rows = stageEl.querySelectorAll<HTMLElement>('.pscreen .ps-card')
      targets = [0, 1, 2].map((i) => {
        const r = rows[i]?.getBoundingClientRect()
        const cw = movers[i]?.querySelector<HTMLElement>('.seq-fc')?.offsetWidth || 1
        if (!r) return { x: 0, y: -pw * 0.1, s: 0.32 }
        return {
          x: r.left + r.width / 2 - (stageRect.left + stageRect.width / 2),
          y: r.top + r.height / 2 - (stageRect.top + stageRect.height / 2) - faceH * 0.045,
          s: Math.max(0.2, r.width / cw),
        }
      })
    }

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
        if (st === 'return') {
          // Measure BEFORE the rows start springing in, then release them.
          measureTargets()
          setHold('results')
        }
        if (st === 'settled') {
          const v = videoRef.current
          if (v && !v.paused) v.pause()
        }
      }
      if (t >= T_RETURN && !targets) measureTargets()

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

        /* the ring: one full revolution, easing out as it comes home */
        const orbP = easeInOutCubic(clamp01((t - T_ORBIT) / (T_RETURN - T_ORBIT)))
        const ang = ((THETA[i] + 360 * orbP) * Math.PI) / 180
        const sinA = Math.sin(ang)
        const d = (sinA + 1) / 2
        let x = rx * Math.cos(ang)
        let y = ys[i]
        let s = 0.78 + 0.27 * d
        let op = 0.55 + 0.45 * d
        let z = sinA

        /* deal: from the centre of the glass to the ring's start pose */
        const dealP = easeOutCubic(clamp01((t - T_DEAL - i * DEAL_STAGGER) / DEAL_DUR))
        x *= dealP
        y = -pw * 0.1 + (y + pw * 0.1) * dealP
        s = 0.32 + (s - 0.32) * dealP
        let o = Math.min(1, dealP * 2.4) * op

        /* return: fly back into the glass onto this card's own result row,
           crossing to the front layer early, fading out on arrival as the
           real row springs in underneath. */
        const retP = easeInOutCubic(
          clamp01((t - T_RETURN - i * RETURN_STAGGER) / RETURN_DUR),
        )
        if (retP > 0 && targets) {
          const tg = targets[i]
          x += (tg.x - x) * retP
          y += (tg.y - y) * retP
          s += (tg.s - s) * retP
          z += (1 - z) * Math.min(1, retP / 0.4)
          const fade = clamp01((retP - 0.72) / 0.28)
          o = (o + (1 - o) * retP) * (1 - fade)
        }

        move.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`
        move.style.opacity = o.toFixed(3)
        card.style.transform = `perspective(800px) rotateY(${rot.toFixed(1)}deg)`
        slot.style.zIndex = String(50 + Math.round(z * 12) + (z >= 0 ? 2 : -2))
      }

      /* the device turns a little with the orbit, home before the return */
      const orbP = clamp01((t - T_ORBIT) / (T_RETURN - T_ORBIT))
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
