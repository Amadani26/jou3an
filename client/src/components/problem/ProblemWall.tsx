import { useRef, useState } from 'react'
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react'
import { DISHES, SURVIVOR_INDEXES, SURVIVOR_REASONS, type Dish } from '../../lib/dishes'

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

/**
 * THE COLLAPSE tells the engine's real story: each elimination wave is one of
 * the filters the app actually applies, in the order a brief narrows.
 *
 *   Spend      — out-of-bracket dishes DIM AND DROP BACK, not away: in the
 *                engine spend is a soft score, never a filter, so the wall
 *                must not show it removing anything (review ruling)
 *   Nearby     — far neighbourhoods SWEEP out the side their row drifts
 *   Your taste — what the profile would skip SHRINKS away in place
 *
 * then a red scan passes over what is left and exactly three rise forward.
 * The flags are derived from the dish data itself (price bracket, area), so
 * the story and the cards can never disagree.
 */
type Flag = 'keep' | 'budget' | 'nearby' | 'taste'
type Stage = 'wall' | 'budget' | 'nearby' | 'taste' | 'scan' | 'resolved'

const FAR_AREAS = new Set(['Deira', 'Mirdif', 'Barsha', 'Karama', 'Kite Beach'])
const SURVIVORS = new Set<Dish>(SURVIVOR_INDEXES.map((i) => DISHES[i]))

function flagFor(d: Dish): Flag {
  if (SURVIVORS.has(d)) return 'keep'
  const max = Number(d.price.match(/(\d+)\s*$/)?.[1] ?? 0)
  if (max >= 80) return 'budget'
  if (FAR_AREAS.has(d.area)) return 'nearby'
  return 'taste'
}

const STAGE_LABEL: Partial<Record<Stage, string>> = {
  budget: 'Spend',
  nearby: 'Nearby',
  taste: 'Your taste',
  scan: 'Deciding',
}

function stageOf(p: number): Stage {
  if (p < 0.26) return 'wall'
  if (p < 0.42) return 'budget'
  if (p < 0.56) return 'nearby'
  if (p < 0.68) return 'taste'
  if (p < 0.78) return 'scan'
  return 'resolved'
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

function PosterCard({ card, delay }: { card: WallCard; delay: number }) {
  const d = card.dish
  return (
    <article
      className={`wcard wcard-${card.size} f-${flagFor(d)}`}
      style={{ ['--wd' as string]: `${delay}ms` }}
    >
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
  const [stage, setStage] = useState<Stage>('wall')
  const lockedRef = useRef(false)
  const [locked, setLocked] = useState(false)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  // Discrete stages, not a per-frame binding: the waves are choreography, and
  // every transition below runs on the compositor from one class flip.
  //
  // ⚠️ PLAY ONCE. The first time the collapse resolves, the section LOCKS:
  // the 320svh pin distance is removed in the same frame as a compensating
  // scrollTo, so the viewport does not move a pixel, and from then on the
  // resolved wall is an ordinary 100svh block the user scrolls past in either
  // direction. No replay, no reverse, no re-pin. A reload starts fresh —
  // nothing is persisted, by design.
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (lockedRef.current) return
    const next = stageOf(p)
    if (next === 'resolved') {
      lockedRef.current = true
      const sec = ref.current
      if (sec) {
        const rect = sec.getBoundingClientRect()
        const top = window.scrollY + rect.top
        const oldH = rect.height
        sec.style.height = '100svh'
        const newH = sec.getBoundingClientRect().height
        const dH = oldH - newH
        const S = window.scrollY
        // Keep exactly the same pixels on screen: while the sticky was pinned
        // the right anchor is the section top; past the pin range, everything
        // below simply moved up by dH, so the viewport follows it.
        window.scrollTo(0, S >= top + dH ? S - dH : top)
      }
      setStage('resolved')
      setLocked(true)
      return
    }
    setStage((prev) => (prev === next ? prev : next))
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
      <div className="wall-sticky" data-stage={stage}>
        <div className="wall-perspective">
          <motion.div
            className="wall-plane"
            style={
              locked || reduce
                ? undefined
                : { rotateX, y: planeY, scale: planeScale }
            }
          >
            {ROWS.map((row, r) => (
              <div key={r} className="wall-row" data-dir={r % 2 ? 'rtl' : 'ltr'}>
                <div className="wall-track" style={{ ['--rowdur' as string]: `${46 + r * 9}s` }}>
                  {/* Twice, so a -50% translate loops without a seam. */}
                  {[0, 1].map((dup) => (
                    <div key={dup} className="wall-set" aria-hidden={dup === 1}>
                      {row.map((card, i) => (
                        <PosterCard key={`${r}-${dup}-${i}`} card={card} delay={(r * 5 + i) * 40} />
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
          style={
            locked || reduce
              ? { opacity: 0 }
              : { opacity: introOpacity, y: introY }
          }
        >
          <h2 className="wall-line">Too many options.</h2>
          <p className="wall-sub">
            All of them open. All of them plausible.
          </p>
        </motion.div>

        {/* The filter being applied right now — the engine narrating itself. */}
        {STAGE_LABEL[stage] ? (
          <div key={stage} className="wall-wavechip" data-deciding={stage === 'scan' ? 'yes' : 'no'}>
            {STAGE_LABEL[stage]}
          </div>
        ) : null}

        {/* The scan: one red light passing over what survived. */}
        <span aria-hidden="true" className="wall-scanline" />

        {/* What the engine hands back. A separate layer so three cards can sit
            centred at full size without fighting the marquee's layout. */}
        <div className="wall-final" aria-hidden={stage !== 'resolved'}>
          <h2 className="wall-line wall-line-final">Exactly 3 answers.</h2>
          <div className="wall-final-cards">
            {SURVIVOR_INDEXES.map((di, i) => {
              const d = DISHES[di]
              return (
                <article key={di} className="fcard" style={{ ['--fd' as string]: `${i * 90}ms` }}>
                  <span className="fcard-rank">{i + 1}</span>
                  <div className="fcard-body">
                    <h3 className="fcard-name">{d.dish}</h3>
                    <p className="fcard-meta">
                      {d.cuisine} · {d.area} · {d.price}
                    </p>
                    <span className="fcard-reason">{SURVIVOR_REASONS[i]}</span>
                  </div>
                  <span className="fcard-score">{d.score.toFixed(1)}</span>
                </article>
              )
            })}
          </div>
          <p className="wall-sub wall-sub-final">
            Where you are. What you feel like. What you spend.
          </p>
        </div>
      </div>
    </section>
  )
}
