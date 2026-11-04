/**
 * The persistent WebGL layer of the journey — chapters 1→5.
 *
 * ONE canvas fixed behind the HTML layer, driven by one scroll-progress
 * number in a ref (ScrollTrigger scrub → ref → useFrame). No React state
 * on the scroll path. Chapter boundaries come from timeline.ts — the HTML
 * layer sizes its sections from the same module.
 *
 *   ch1  darkness; the lacquer "3" ignites (scrubbed)
 *   ch2  camera flies a tunnel of real restaurant cards (scrubbed)
 *   ch3  tunnel collapses into the 3 (scrubbed) + light burst (ONE-SHOT,
 *        time-based — fired crossing BURST_AT, re-armed by scrolling back)
 *   ch4  the 3 steps up and back while the DOM options field takes the
 *        stage — the field, the filters and the answer cards are ALL HTML
 *        now (crisp at device DPR; nothing readable lives in the canvas)
 *   ch5  one card swipes away (HTML/CSS, one-shot); the lacquer itself
 *        shifts hue/glow as "taste" builds (see looks.ts)
 *
 * Material: the chosen red lacquer (looks.ts). Studio lighting generated
 * in code (drei Lightformers, no HDR to licence). Post: high-threshold
 * Bloom (selective in effect in a black scene), SMAA, vignette, grain on
 * desktop only. DPR 1.5 phone / 2 desktop.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette, SMAA } from '@react-three/postprocessing'
import { buildGlyphGeometry } from './glyph3'
import { makeCardTexture } from './cardTexture'
import { lacquerProps, updateLacquer, RED_LIGHT_PEAK } from './looks'
import {
  P1, P2, P3,
  IGNITE_START, IGNITE_DUR,
  COLLAPSE_DUR, BURST_AT, BURST_REARM_BELOW, BURST_SECONDS,
  RECEDE_END, TASTE_START, TASTE_END,
} from './timeline'
import type { LivePick } from '../lib/live'

const CARD_COUNT = 42
const TUNNEL_START = -6
const TUNNEL_STEP = 1.35
const THREE_END_Z = TUNNEL_START - CARD_COUNT * TUNNEL_STEP - 4 // past the last card
const CAM_END_Z = THREE_END_Z + 7.5

/** The 3's base yaw. The committed poster (public/v2/three-poster.webp) is
 *  rendered at exactly this pose with ?freeze3=1, and the live scene STARTS
 *  here — that identity is what makes the poster → WebGL crossfade seamless.
 *  Re-capture the poster if this constant, the material or the studio change. */
const POSTER_ROT_Y = 0.55

/** Poster-capture mode: freezes the clock and pins progress to 0 so the
 *  canvas renders the exact resting pose. Dev-only query flag. */
const FREEZE =
  typeof window !== 'undefined' && window.location.search.includes('freeze3')

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (1 - t) * (1 - t) * 2)
const easeIn = (t: number) => t * t
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Viewport-px → world units on the z-plane the answer cards settle on. */
function worldPerPxAt(dist: number, fovDeg: number, innerH: number): number {
  return (2 * dist * Math.tan((fovDeg * Math.PI) / 360)) / innerH
}

/** Post-runway DOM hooks (ch6 park + ch7 wordmark glide). Filled by
 *  JourneyV2; the scene reads their LIVE rects each frame (throttled), so
 *  the demo changing its own height can never leave stale positions —
 *  and no extra ScrollTriggers exist for the future snapping system to
 *  fight with. */
export interface PostJourneyEls {
  demoEl: HTMLElement | null
  wm3El: HTMLElement | null
  canvasWrapEl: HTMLElement | null
}

/** Per-frame cross-component story state (written by Journey, read by the
 *  atmosphere planes). A plain mutable object — never React state. */
