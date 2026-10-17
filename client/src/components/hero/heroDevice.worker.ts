import { createDeviceScene, type DeviceScene } from './deviceScene'

/**
 * Worker bootstrap for the hero device scene. three.js lives, parses and
 * renders ENTIRELY in here — the main thread's whole cost is spawning this
 * worker and posting a handful of tiny messages. See deviceScene.ts for why.
 */

type InMessage =
  | { type: 'init'; canvas: OffscreenCanvas; width: number; height: number; dpr: number }
  | { type: 'resize'; width: number; height: number; dpr: number }
  | { type: 'vis'; visible: boolean }

const port = self as unknown as {
  postMessage(m: unknown): void
  onmessage: ((e: MessageEvent<InMessage>) => void) | null
}

let scene: DeviceScene | null = null

port.onmessage = (e) => {
  const d = e.data
  if (d.type === 'init') {
    scene = createDeviceScene({
      canvas: d.canvas,
      width: d.width,
      height: d.height,
      dpr: d.dpr,
      onFirstFrame: () => port.postMessage({ type: 'frame' }),
    })
  } else if (d.type === 'resize') {
    scene?.resize(d.width, d.height, d.dpr)
  } else if (d.type === 'vis') {
    scene?.setVisible(d.visible)
  }
}
