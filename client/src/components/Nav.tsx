import { useEffect, useState } from 'react'
import Logo from './Logo'

/**
 * Wordmark only — the hero's full-width CTA is the page's one action, and the
 * legal links live in the footer.
 *
 * TWO STATES, no glass. Transparent over the hero (so the composition runs to
 * the top edge of the screen), then a SOLID near-black bar once the page has
 * scrolled past ~70% of the first viewport — which is what stops the white
 * wordmark lying illegibly over whatever section happens to be passing under
 * it. Deliberately not backdrop-filter: a full-width fixed blur is one of the
 * most expensive repaints an iPhone can be asked for on every scroll frame.
 * A rAF-coalesced scroll listener flips one data attribute; CSS does the rest.
 */
export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let frame = 0
    const read = () => {
      frame = 0
      setScrolled(window.scrollY > window.innerHeight * 0.7)
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <header
      className="nav-bar fixed top-0 inset-x-0 z-50 h-[calc(56px_+_env(safe-area-inset-top))] md:h-[62px] pt-[env(safe-area-inset-top)] md:pt-0 flex items-center px-4 md:px-8"
      data-scrolled={scrolled ? 'yes' : 'no'}
    >
      <a href="/" aria-label="Jou3an — home" className="flex items-center">
        <Logo height={26} />
      </a>
    </header>
  )
}
