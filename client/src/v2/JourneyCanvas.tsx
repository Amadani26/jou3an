/**
 * The persistent WebGL layer of the journey — chapters 1→3 of the spike.
 *
 * ONE canvas, fixed behind the HTML layer, driven by a single scroll
 * progress value (0..1 over the whole runway) written into a ref by
 * ScrollTrigger — no React state per frame, no re-renders while scrolling.
 *
 *   p 0.00–0.30  ch1 — darkness; the "3" lights up red and idles
 *   p 0.30–0.68  ch2 — the camera flies down a tunnel of real restaurant
 *                 cards while the 3 recedes to the tunnel's end
 *   p 0.68–1.00  ch3 — the tunnel collapses inward; every card is pulled
 *                 into the 3; a light burst; the 3 settles, bright
 *
 * PREMIUM PASS (phase 1.5):
 *   - MeshPhysicalMaterial looks (?look=1 glass / 2 metal / 3 lacquer) in
 *     looks.ts — the scroll story drives each differently.
 *   - Studio lighting GENERATED IN CODE: drei <Environment> with
 *     <Lightformer> panels (no HDR file, nothing to licence) — a key
 *     softbox, two side strips and a low red rim strip, baked once; the
 *     reflections sweep because the 3 rotates, not because the rig moves.
 *   - Post: Bloom gated by a high luminance threshold (in this black scene
 *     only the hot red core and specular hits cross it — selective in
 *     effect), SMAA (gl antialias stays off), subtle grain + vignette
 *     (grain desktop-only). DPR stays capped at 1.5 phone / 2 desktop.
 *   - Licensed Higgsfield atmosphere clips as in-scene video planes
 *     (additive): embers under ch1's ignition, a radial burst under ch3's
 *     flash. Both optional — the scene must work with no clips at all.
 *
 * iPhone budget: DPR cap, 14 shared canvas textures for 42 planes, one
 * point light + env, no shadows, SMAA not MSAA, env resolution 128.
 */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette, SMAA } from '@react-three/postprocessing'
import { buildGlyphGeometry } from './glyph3'
import { makeCardTexture } from './cardTexture'
import { materialPropsFor, updateForStory, redLightScale, type LookId } from './looks'
import type { LivePick } from '../lib/live'

const CARD_COUNT = 42
const TUNNEL_START = -6
const TUNNEL_STEP = 1.35
const THREE_END_Z = TUNNEL_START - CARD_COUNT * TUNNEL_STEP - 4 // past the last card

const CH1_END = 0.3
const CH2_END = 0.68

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (1 - t) * (1 - t) * 2)
const easeIn = (t: number) => t * t
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

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

/** A muted <video> ready for use as a texture; sources attached in order. */
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

/** The licensed Higgsfield atmosphere clips as additive in-scene planes.
 *  Playback is gated to each clip's chapter window so at most one video
 *  decodes at a time; a failed/missing file just leaves the plane black
 *  (additive black = invisible), so the scene never depends on them. */
