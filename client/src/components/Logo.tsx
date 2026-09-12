/**
 * Official Jou3an wordmark (`public/brand/jou3an-logo.png`, intrinsic 973×186).
 *
 * ⚠️ The letters are WHITE — this must only ever sit on a dark surface.
 * Rendered at a fraction of its intrinsic size so it stays crisp on retina:
 * even the largest use here (34px tall) is ~18% of the source width.
 *
 * Render ONE of these per location — two nodes means the alt text is announced
 * twice, and any responsive show/hide between them is a duplication waiting to
 * happen.
 */
const INTRINSIC_W = 973
const INTRINSIC_H = 186

export default function Logo({
  height = 26,
  className = '',
}: {
  height?: number
  className?: string
}) {
  const width = Math.round((height * INTRINSIC_W) / INTRINSIC_H)

  return (
    <img
      src="/brand/jou3an-logo.png"
      alt="Jou3an"
      width={width}
      height={height}
      draggable={false}
      // Explicit box so the fixed nav doesn't reflow while the PNG loads.
      // NOTE: no `display` here — an inline style beats any utility class, so
      // setting it would silently defeat `hidden` / `md:block` on the caller.
      style={{ width, height }}
      className={`select-none ${className}`}
    />
  )
}
