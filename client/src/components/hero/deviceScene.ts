import {
  AmbientLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  WebGLRenderer,
} from 'three'
import { RoundedBoxGeometry } from 'three-stdlib'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * The hero device's WebGL body — a scene builder that runs IN A WORKER on an
 * OffscreenCanvas (the normal path) or on the main thread (the fallback for
 * browsers without worker WebGL).
 *
 * WHY A WORKER: three.js is a ~930 KB parse. On the main thread that parse
 * landed inside Lighthouse's throttled trace as 4,200ms of TBT, which is why
 * the old scene waited for a user gesture — and a gesture-gated hero is
 * exactly the "static image you can poke at" problem. In a worker the parse,
 * the compile and every frame are off the main thread entirely, so the scene
 * can start AT LOAD with zero main-thread cost.
 *
 * WHY THE GEOMETRY NEVER MOVES: the live screen is DOM, sitting over the
 * canvas. Both layers share one CSS-transformed parent (the float/tilt
 * wrapper), so they can never drift apart — and that only holds if the GL
 * body stays put inside its canvas. What makes it alive is LIGHT: the red key
 * orbits slowly, the environment rotates so the metal's reflections travel,
 * and the glow breathes. Geometry static, light alive.
 *
 * Units are device units (body 1.08 x 2.26) under an orthographic camera
 * whose frustum is sized so the body fills 92% of the canvas — which is what
 * lets the DOM face be placed with plain CSS percentages, exactly.
 */

/** Body fills 92% of the canvas in both axes; the canvas has the body's aspect. */
const FRUSTUM_W = 1.08 / 0.92
const FRUSTUM_H = 2.26 / 0.92

export type DeviceScene = {
  resize(w: number, h: number, dpr: number): void
  setVisible(v: boolean): void
  dispose(): void
}


export function createDeviceScene(opts: {
  canvas: HTMLCanvasElement | OffscreenCanvas
  width: number
  height: number
  dpr: number
  onFirstFrame?: () => void
}): DeviceScene {
  const renderer = new WebGLRenderer({
    canvas: opts.canvas as HTMLCanvasElement,
    antialias: true,
    alpha: true,
    powerPreference: 'default',
  })
  renderer.setPixelRatio(Math.min(2, opts.dpr))
  renderer.setSize(opts.width, opts.height, false)

  const scene = new Scene()
  const camera = new OrthographicCamera(
    -FRUSTUM_W / 2,
    FRUSTUM_W / 2,
    FRUSTUM_H / 2,
    -FRUSTUM_H / 2,
    0.1,
    20,
  )
  camera.position.z = 5

  // Soft generated reflections — no HDR file, no network, no licence.
  const pmrem = new PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = env.texture
  scene.environmentIntensity = 0.3

  // The body: an original rounded slab. No notch, no island, no likeness.
  const bodyGeo = new RoundedBoxGeometry(1.08, 2.26, 0.085, 5, 0.055)
  const bodyMat = new MeshStandardMaterial({ color: '#181818', metalness: 0.78, roughness: 0.26 })
  const body = new Mesh(bodyGeo, bodyMat)
  scene.add(body)

  // The glass border ring around the DOM screen (the DOM covers the centre).
  const faceGeo = new RoundedBoxGeometry(1.0, 2.18, 0.012, 4, 0.045)
  const faceMat = new MeshStandardMaterial({ color: '#050505', metalness: 0.5, roughness: 0.18 })
  const face = new Mesh(faceGeo, faceMat)
  face.position.z = 0.045
  scene.add(face)

  // decay 0: light strength independent of distance, so intensities stay sane.
  const key = new PointLight('#FE0000', 3.0, 0, 0)
  key.position.set(1.4, 1.7, 2.4)
  scene.add(key)
  const fill = new PointLight('#ffffff', 0.5, 0, 0)
  fill.position.set(-1.8, -1.1, 2.0)
  scene.add(fill)
  scene.add(new AmbientLight('#ffffff', 0.22))


  let told = false
  let visible = true

  const frame = (ms: number) => {
    const t = ms / 1000
    // The light does the living. The geometry holds still — see header note.
    key.position.x = 1.4 + Math.sin(t * 0.26) * 0.55
    key.position.y = 1.7 + Math.cos(t * 0.21) * 0.45
    key.intensity = 2.8 + Math.sin(t * 0.5) * 0.5
    scene.environmentRotation.y = t * 0.06
    renderer.render(scene, camera)
    if (!told) {
      told = true
      opts.onFirstFrame?.()
    }
  }

  renderer.setAnimationLoop(frame)

  return {
    resize(w, h, dpr) {
      renderer.setPixelRatio(Math.min(2, dpr))
      renderer.setSize(w, h, false)
      // The canvas keeps the body's aspect, so the frustum never changes.
    },
    setVisible(v) {
      if (v === visible) return
      visible = v
      renderer.setAnimationLoop(v ? frame : null)
    },
    dispose() {
      renderer.setAnimationLoop(null)
      env.texture.dispose()
      pmrem.dispose()
      bodyGeo.dispose()
      faceGeo.dispose()
      bodyMat.dispose()
      faceMat.dispose()
      renderer.dispose()
    },
  }
}
