import { useEffect, useState } from 'react'
import { scrollToWaitlist } from '../lib/scroll'

/**
 * The floating waitlist button — phone widths only (CSS hides it from 768px,
 * where the hero carries its own in-flow CTA).
 *
 * Three rules, all about never shouting over the story:
 *   - hidden at the start: it appears only once the user is properly into
 *     the journey (past the hero's two beats);
 *   - it dismisses itself while the waitlist band is on screen — a floating
 *     "join" hovering over the join form is a double ask;
 *   - fixed bottom-centre, above the home indicator (safe-area aware), and
 *     comfortably past the 44pt tap minimum.
 *
 * Tapping it is the same gesture as the hero CTA: smooth-scroll to #waitlist,
 * then hand focus to the email field (lib/scroll.ts owns that).
 */

/** How far into the page (in viewports) the button first appears. */
const APPEAR_AT_VH = 1.6

export default function FloatingCTA() {
  const [past, setPast] = useState(false)
  const [formInView, setFormInView] = useState(false)

  useEffect(() => {
    let frame = 0
    const apply = () => {
      frame = 0
      setPast(window.scrollY > window.innerHeight * APPEAR_AT_VH)
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

  useEffect(() => {
    const el = document.getElementById('waitlist')
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((e) =>
      setFormInView(e[0]?.isIntersecting ?? false),
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const show = past && !formInView

  return (
    <button
      type="button"
      className="float-cta"
      data-show={show ? 'yes' : 'no'}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      onClick={scrollToWaitlist}
    >
      Join the waitlist
    </button>
  )
}
