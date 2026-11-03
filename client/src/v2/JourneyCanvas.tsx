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
 * iPhone budget: DPR capped (1.5 mobile / 2 desktop), 14 unique canvas
 * textures shared by 42 planes, one point light + ambient, no shadows,
 * no postprocessing (the "bloom" is an additive glow sprite).
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { buildGlyphGeometry } from './glyph3'
import { makeCardTexture } from './cardTexture'
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

function Journey({ picks, progress }: { picks: LivePick[]; progress: { current: number } }) {
  const camera = useThree((s) => s.camera)

  const glyphGeo = useMemo(() => buildGlyphGeometry(), [])
  const glowTex = useMemo(() => makeGlowTexture(), [])
  const textures = useMemo(() => picks.map((p) => makeCardTexture(p)), [picks])

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
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
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
      const ignite = clamp01((p - 0.04) / 0.18)
      const burstT = clamp01((p - CH2_END) / (1 - CH2_END))
      const burst = Math.exp(-Math.pow((burstT - 0.62) * 4.2, 2)) // bell around the collapse's end
      mat.emissiveIntensity = lerp(0.02, 1.1, easeInOut(ignite)) * lerp(1, 0.45, flight) + burst * 2.4
      const scale = 1 + burst * 0.18
      three.scale.setScalar(scale)

      if (glowRef.current) {
        glowRef.current.position.copy(three.position)
        const g = 1.7 * lerp(0.1, 1, ignite) * lerp(1, 0.5, flight) + burst * 7
        glowRef.current.scale.set(g, g, 1)
        const smat = glowRef.current.material as THREE.SpriteMaterial
        smat.opacity = 0.38 * lerp(0.05, 1, ignite) * lerp(1, 0.55, flight) + burst * 0.45
      }
      if (lightRef.current) {
        lightRef.current.position.set(0, 0.6, zz + 2.2)
        lightRef.current.intensity = 14 * lerp(0.05, 1, ignite) + burst * 60
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
      <ambientLight intensity={0.25} />
      <pointLight ref={lightRef} color="#FE0000" intensity={0} distance={30} decay={1.6} />
      <directionalLight position={[3, 4, 6]} intensity={0.9} color="#F2EDE8" />

      <mesh ref={threeRef} geometry={glyphGeo}>
        <meshStandardMaterial
          ref={matRef}
          color="#1d0505"
          emissive="#FE0000"
          emissiveIntensity={0}
          roughness={0.42}
          metalness={0.15}
        />
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
    </>
  )
}

export default function JourneyCanvas({
  picks,
  progress,
  isPhone,
}: {
  picks: LivePick[]
  progress: { current: number }
  isPhone: boolean
}) {
  return (
    <Canvas
      dpr={[1, isPhone ? 1.5 : 2]}
      camera={{ fov: 50, near: 0.1, far: 90, position: [0, 0, 6] }}
      gl={{ antialias: !isPhone, powerPreference: 'high-performance', alpha: false }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Journey picks={picks} progress={progress} />
    </Canvas>
  )
}
