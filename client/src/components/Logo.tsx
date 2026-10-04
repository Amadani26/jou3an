/**
 * The brand name as TEXT — "Jou3an", with the 3 in the brand red.
 *
 * ⚠️ This used to render `public/brand/jou3an-logo.png`. It no longer renders
 * ANY image: the old mark is being replaced and a wordmark that is about to
 * change is not worth shipping at three sizes. The PNG is still on disk (and
 * still the `og:image` source, which is a social-card asset, not a page
 * element) — nothing was deleted, this just stopped pointing at it.
 *
 * Type instead of an image buys two things beyond the swap: it is crisp at
 * every size with no intrinsic-ratio arithmetic, and it inherits the page's
 * own font, so the nav and the hero headline are finally set in the same face.
 *
 * `height` stays the prop so every existing call site keeps working. It is the
 * cap height the caller wants; font-size is derived from it.
 */

/** Rendered glyphs are ~72% of the font size, so a 26px-tall mark needs ~36px. */
const FONT_RATIO = 1 / 0.72

export default function Logo({
  height = 26,
  className = '',
}: {
  height?: number
  className?: string
}) {
  const fontSize = Math.round(height * FONT_RATIO)

  return (
    <span
      aria-label="Jou3an"
      role="img"
      className={`inline-block select-none font-display font-extrabold leading-none text-text-primary ${className}`}
      style={{ fontSize, letterSpacing: '-0.03em' }}
    >
      Jou<span className="text-red">3</span>an
    </span>
  )
}