function AtmosphereVideos({ progress }: { progress: { current: number } }) {
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
    const p = clamp01(progress.current)

    // ch1 window — embers behind the 3, fading out as the flight starts
    const emberOn = p < CH1_END + 0.06
    if (emberOn !== playing.current.embers) {
      playing.current.embers = emberOn
      if (emberOn) void embers.play().catch(() => {})
      else embers.pause()
    }
    if (embersRef.current) {
      const m = embersRef.current.material as THREE.MeshBasicMaterial
      const ignite = clamp01((p - 0.04) / 0.18)
      m.opacity = 0.5 * ignite * clamp01((CH1_END + 0.06 - p) / 0.06)
      embersRef.current.visible = m.opacity > 0.01
    }

    // ch3 window — the radial burst plate under the collapse's flash
    const burstT = clamp01((p - CH2_END) / (1 - CH2_END))
    const burstOn = burstT > 0.3 && burstT < 0.95
    if (burstOn !== playing.current.burst) {
      playing.current.burst = burstOn
      if (burstOn) {
        burst.currentTime = 0
        void burst.play().catch(() => {})
      } else burst.pause()
    }
    if (burstRef.current) {
      const m = burstRef.current.material as THREE.MeshBasicMaterial
      const bell = Math.exp(-Math.pow((burstT - 0.62) * 4.2, 2))
      m.opacity = 0.38 * bell
      burstRef.current.visible = m.opacity > 0.01
      burstRef.current.position.set(0, 0, THREE_END_Z - 4)
    }
  })

  return (
    <>
      <mesh ref={embersRef} position={[0, 0, -8]} scale={[26, 15, 1]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={embersTex}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={burstRef} scale={[15, 8.5, 1]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={burstTex}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

/** The code-built studio: a key softbox above, two side strips for the
 *  sweeping reflections, one low red strip for the brand rim. Baked once
 *  (frames=1); the sweep comes from the 3's own rotation. */
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
  picks,
  progress,
  look,
}: {
  picks: LivePick[]
  progress: { current: number }
  look: LookId
}) {
  const camera = useThree((s) => s.camera)

  const glyphGeo = useMemo(() => buildGlyphGeometry(), [])
  const glowTex = useMemo(() => makeGlowTexture(), [])
  const textures = useMemo(() => picks.map((p) => makeCardTexture(p)), [picks])
  const matProps = useMemo(() => materialPropsFor(look), [look])

  // Helix of card slots: angle, radius, z — precomputed once.
  const slots = useMemo(() => {
    const out: { x: number; y: number; z: number; rz: number; tex: number }[] = []
    for (let i = 0; i < CARD_COUNT; i++) {
      const angle = i * 2.39996 // golden angle: no visible repeats
      const r = 2.3 + ((i * 7) % 10) / 9
      out.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r * 0.72,
        z: TUNNEL_START - i * TUNNEL_STEP,
        rz: Math.sin(i * 12.9898) * 0.12,
        tex: i % Math.max(1, picks.length),
      })
    }
    return out
  }, [picks.length])

  const threeRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null)
  const glowRef = useRef<THREE.Sprite>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const cardRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame((state) => {
    if (document.hidden) return
    const p = clamp01(progress.current)
    const t = state.clock.elapsedTime

    // --- camera ---
    const flight = clamp01((p - CH1_END) / (CH2_END - CH1_END))
    const camZ = lerp(6, THREE_END_Z + 7.5, easeInOut(flight))
    camera.position.set(
      Math.sin(t * 0.3) * 0.08, // idle breath, never still
      Math.cos(t * 0.23) * 0.06,
      camZ,
    )
    camera.lookAt(0, 0, camZ - 10)

    // --- the 3 ---
    const three = threeRef.current
    const mat = matRef.current
    if (three && mat) {
      // ch1 at origin; recedes to the tunnel end ahead of the camera in ch2.
      const zz = lerp(0, THREE_END_Z, easeInOut(flight))
      three.position.set(0, 0, zz)
      three.rotation.y = t * 0.15 + p * 3.2
      three.rotation.x = Math.sin(t * 0.2) * 0.06

      // light-up ramp in ch1 → dim through the tunnel → burst in ch3
      const ignite = easeInOut(clamp01((p - 0.04) / 0.18))
      const burstT = clamp01((p - CH2_END) / (1 - CH2_END))
      const burst = Math.exp(-Math.pow((burstT - 0.62) * 4.2, 2)) // bell around the collapse's end
      updateForStory(look, mat, ignite, flight, burst)
      const scale = 1 + burst * 0.18
      three.scale.setScalar(scale)

      if (glowRef.current) {
        glowRef.current.position.copy(three.position)
        const g = 1.5 * lerp(0.1, 1, ignite) * lerp(1, 0.5, flight) + burst * 4.5
        glowRef.current.scale.set(g, g, 1)
        const smat = glowRef.current.material as THREE.SpriteMaterial
        // the bloom pass amplifies the hot core now, so the sprite stays quieter
        smat.opacity = 0.26 * lerp(0.05, 1, ignite) * lerp(1, 0.55, flight) + burst * 0.4
      }
      if (lightRef.current) {
        lightRef.current.position.set(0, 0.6, zz + 2.2)
        lightRef.current.intensity = redLightScale(look) * lerp(0.05, 1, ignite) + burst * 34
      }
    }

    // --- tunnel cards: fly past in ch2, collapse into the 3 in ch3 ---
    const collapse = clamp01((p - CH2_END) / (0.26))
    for (let i = 0; i < slots.length; i++) {
      const m = cardRefs.current[i]
      if (!m) continue
      const s = slots[i]
      // staggered pull: nearer cards leave first
      const ct = easeIn(clamp01(collapse * 1.35 - (i / slots.length) * 0.35))
      m.position.set(lerp(s.x, 0, ct), lerp(s.y, 0, ct), lerp(s.z, THREE_END_Z, ct))
      m.rotation.z = s.rz * (1 - ct)
      const sc = Math.max(0.001, 1 - ct)
      m.scale.set(1.6 * sc, 0.9 * sc, 1)
      const cm = m.material as THREE.MeshBasicMaterial
      cm.opacity = p < CH1_END ? clamp01((p - CH1_END + 0.06) / 0.06) : 1 - ct * 0.9
      m.visible = ct < 0.995 && p > CH1_END - 0.08
    }
  })

  return (
    <>
      <color attach="background" args={['#000000']} />
      <fogExp2 attach="fog" args={['#000000', 0.028]} />
      <ambientLight intensity={0.12} />
      <pointLight ref={lightRef} color="#FE0000" intensity={0} distance={30} decay={1.6} />

      <mesh ref={threeRef} geometry={glyphGeo}>
        <meshPhysicalMaterial ref={matRef} {...matProps} />
      </mesh>

      <sprite ref={glowRef} scale={[0.2, 0.2, 1]}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      {slots.map((s, i) => (
        <mesh
          key={i}
          ref={(el) => { cardRefs.current[i] = el }}
          position={[s.x, s.y, s.z]}
          scale={[1.6, 0.9, 1]}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={textures[s.tex]} transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}

      <AtmosphereVideos progress={progress} />
    </>
  )
}

export default function JourneyCanvas({
  picks,
  progress,
  isPhone,
  look,
}: {
  picks: LivePick[]
  progress: { current: number }
  isPhone: boolean
  look: LookId
}) {
  return (
    <Canvas
      dpr={[1, isPhone ? 1.5 : 2]}
      camera={{ fov: 50, near: 0.1, far: 90, position: [0, 0, 6] }}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Journey picks={picks} progress={progress} look={look} />
      <Studio isPhone={isPhone} />
      {/* Bloom's high luminance threshold makes it selective in practice:
          in this black scene only the red-hot core and the brightest
          specular hits cross it. Grain is desktop-only (it costs fill rate
          and reads as noise on small bright-mode screens anyway). */}
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.72} luminanceSmoothing={0.2} radius={0.72} />
        <SMAA />
        {isPhone ? <></> : <Noise premultiply opacity={0.05} />}
        <Vignette eskil={false} offset={0.22} darkness={0.42} />
      </EffectComposer>
    </Canvas>
  )
}
