import { useEffect, useRef, useState } from 'react'
import { DISHES, SURVIVOR_INDEXES, type Dish } from '../../lib/dishes'
import { prefersReducedMotion } from '../../lib/reveal'
import { cuisineTone, metaLine, priceLabel, type LivePick } from '../../lib/live'
import { useShowcase } from '../../lib/useShowcase'

/**
 * THE PROBLEM — a wall of appetite.
 *
 * A mixed-size poster wall of generic dishes drifts in opposite directions,
 * row by row. When the section is ~40% in view the whole collapse plays on
 * a FIXED ~4.5s timeline — the plane flattens toward the viewer, then the
 * Spend / Nearby / Your taste waves, the red scan, and the 3 survivors, at
 * the same speed for everyone. It used to be scroll-linked, which read as
 * broken at any scroll speed but the author's.
 *
 * The section is ONE viewport tall and never pins or hijacks the scroll:
 * the story plays in place, and a user who scrolls past before it finishes
 * gets the final state the moment the section leaves view. Plays once per
 * visit (module flag); reduced motion renders the final state outright.
 *
 * ⚠️ ZERO-RISK: every card is a DISH, never a venue (src/lib/dishes.ts). The
 * photos are licensed Pexels stock credited in client/ASSET_CREDITS.md, used
 * as generic cuisine imagery. No counts appear anywhere in this section — the
 * wall says "too many" by drifting off both edges, not by quoting a number.
 *
 * PERFORMANCE SHAPE:
 * - Row drift is a CSS keyframe on each track (transform only, GPU), with the
 *   track content duplicated so a -50% translate loops seamlessly.
 * - The timeline is five setTimeout class flips; every transition under them
 *   runs in CSS on the compositor. Nothing runs per frame in JS.
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

/**
 * The fixed timeline, ms from trigger. t=0 is the plane starting to flatten
 * (its 950ms CSS transition); each wave gets a readable beat; ~4.5s to the
 * resolve, whose own transitions carry the last half-second.
 */
const TIMELINE: [Stage, number][] = [
  ['budget', 1200],
  ['nearby', 2100],
  ['taste', 3000],
  ['scan', 3800],
  ['resolved', 4500],
]

/** Play-once per visit. Module scope: survives remounts, dies on reload. */
let wallPlayed = false

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

/** Choreography flags for live rows: a mix for the waves, a few survivors. */
const LIVE_FLAGS: Flag[] = ['taste', 'budget', 'nearby', 'keep', 'nearby', 'budget', 'taste']

/** Which colour-field (md/sm) slot each ROWS position is — the real-name
 *  slots, assigned identically across the duplicated track halves. */
const MDSM_INDEX: Record<string, number> = {}
{
  let n = 0
  ROWS.forEach((row, r) =>
    row.forEach((c, i) => {
      if (c.size !== 'lg') MDSM_INDEX[`${r}-${i}`] = n++
    }),
  )
}

function PosterCard({
  card,
  delay,
  live,
  liveIndex,
}: {
  card: WallCard
  delay: number
  /** Real restaurant for this slot (md/sm sizes while the API answers). */
  live?: LivePick | null
  liveIndex?: number
  }) {
  const d = card.dish

  if (live) {
    // ⚠️ A real restaurant: real name, real facts, NO stock photo, NO
    // invented score — a colour field in its cuisine's tone.
    return (
      <article
        className={`wcard wcard-${card.size} f-${LIVE_FLAGS[(liveIndex ?? 0) % LIVE_FLAGS.length]}`}
        style={{ ['--wd' as string]: `${delay}ms` }}
      >
        <span
          aria-hidden="true"
          className="wcard-field"
          style={{ background: cuisineTone(live.cuisine) }}
        />
        <span aria-hidden="true" className="wcard-scrim" />
        <div className="wcard-body">
          <h3 className="wcard-name">{live.name}</h3>
          <p className="wcard-meta">
            {live.cuisine} · {live.area}
          </p>
          {priceLabel(live) ? <p className="wcard-price">{priceLabel(live)}</p> : null}
        </div>
      </article>
    )
  }

  // ⚠️ Stock photo tiles are texture, not picks: labelled by CUISINE
  // alone — no dish name, no price, no score — in every state.
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
        <h3 className="wcard-name">{d.cuisine}</h3>
      </div>
    </article>
  )
}

