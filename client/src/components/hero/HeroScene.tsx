import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three-stdlib'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { easing } from 'maath'
import type { MotionValue } from 'motion/react'
import { drawResultsScreen, drawFloatCard, drawGlow } from '../../lib/screenTexture'

/**
 * The hero's WebGL scene: an ORIGINAL device — a rounded slab with a bevelled
 * body and an OLED-dark face — floating in a black field lit by one red key
 * light, with the three result cards lifting off the glass in true depth.
 *
 * Nothing in here is downloaded: the device is three.js geometry (deliberately
 * generic — no notch, no island, no Apple likeness), the screen and cards are
 * canvas-drawn textures in our own design language, and the "bloom" is an
 * additive glow sprite rather than a postprocessing pass, which is the
 * difference between one extra draw call and a whole extra render target on an
 * iPhone GPU.
 *
 * Scroll choreography: the shell hands in a MotionValue (0 at the top of the
 * page, 1 when the hero has scrolled away). Targets are computed from it every
 * frame and the meshes are DAMPED toward them (maath's critically-damped
 * easing), so motion arrives with spring weight and an interrupted scroll
 * reverses smoothly from wherever it is. On desktop a fine pointer adds a few
 * degrees of parallax; on touch the scene is scroll-driven only.
 */

const CARD_COUNT = 3

/** [x, y, z, rotY] at rest (on the glass) and fanned out (scrolled). */
const CARD_REST: [number, number, number, number][] = [
  [-0.62, 0.72, 0.18, 0.16],
  [0.66, 0.1, 0.24, -0.18],
  [-0.56, -0.68, 0.2, 0.14],
]
const CARD_FAN: [number, number, number, number][] = [
  [-1.05, 1.05, 0.85, 0.3],
  [1.1, 0.12, 1.05, -0.34],
  [-0.95, -1.0, 0.9, 0.26],
]

function Rig({ progress, children }: { progress: MotionValue<number>; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!)
  const fine = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    [],
  )

  useFrame((state, dt) => {
    const p = progress.get()
    // Desktop only: the pointer leans the whole scene a few degrees. Touch
    // devices get nothing here — scroll is the only input, as briefed.
    const px = fine ? state.pointer.x : 0
    const py = fine ? state.pointer.y : 0
    easing.dampE(
      ref.current.rotation,
      [py * 0.06, px * 0.1, 0],
      0.5,
      dt,
    )
    // The whole rig eases up and back as the hero leaves.
    easing.damp3(ref.current.position, [0, p * 0.55, -p * 0.7], 0.4, dt)
  })

  return <group ref={ref}>{children}</group>
}

const bodyGeo = new RoundedBoxGeometry(1.08, 2.26, 0.085, 5, 0.055)
const faceGeo = new RoundedBoxGeometry(1.0, 2.18, 0.012, 4, 0.045)

