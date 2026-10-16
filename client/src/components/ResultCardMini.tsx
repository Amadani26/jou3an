/**
 * A Jou3an result card, rebuilt in HTML from real catalogue data.
 *
 * Why HTML rather than a crop of the real screenshot:
 *
 *  - It stays crisp at any depth. These cards are scaled, rotated and pushed
 *    back in 3D; a raster crop would be a blurred rectangle at the back of the
 *    stack and a heavy download at the front.
 *  - It carries no photography. The app's own cards are headed by Google
 *    Places imagery of real businesses, which belongs inside the product, not
 *    scattered over a marketing page. The rank panel takes the photo's place.
 *  - It is real text: readable, selectable, translatable, and legible to a
 *    screen reader. A picture of a card is none of those things.
 *
 * Three shapes, one component:
 *   default    — panel + name + meta, the app's own card language.
 *   textOnly   — name + meta, no panel. The grid needs every pixel of width
 *                for the name; a 34px panel is what turned "Arabian Tea House"
 *                into "Ara…".
 *   schematic  — a blank vertical card standing for "some app, any app".
 */
export type MiniCard = { n: string; c: string; a: string }

export default function ResultCardMini({
  card,
  rank,
  size = 'md',
  reason,
  schematic = false,
  textOnly = false,
}: {
  card?: MiniCard
  rank?: number
  size?: 'sm' | 'md' | 'lg'
  reason?: string
  schematic?: boolean
  textOnly?: boolean
}) {
  if (schematic) {
    /*
     * Shaped like an app card — a header block over a few lines — rather than
     * a wide bar, because a pile is only legible as a pile if the things in it
     * read as cards. It is also a step lighter than the page: at #141414 on
     * black the whole stack disappeared into a smear.
     */
    return (
      <div className="mini-sch" aria-hidden="true">
        <div className="mini-sch-head" />
        <div className="mini-sch-bars">
          <span className="mini-bar" style={{ width: '82%' }} />
          <span className="mini-bar mini-bar-thin" style={{ width: '54%' }} />
          <span className="mini-bar mini-bar-thin" style={{ width: '66%' }} />
        </div>
      </div>
    )
  }

  return (
    <div className={`mini mini-${size}${textOnly ? ' mini-text-only' : ''}`}>
      {textOnly ? null : (
        <div className="mini-panel">
          {rank ? <span className="mini-rank">{rank}</span> : null}
        </div>
      )}
      <div className="mini-text">
        <span className="mini-name">{card?.n}</span>
        <span className="mini-meta">
          <span className="mini-cuisine">{card?.c}</span>
          <i className="mini-dot" />
          <span className="mini-area">{card?.a}</span>
        </span>
        {reason ? <span className="mini-reason">{reason}</span> : null}
      </div>
    </div>
  )
}