export default function ProblemWall() {
  const ref = useRef<HTMLElement | null>(null)
  const [reduce] = useState(prefersReducedMotion)
  // Always REAL restaurants: the build-time snapshot first, the live
  // answer when it arrives. Dishes never appear as picks or wall entries.
  const { data: showcase } = useShowcase()
  const liveWall = showcase.wall
  const finals = showcase.picks.map((p) => ({
    name: p.name,
    meta: metaLine(p),
    reason: p.reason,
    score: p.rating != null ? `★ ${p.rating.toFixed(1)} · Google` : null,
  }))
  const [stage, setStage] = useState<Stage>(() =>
    reduce || wallPlayed ? 'resolved' : 'wall',
  )
  const [play, setPlay] = useState(() => reduce || wallPlayed)
  const timersRef = useRef<number[]>([])

  // The trigger: ~40% of the section in view starts the fixed timeline,
  // once. Leaving view mid-story (scrolled past, or back up) lands it on
  // the final state — nobody can ever see it stuck between waves.
  useEffect(() => {
    if (reduce || wallPlayed) return
    const sec = ref.current
    if (!sec) return
    let playing = false
    let done = false
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (!e || done) return
        if (!playing && e.intersectionRatio >= 0.4) {
          playing = true
          wallPlayed = true
          setPlay(true)
          for (const [st, at] of TIMELINE) {
            timersRef.current.push(
              window.setTimeout(() => {
                setStage(st)
                if (st === 'resolved') {
                  done = true
                  io.disconnect()
                }
              }, at),
            )
          }
        } else if (playing && !e.isIntersecting) {
          done = true
          for (const t of timersRef.current) window.clearTimeout(t)
          setStage('resolved')
          io.disconnect()
        }
      },
      { threshold: [0, 0.4] },
    )
    io.observe(sec)
    return () => {
      io.disconnect()
      for (const t of timersRef.current) window.clearTimeout(t)
    }
  }, [reduce])

  return (
    <section ref={ref} className="wall-section">
      <div className="wall-sticky" data-stage={stage} data-play={play ? 'yes' : 'no'}>
        <div className="wall-perspective">
          <div className="wall-plane">
            {ROWS.map((row, r) => (
              <div key={r} className="wall-row" data-dir={r % 2 ? 'rtl' : 'ltr'}>
                <div className="wall-track" style={{ ['--rowdur' as string]: `${46 + r * 9}s` }}>
                  {/* Twice, so a -50% translate loops without a seam. */}
                  {[0, 1].map((dup) => (
                    <div key={dup} className="wall-set" aria-hidden={dup === 1}>
                      {row.map((card, i) => (
                        <PosterCard
                          key={`${r}-${dup}-${i}`}
                          card={card}
                          delay={(r * 5 + i) * 40}
                          live={
                            liveWall && MDSM_INDEX[`${r}-${i}`] !== undefined
                              ? liveWall[MDSM_INDEX[`${r}-${i}`] % liveWall.length]
                              : null
                          }
                          liveIndex={
                            liveWall ? (MDSM_INDEX[`${r}-${i}`] ?? r * 5 + i) : undefined
                          }
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* The dark the plane recedes into. */}
          <span aria-hidden="true" className="wall-haze" />
        </div>

        {/* Fades out (CSS) the moment the first wave lands. */}
        <div className="wall-copy">
          <h2 className="wall-line">Too many options.</h2>
          <p className="wall-sub">
            All of them open. All of them plausible.
          </p>
        </div>

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
          <h2 className="wall-line wall-line-final">
            Exactly <b>3</b> answers.
          </h2>
          <div className="wall-final-cards">
            {finals.map((f, i) => (
              <article key={i} className="fcard" style={{ ['--fd' as string]: `${i * 90}ms` }}>
                <span className="fcard-rank">{i + 1}</span>
                <div className="fcard-body">
                  <h3 className="fcard-name">{f.name}</h3>
                  <p className="fcard-meta">{f.meta}</p>
                  <span className="fcard-reason">{f.reason}</span>
                </div>
                {f.score ? <span className="fcard-score">{f.score}</span> : null}
              </article>
            ))}
          </div>
          <p className="wall-sub wall-sub-final">
            Where you are. What you feel like. What you spend.
          </p>
        </div>
      </div>
    </section>
  )
}
