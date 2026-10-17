import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { DISHES, type Dish } from '../../lib/dishes'

/**
 * THE PROBLEM — a wall of appetite.
 *
 * A mixed-size poster wall of generic dishes drifts in opposite directions,
 * row by row, on a plane that starts tilted away into the dark and flattens
 * toward the viewer as the section scrolls in. Dense, delicious, endless —
 * the feeling of every food app at 8pm.
 *
 * ⚠️ ZERO-RISK: every card is a DISH, never a venue (src/lib/dishes.ts). The
 * photos are licensed Pexels stock credited in client/ASSET_CREDITS.md, used
 * as generic cuisine imagery. No counts appear anywhere in this section — the
 * wall says "too many" by drifting off both edges, not by quoting a number.
 *
 * PERFORMANCE SHAPE:
 * - Row drift is a CSS keyframe on each track (transform only, GPU), with the
 *   track content duplicated so a -50% translate loops seamlessly.
 * - The tilt/flatten is ONE scroll-driven element (the plane wrapper): motion
 *   composes rotateX/scale/y into a single transform. One write per frame.
 * - Cards themselves are static DOM inside the tracks — nothing per-card runs
 *   per frame.
 */

export type WallCard = {
  dish: Dish
  /** lg = photo poster, md = colour field, sm = compact line card. */
  size: 'lg' | 'md' | 'sm'
}

/** Rows are authored, not random: each row mixes sizes so the wall reads as a
 *  designed bento, and every photo dish appears exactly once. */
const ROWS: WallCard[][] = [
  [
    { dish: DISHES[0], size: 'lg' }, // shawarma photo
    { dish: DISHES[10], size: 'sm' },
    { dish: DISHES[4], size: 'lg' }, // pizza photo
    { dish: DISHES[16], size: 'md' },
    { dish: DISHES[8], size: 'lg' }, // pancakes photo
  ],
  [
    { dish: DISHES[11], size: 'md' },
    { dish: DISHES[1], size: 'lg' }, // sushi photo
    { dish: DISHES[20], size: 'sm' },
    { dish: DISHES[3], size: 'lg' }, // biryani photo
    { dish: DISHES[22], size: 'md' },
  ],
  [
    { dish: DISHES[2], size: 'lg' }, // burger photo
    { dish: DISHES[14], size: 'md' },
    { dish: DISHES[6], size: 'lg' }, // ramen photo
    { dish: DISHES[9], size: 'sm' },
    { dish: DISHES[17], size: 'md' },
  ],
  [
    { dish: DISHES[19], size: 'sm' },
    { dish: DISHES[5], size: 'lg' }, // poke photo
    { dish: DISHES[13], size: 'md' },
    { dish: DISHES[7], size: 'lg' }, // skewers photo
    { dish: DISHES[21], size: 'md' },
  ],
  [
    { dish: DISHES[15], size: 'md' },
    { dish: DISHES[23], size: 'sm' },
    { dish: DISHES[12], size: 'md' },
    { dish: DISHES[18], size: 'sm' },
    { dish: DISHES[10], size: 'md' },
  ],
]

function PosterCard({ card }: { card: WallCard }) {
  const d = card.dish
  return (
    <article className={`wcard wcard-${card.size}`}>
      {card.size === 'lg' && d.photo ? (
        <img
          src={`/brand/dishes/${d.photo}.webp`}
          alt=""
          loading="lazy"
          decoding="async"
          width={800}
          height={600}
          className="wcard-photo"
        />
      ) : (
        <span aria-hidden="true" className="wcard-field" style={{ background: d.tone }} />
      )}
      <span aria-hidden="true" className="wcard-scrim" />
      <div className="wcard-body">
        <span className="wcard-score">{d.score.toFixed(1)}</span>
        <h3 className="wcard-name">{d.dish}</h3>
        <p className="wcard-meta">
          {d.cuisine} · {d.area}
        </p>
        <p className="wcard-price">{d.price}</p>
      </div>
    </article>
  )
}

export default function ProblemWall() {
  const ref = useRef<HTMLElement | null>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  // The plane arrives: tilted away and sunk at the top of the section,
  // face-on by a quarter of the way through.
  const rotateX = useTransform(scrollYProgress, [0, 0.24], [34, 0])
  const planeY = useTransform(scrollYProgress, [0, 0.24], [-72, 0])
  const planeScale = useTransform(scrollYProgress, [0, 0.24], [0.82, 1])

  const introOpacity = useTransform(scrollYProgress, [0.16, 0.3], [1, 0])
  const introY = useTransform(scrollYProgress, [0.16, 0.3], [0, -20])

  return (
    <section ref={ref} className="wall-section">
      <div className="wall-sticky">
        <div className="wall-perspective">
          <motion.div
            className="wall-plane"
            style={reduce ? undefined : { rotateX, y: planeY, scale: planeScale }}
          >
            {ROWS.map((row, r) => (
              <div key={r} className="wall-row" data-dir={r % 2 ? 'rtl' : 'ltr'}>
                <div className="wall-track" style={{ ['--rowdur' as string]: `${46 + r * 9}s` }}>
                  {/* Twice, so a -50% translate loops without a seam. */}
                  {[0, 1].map((dup) => (
                    <div key={dup} className="wall-set" aria-hidden={dup === 1}>
                      {row.map((card, i) => (
                        <PosterCard key={`${r}-${dup}-${i}`} card={card} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
          {/* The dark the plane recedes into. */}
          <span aria-hidden="true" className="wall-haze" />
        </div>

        <motion.div
          className="wall-copy"
          style={reduce ? undefined : { opacity: introOpacity, y: introY }}
        >
          <h2 className="wall-line">Too many options.</h2>
          <p className="wall-sub">
            Every one of them open, rated and plausible. That is the problem.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
