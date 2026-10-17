import { useEffect, useRef, useState } from 'react'
import type { DeviceScene } from './deviceScene'

/**
 * The WebGL layer of the hero device (?hero=1).
 *
 * The canvas sits OVER the CSS device body and fades in on its first rendered
 * frame — so the device is alive from first paint (the CSS body, sheen and
 * live screen need no WebGL at all), and the GL lighting is an upgrade that
 * arrives a moment later, not a prerequisite anyone waits for.
 *
 * Normal path: the canvas's control is transferred to an OffscreenCanvas and
 * the scene runs in a WORKER — three.js never parses on the main thread, so
 * TBT stays flat (this is the fix for the 4,200ms the main-thread parse used
 * to cost under a throttled trace). Fallback for browsers without worker
 * WebGL: the same scene module, dynamically imported on the main thread after
 * `load`, where it can no longer race the LCP.
 */

function canOffscreenWebGL(): boolean {
  try {
    if (typeof OffscreenCanvas === 'undefined') return false
    const oc = new OffscreenCanvas(1, 1)
    return Boolean(oc.getContext('webgl2') || oc.getContext('webgl'))
  } catch {
    return false
  }
}

export default function DeviceGL() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let worker: Worker | null = null
    let scene: DeviceScene | null = null
    let disposed = false

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const size = () => {
      const r = canvas.getBoundingClientRect()
      return { width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)) }
    }

    const boot = () => {
      if (disposed) return
      if (canOffscreenWebGL()) {
        try {
          const off = canvas.transferControlToOffscreen()
          worker = new Worker(new URL('./heroDevice.worker.ts', import.meta.url), {
            type: 'module',
          })
          worker.onmessage = (e) => {
            if (e.data?.type === 'frame') setLive(true)
          }
          worker.onerror = () => {
            // GL failed in the worker: the CSS body simply stays. Nothing to
            // repair — the fallback is already on screen.
            worker?.terminate()
            worker = null
          }
          worker.postMessage({ type: 'init', canvas: off, ...size(), dpr }, [off])
          return
        } catch {
          /* fall through to main-thread path */
        }
      }
      // Main-thread fallback, after load: the DOM hero is already alive, so
      // this parse is a background upgrade, never a gate.
      void import('./deviceScene').then((m) => {
        if (disposed) return
        try {
          scene = m.createDeviceScene({ canvas, ...size(), dpr, onFirstFrame: () => setLive(true) })
        } catch {
          /* no WebGL after all — CSS body stays */
        }
      })
    }

    // Spawn after load so the worker chunk's download never competes with the
    // LCP image/fonts on a throttled network. The DOM device is already live.
    let bootTimer = 0
    const onLoad = () => {
      bootTimer = window.setTimeout(boot, 150)
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })

    const onResize = () => {
      const s = size()
      worker?.postMessage({ type: 'resize', ...s, dpr })
      scene?.resize(s.width, s.height, dpr)
    }
    window.addEventListener('resize', onResize)

    const setVis = (v: boolean) => {
      worker?.postMessage({ type: 'vis', visible: v })
      scene?.setVisible(v)
    }
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((e) => setVis((e[0]?.isIntersecting ?? true) && !document.hidden))
        : null
    io?.observe(canvas)
    const onVis = () => setVis(!document.hidden)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      disposed = true
      window.clearTimeout(bootTimer)
      window.removeEventListener('load', onLoad)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      io?.disconnect()
      worker?.terminate()
      scene?.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="dev-canvas"
      data-live={live ? 'yes' : 'no'}
      aria-hidden="true"
    />
  )
}