interface Fx {
  ignite: number
  burstEnv: number
  p: number
}

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, 'rgba(254,0,0,0.9)')
  g.addColorStop(0.35, 'rgba(254,0,0,0.35)')
  g.addColorStop(1, 'rgba(254,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

function makeSceneVideo(sources: { src: string; type: string }[]): HTMLVideoElement {
  const v = document.createElement('video')
  v.muted = true
  v.loop = true
  v.playsInline = true
  v.preload = 'none'
  v.crossOrigin = 'anonymous'
  for (const s of sources) {
    const el = document.createElement('source')
    el.src = s.src
    el.type = s.type
    v.appendChild(el)
  }
  return v
}

const EMBERS_SOURCES = [
  { src: '/v2/embers-hevc.mp4', type: 'video/mp4; codecs="hvc1"' },
  { src: '/v2/embers-h264.mp4', type: 'video/mp4' },
]
const BURST_SOURCES = [
  { src: '/v2/burst-hevc.mp4', type: 'video/mp4; codecs="hvc1"' },
  { src: '/v2/burst-h264.mp4', type: 'video/mp4' },
]

/** Licensed Higgsfield atmosphere clips as additive in-scene planes —
 *  embers under ch1's ignition, the radial burst under ch3's one-shot
 *  flash. Playback gated per window; a missing file leaves the plane
 *  black, and additive black is invisible, so nothing depends on them. */
function AtmosphereVideos({ fx }: { fx: Fx }) {
  const embers = useMemo(() => makeSceneVideo(EMBERS_SOURCES), [])
  const burst = useMemo(() => makeSceneVideo(BURST_SOURCES), [])
  const embersTex = useMemo(() => {
    const t = new THREE.VideoTexture(embers)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [embers])
  const burstTex = useMemo(() => {
    const t = new THREE.VideoTexture(burst)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [burst])
  const embersRef = useRef<THREE.Mesh>(null)
  const burstRef = useRef<THREE.Mesh>(null)
  const playing = useRef({ embers: false, burst: false })

  useEffect(() => () => {
    embers.pause()
    burst.pause()
    embersTex.dispose()
    burstTex.dispose()
  }, [embers, burst, embersTex, burstTex])

  useFrame(() => {
    const p = fx.p

    const emberOn = p < P1 + 0.03
    if (emberOn !== playing.current.embers) {
      playing.current.embers = emberOn
      if (emberOn) void embers.play().catch(() => {})
      else embers.pause()
    }
    if (embersRef.current) {
      const m = embersRef.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.5 * fx.ignite * clamp01((P1 + 0.03 - p) / 0.03)
      embersRef.current.visible = m.opacity > 0.01
    }

    const burstOn = fx.burstEnv > 0.02
    if (burstOn !== playing.current.burst) {
      playing.current.burst = burstOn
      if (burstOn) {
        burst.currentTime = 0
        void burst.play().catch(() => {})
      } else burst.pause()
    }
    if (burstRef.current) {
      const m = burstRef.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.38 * fx.burstEnv
      burstRef.current.visible = m.opacity > 0.01
      burstRef.current.position.set(0, 0, THREE_END_Z - 4)
    }
  })

  return (
    <>
      <mesh ref={embersRef} position={[0, 0, -8]} scale={[26, 15, 1]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={embersTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={burstRef} scale={[15, 8.5, 1]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={burstTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </>
  )
}

/** The code-built studio: key softbox, two side strips, a low red rim.
 *  Baked once; the sweep comes from the 3's own rotation. */
function Studio({ isPhone }: { isPhone: boolean }) {
  return (
    <Environment resolution={isPhone ? 128 : 256} frames={1} background={false}>
      <color attach="background" args={['#050505']} />
      <Lightformer form="rect" intensity={6} position={[0, 5, 2]} rotation-x={-Math.PI / 2} scale={[7, 3, 1]} color="#ffffff" />
      <Lightformer form="rect" intensity={2.6} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[5, 1.6, 1]} color="#f5efe8" />
      <Lightformer form="rect" intensity={1.8} position={[5, 2, -1]} rotation-y={-Math.PI / 2} scale={[4, 1.2, 1]} color="#ffffff" />
      <Lightformer form="rect" intensity={2.2} position={[0, -3.5, -3]} rotation-x={Math.PI / 2.4} scale={[8, 1, 1]} color="#FE0000" />
    </Environment>
  )
}

function Journey({
  wall,
  progress,
  post,
  isPhone,
  fx,
  onReady,
}: {
  wall: LivePick[]
  progress: { current: number }
  post: PostJourneyEls
  isPhone: boolean
  fx: Fx
  onReady: () => void
}) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  // Pre-compile every material/shader before the first VISIBLE frame: the
  // canvas mounts at opacity 0, gl.compile walks the scene up front, and a
  // few warm frames run the composer passes; only then onReady fires and
  // the poster crossfades out. No first-scroll shader hitch.
  useEffect(() => {
    try {
      gl.compile(scene, camera)
    } catch {
      /* compile is an optimisation, never a blocker */
    }
  }, [gl, scene, camera])
  const warmFrames = useRef(0)
  const readySent = useRef(false)

  const glyphGeo = useMemo(() => buildGlyphGeometry(), [])
  const glowTex = useMemo(() => makeGlowTexture(), [])
  const wallTextures = useMemo(() => wall.map((p) => makeCardTexture(p)), [wall])

  // Helix of tunnel slots — precomputed once.
  const slots = useMemo(() => {
    const out: { x: number; y: number; z: number; rz: number; tex: number }[] = []
    for (let i = 0; i < CARD_COUNT; i++) {
      const angle = i * 2.39996
      const r = 2.3 + ((i * 7) % 10) / 9
      out.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r * 0.72,
        z: TUNNEL_START - i * TUNNEL_STEP,
        rz: Math.sin(i * 12.9898) * 0.12,
        tex: i % Math.max(1, wall.length),
      })
    }
    return out
  }, [wall.length])

  const threeRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const glowRef = useRef<THREE.Sprite>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const cardRefs = useRef<(THREE.Mesh | null)[]>([])

  // One-shot burst state + measured DOM targets (world units).
  const burstState = useRef({ armed: true, t0: -1 })
  // ch6/ch7: park + wordmark-glide state, driven by live DOM rects.
  const postState = useRef({
    tick: 0,
    park: 0,
    glide: 0,
    frozenRot: null as number | null,
    hidden: false,
    wm: null as { cx: number; cy: number; h: number } | null,
  })

  useFrame((state) => {
    if (document.hidden) return
    const p = FREEZE ? 0 : clamp01(progress.current)
    const t = FREEZE ? 0 : state.clock.elapsedTime
    fx.p = p
    if (!readySent.current && ++warmFrames.current >= 5) {
      readySent.current = true
      onReady()
    }

    // --- chapter scalars ---
    const flight = clamp01((p - P1) / (P2 - P1))
    const ignite = easeInOut(clamp01((p - IGNITE_START) / IGNITE_DUR))
    const collapse = clamp01((p - P2) / COLLAPSE_DUR)
    const recedeT = easeInOut(clamp01((p - P3) / (RECEDE_END - P3)))
    const tasteT = easeInOut(clamp01((p - TASTE_START) / (TASTE_END - TASTE_START)))
    fx.ignite = ignite

    // --- one-shot burst (time-based once triggered; re-armed well below) ---
    const bs = burstState.current
    if (!bs.armed && p < BURST_REARM_BELOW) bs.armed = true
    if (bs.armed && p >= BURST_AT) {
      bs.armed = false
      bs.t0 = t
    }
    let burst = 0
    if (bs.t0 >= 0) {
      const bt = (t - bs.t0) / BURST_SECONDS
      if (bt <= 1.4) burst = Math.exp(-Math.pow((bt - 0.45) * 3.4, 2))
    }
    fx.burstEnv = burst

    // --- camera: a constant subtle breathe (the readable DOM layer sits
    //     above; nothing in the scene needs to be pixel-still any more) ---
    const breathe = 1
    const camZ = lerp(6, CAM_END_Z, easeInOut(flight))
    camera.position.set(Math.sin(t * 0.3) * 0.08 * breathe, Math.cos(t * 0.23) * 0.06 * breathe, camZ)
    camera.lookAt(0, 0, camZ - 10)

    // --- ch6/ch7: park through the demo+FAQ, glide into the wordmark ---
    const pm = postState.current
    if (p > 0.985 && (post.demoEl || post.wm3El)) {
      if (pm.tick++ % 6 === 0) {
        const vh = window.innerHeight
        if (post.demoEl) {
          const top = post.demoEl.getBoundingClientRect().top
          pm.park = clamp01((vh - top) / (vh * 0.85))
        }
        if (post.wm3El) {
          const r = post.wm3El.getBoundingClientRect()
          pm.wm = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height }
          pm.glide = clamp01((vh * 0.92 - r.top) / (vh * 0.5))
        }
      }
    } else {
      pm.park = 0
      pm.glide = 0
      pm.tick = 0
    }
    const parkE = easeInOut(pm.park)
    const glideE = easeInOut(pm.glide)
    // the wordmark's 3 lights the moment the lacquer lands; the canvas
    // bows out just after (direct DOM writes, only on change)
    if (post.wm3El) {
      const lit = pm.glide > 0.93 ? '1' : '0'
      if (post.wm3El.dataset.lit !== lit) post.wm3El.dataset.lit = lit
    }
    if (post.canvasWrapEl) {
      const hide = pm.glide > 0.97
      if (hide !== pm.hidden) {
        pm.hidden = hide
        post.canvasWrapEl.style.visibility = hide ? 'hidden' : 'visible'
      }
    }

    // --- the 3 ---
    const three = threeRef.current
    const mat = matRef.current
    if (three && mat) {
      const zz = lerp(0, THREE_END_Z, easeInOut(flight))
      // ch4: steps up and back while the DOM field takes the stage;
      // ch5: leans back in as the taste shift becomes the subject.
      // phone: the 3 retires to the empty band BELOW the field (top is
      // headline + filter chips); desktop: up and to the side as before.
      const upX = isPhone ? 0.0 : 1.7
      const upY = isPhone ? -2.1 : 1.15
      three.position.set(upX * recedeT, upY * recedeT, zz)
      three.rotation.y = POSTER_ROT_Y + t * 0.15 + p * 3.2
      three.rotation.x = Math.sin(t * 0.2) * 0.06
      updateLacquer(mat, { ignite, flight, burst, split: recedeT, taste: tasteT })
      let scale = (1 + burst * 0.18) * lerp(1, isPhone ? 0.3 : 0.5, recedeT) * lerp(1, 1.22, tasteT)

      // ch6: park top-right as a corner element while the demo runs
      if (parkE > 0) {
        const dist = 6.5
        const visH = 2 * dist * Math.tan((50 * Math.PI) / 360)
        const visW = visH * (window.innerWidth / window.innerHeight)
        const cx = visW / 2 - (isPhone ? 0.5 : 0.95)
        const cy = visH / 2 - (isPhone ? 1.0 : 1.15)
        const cz = camZ - dist
        three.position.set(
          lerp(three.position.x, cx, parkE),
          lerp(three.position.y, cy, parkE),
          lerp(three.position.z, cz, parkE),
        )
        scale = lerp(scale, isPhone ? 0.26 : 0.34, parkE)
      }
      // ch7: glide onto the wordmark's "3", unwinding to face-on
      if (glideE > 0 && pm.wm) {
        const dist = 6.5
        const wpp = worldPerPxAt(dist, 50, window.innerHeight)
        const wx = (pm.wm.cx - window.innerWidth / 2) * wpp
        const wy = -(pm.wm.cy - window.innerHeight / 2) * wpp
        const cz = camZ - dist
        three.position.set(
          lerp(three.position.x, wx, glideE),
          lerp(three.position.y, wy, glideE),
          cz,
        )
        scale = lerp(scale, Math.max(0.05, (pm.wm.h * wpp) / 1.4), glideE)
        if (pm.frozenRot == null) pm.frozenRot = three.rotation.y
        const rotTarget = Math.round(pm.frozenRot / (Math.PI * 2)) * Math.PI * 2
        three.rotation.y = lerp(pm.frozenRot, rotTarget, glideE)
        three.rotation.x *= 1 - glideE
      } else {
        pm.frozenRot = null
      }
      three.scale.setScalar(scale)

      if (glowRef.current) {
        glowRef.current.position.copy(three.position)
        const g = (1.5 * lerp(0.1, 1, ignite) * lerp(1, 0.5, flight) + burst * 4.5) * lerp(1, 0.55, recedeT) * lerp(1, 1.5, tasteT) * lerp(1, 0.4, parkE) * (1 - glideE)
        glowRef.current.scale.set(g, g, 1)
        const smat = glowRef.current.material as THREE.SpriteMaterial
        smat.opacity = (0.26 * lerp(0.05, 1, ignite) * lerp(1, 0.55, flight) + burst * 0.4 + tasteT * 0.1) * (1 - parkE * 0.55) * (1 - glideE)
      }
      if (lightRef.current) {
        lightRef.current.position.set(three.position.x, three.position.y + 0.6, zz + 2.2)
        lightRef.current.intensity = RED_LIGHT_PEAK * lerp(0.05, 1, ignite) + burst * 34
      }
    }

    // --- tunnel cards: fly past in ch2, collapse into the 3 in ch3 ---
    for (let i = 0; i < slots.length; i++) {
      const m = cardRefs.current[i]
      if (!m) continue
      const s = slots[i]
      const ct = easeIn(clamp01(collapse * 1.35 - (i / slots.length) * 0.35))
      m.position.set(lerp(s.x, 0, ct), lerp(s.y, 0, ct), lerp(s.z, THREE_END_Z, ct))
      m.rotation.z = s.rz * (1 - ct)
      const sc = Math.max(0.001, 1 - ct)
      m.scale.set(1.6 * sc, 0.9 * sc, 1)
      const cm = m.material as THREE.MeshBasicMaterial
      cm.opacity = p < P1 ? clamp01((p - P1 + 0.03) / 0.03) : 1 - ct * 0.9
      m.visible = ct < 0.995 && p > P1 - 0.05 && p < P3 + 0.03
    }
  })

  return (
    <>
      <color attach="background" args={['#000000']} />
      <fogExp2 attach="fog" args={['#000000', 0.028]} />
      <ambientLight intensity={0.12} />
      <pointLight ref={lightRef} color="#FE0000" intensity={0} distance={30} decay={1.6} />

      <mesh ref={threeRef} geometry={glyphGeo}>
        <meshPhysicalMaterial ref={matRef} {...lacquerProps()} />
      </mesh>

      <sprite ref={glowRef} scale={[0.2, 0.2, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {slots.map((s, i) => (
        <mesh key={i} ref={(el) => { cardRefs.current[i] = el }} position={[s.x, s.y, s.z]} scale={[1.6, 0.9, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={wallTextures[s.tex]} transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}

      <AtmosphereVideos fx={fx} />
    </>
  )
}

export default function JourneyCanvas({
  wall,
  progress,
  post,
  isPhone,
  onReady,
}: {
  wall: LivePick[]
  progress: { current: number }
  post: PostJourneyEls
  isPhone: boolean
  onReady: () => void
}) {
  const fx = useRef<Fx>({ ignite: 0, burstEnv: 0, p: 0 }).current
  return (
    <Canvas
      dpr={[1, isPhone ? 1.5 : 2]}
      camera={{ fov: 50, near: 0.1, far: 90, position: [0, 0, 6] }}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Journey wall={wall} progress={progress} post={post} isPhone={isPhone} fx={fx} onReady={onReady} />
      <Studio isPhone={isPhone} />
      {/* Bloom's high threshold keeps it selective in this black scene; the
          phone drops grain and (via props below) runs a lighter bloom. */}
      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          intensity={isPhone ? 0.7 : 0.85}
          luminanceThreshold={0.72}
          luminanceSmoothing={0.2}
          radius={isPhone ? 0.6 : 0.72}
        />
        <SMAA />
        {isPhone ? <></> : <Noise premultiply opacity={0.05} />}
        <Vignette eskil={false} offset={0.22} darkness={0.42} />
      </EffectComposer>
    </Canvas>
  )
}