function Phone({ progress }: { progress: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null!)
  const screenTex = useMemo(() => {
    const t = new THREE.CanvasTexture(drawResultsScreen())
    t.anisotropy = 4
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])

  useFrame((state, dt) => {
    const p = progress.get()
    const t = state.clock.elapsedTime
    // Idle float is time-based and tiny; the reveal turn is scroll-driven.
    easing.dampE(
      group.current.rotation,
      [Math.sin(t * 0.4) * 0.02, -0.16 + p * 0.5 + Math.sin(t * 0.3) * 0.03, 0.02],
      0.35,
      dt,
    )
    easing.damp3(group.current.position, [0, Math.sin(t * 0.55) * 0.04, 0], 0.3, dt)
  })

  return (
    <group ref={group}>
      {/* Body: generic rounded slab, bevel from the rounded geometry itself.
          three-stdlib's RoundedBoxGeometry directly — drei existed in this
          file for this one component, and dropping it cut the lazy chunk by
          a third. */}
      <mesh geometry={bodyGeo}>
        <meshStandardMaterial color="#161616" metalness={0.72} roughness={0.3} />
      </mesh>
      {/* Face: near-black glass border around the panel. */}
      <mesh geometry={faceGeo} position={[0, 0, 0.045]}>
        <meshStandardMaterial color="#060606" metalness={0.4} roughness={0.2} />
      </mesh>
      {/* Panel: unlit, so it reads as an emissive OLED rather than lit plastic. */}
      <mesh position={[0, 0, 0.0535]}>
        <planeGeometry args={[0.94, 1.95]} />
        <meshBasicMaterial map={screenTex} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Cards({ progress }: { progress: MotionValue<number> }) {
  const refs = useRef<THREE.Group[]>([])
  const { viewport } = useThree()
  const textures = useMemo(
    () =>
      Array.from({ length: CARD_COUNT }, (_, i) => {
        const t = new THREE.CanvasTexture(drawFloatCard(i))
        t.anisotropy = 4
        t.colorSpace = THREE.SRGBColorSpace
        return t
      }),
    [],
  )

  useFrame((state, dt) => {
    const p = Math.min(1, progress.get() * 1.6) // cards finish fanning before the hero is gone
    const t = state.clock.elapsedTime
    // Aspect-aware horizontal spread. The rest/fan tables are authored for a
    // wide frame; on a 393pt portrait stage the world is only ~1.3 units wide
    // at z=0, so the same x pushed half of every card past the edge. Scale x
    // so a card's far edge (half-width 0.5 + breathing room) stays inside.
    const maxX = Math.max(0.5, viewport.width / 2 - 0.62)
    const k = Math.min(1, maxX / 1.1)
    for (let i = 0; i < CARD_COUNT; i++) {
      const g = refs.current[i]
      if (!g) continue
      const a = CARD_REST[i]
      const b = CARD_FAN[i]
      const bob = Math.sin(t * 0.7 + i * 2.1) * 0.025
      easing.damp3(
        g.position,
        [(a[0] + (b[0] - a[0]) * p) * k, a[1] + (b[1] - a[1]) * p + bob, a[2] + (b[2] - a[2]) * p],
        0.32,
        dt,
      )
      easing.dampE(g.rotation, [0, a[3] + (b[3] - a[3]) * p, 0], 0.32, dt)
    }
  })

  return (
    <>
      {textures.map((tex, i) => (
        <group key={i} ref={(el) => { if (el) refs.current[i] = el }}>
          <mesh>
            <planeGeometry args={[1.0, 0.374]} />
            <meshBasicMaterial map={tex} transparent toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function Glow() {
  const tex = useMemo(() => new THREE.CanvasTexture(drawGlow()), [])
  return (
    <sprite position={[0.9, 1.3, -1.6]} scale={[5.2, 5.2, 1]}>
      <spriteMaterial map={tex} blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.8} />
    </sprite>
  )
}

/** Soft generated reflections — no HDR file, no network, no licence. */
function Env() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = env.texture
    scene.environmentIntensity = 0.25
    return () => {
      scene.environment = null
      env.texture.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

export default function HeroScene({
  progress,
  active,
  onReady,
}: {
  progress: MotionValue<number>
  active: boolean
  onReady?: () => void
}) {
  return (
    <Canvas
      // dpr capped at 2: a 3x panel quadruples fill cost for detail nobody sees.
      dpr={[1, 2]}
      // Paused entirely while the section is off screen or the poster shows.
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0, 4.7], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
      onCreated={() => onReady?.()}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.22} />
      {/* The red key — the page's one light source, now literal. */}
      <pointLight position={[2.4, 2.4, 2.4]} intensity={26} color="#FE0000" />
      <pointLight position={[-2.6, -1.2, 2.0]} intensity={4} color="#ffffff" />
      <Env />
      <Rig progress={progress}>
        <Glow />
        <Phone progress={progress} />
        <Cards progress={progress} />
      </Rig>
    </Canvas>
  )
}
