import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PRIVACY_EMAIL } from '../lib/legal'
import { prefersReducedMotion } from '../lib/reveal'

/**
 * FOOTER — the name returns at full width.
 *
 * The Jou3an wordmark runs edge to edge along the bottom, جوعان above it in
 * the brand red, with a SUBTLE parallax: as the footer scrolls into view the
 * wordmark rises its last 44px. This is ambient, continuous motion tied to
 * where the footer sits in the viewport (not a story sequence, so the
 * play-once rule does not apply — there is nothing to replay). One rAF
 * scroll listener writes one custom property; the transform is a calc() on
 * it. Off entirely under reduced motion.
 *
 * Privacy, Terms and Contact keep their routes: real <Link>s (a full page
 * load here would throw away the warm SPA for nothing) and the mailto.
 */
export default function Footer() {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    let frame = 0
    const apply = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      // 0 when the footer's top touches the viewport bottom, 1 when fully in.
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / Math.max(1, r.height)))
      el.style.setProperty('--fp', p.toFixed(4))
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
    <footer ref={ref} className="site-footer">
      <div className="foot-top">
        <p className="foot-tag">Dubai&apos;s food decision engine</p>
        <nav className="foot-links" aria-label="Legal">
          <Link to="/privacy">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms">Terms</Link>
          <span aria-hidden="true">·</span>
          <a href={`mailto:${PRIVACY_EMAIL}`}>Contact</a>
        </nav>
        <p className="foot-legal">© 2026 Jou3an FZ-LLC · Dubai, UAE</p>
      </div>

      <div className="foot-mark" aria-hidden="true">
        <span className="foot-ar" dir="rtl" lang="ar">
          جوعان
        </span>
        <span className="foot-word">
          Jou<b>3</b>an
        </span>
      </div>
    </footer>
  )
}
