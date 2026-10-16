import Logo from './Logo'

/**
 * Wordmark only.
 *
 * Two things left this bar deliberately:
 *
 * - THE GLASS. It carried backdrop-filter: blur(20px) across a full-width
 *   fixed element, which is one of the most expensive things you can ask an
 *   iPhone to repaint on every scroll frame, and "floating pill nav over
 *   frosted glass" is the most generic chrome on the web.
 *
 * - THE "JOIN WAITLIST" PILL. The hero's own full-width CTA is the page's one
 *   action, and a second one in the corner sat directly on top of the giant 3.
 *   Legal links are unaffected: Privacy and Terms have always lived in the
 *   footer, and still do.
 *
 * The bar is transparent so the 3 passes behind it and is cropped by the top
 * edge of the SCREEN rather than by a bar 56px down.
 */
export default function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-[calc(56px_+_env(safe-area-inset-top))] md:h-[62px] pt-[env(safe-area-inset-top)] md:pt-0 flex items-center px-4 md:px-8 pointer-events-none">
      <a
        href="/"
        aria-label="Jou3an — home"
        className="flex items-center pointer-events-auto"
      >
        <Logo height={26} />
      </a>
    </header>
  )
}
