import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
} from 'motion/react'
import { RotateCcw } from 'lucide-react'
import { DISHES, type Dish } from '../lib/dishes'
import {
  DEMO_AREAS,
  demoPhotoUrl,
  getDemo,
  metaLine,
  cuisineTone,
  type DemoResult,
} from '../lib/live'
import { useShowcase } from '../lib/useShowcase'
import VenueNote from './VenueNote'

/**
 * THE LIVE DEMO — the page's one truly interactive moment, now genuinely
 * live: tap an AREA chip (Marina, Downtown, JLT, DIFC, Business Bay, JBR)
 * and the production engine answers with three REAL restaurants — real
 * names, real Google ratings (attributed), real prices when the catalogue
 * holds one, and the engine's own anonymous reason lines. Nothing here is
 * invented, and nothing here writes anything: the public endpoint is
 * read-only, rate-limited, and excluded from analytics and taste learning.
 *
 * PHOTOS: this is the only section allowed live restaurant photos. Each
 * card asks our server for ONE ~400px image; the server fetches a fresh
 * photo name from Google per request (names may not be cached) and the
 * card shows the required attribution — "Google" plus the photo author.
 * Any failure (or the server's 900/day photo cap) falls back to the
 * cuisine colour field; a broken image can never render.
 *
 * FALLBACK: when the API is unreachable the section becomes exactly the
 * old zero-risk demo — mood chips over generic dishes with stock photos.
 *
 * Reduced motion: no morph, no springs, no drag — chips become a static
 * list of three results on tap, and a plain button advances them.
 */

type Mood = {
  label: string
  filter: (d: Dish) => boolean
}

const MOODS: Mood[] = [
  { label: 'Quick and cheap', filter: (d) => maxPrice(d) <= 45 },
  { label: 'Date night', filter: (d) => maxPrice(d) >= 90 },
  { label: 'Comfort food', filter: (d) => ['American', 'Italian', 'Pakistani', 'Indian'].includes(d.cuisine) },
  { label: 'Healthy-ish', filter: (d) => d.cuisine === 'Healthy' || d.cuisine === 'Japanese' },
  { label: 'Something new', filter: (d) => ['Vietnamese', 'Jordanian', 'Emirati', 'Thai'].includes(d.cuisine) },
]

function maxPrice(d: Dish): number {
  return Number(d.price.match(/(\d+)\s*$/)?.[1] ?? 0)
}

/** Top 3 by score within the mood; the whole pool ranked as fallback. */
function decideThree(mood: Mood): Dish[] {
  const pool = DISHES.filter(mood.filter)
  const ranked = [...(pool.length >= 3 ? pool : DISHES)].sort((a, b) => b.score - a.score)
  return ranked.slice(0, 3)
}

/** One deck card, from either world. */
type DemoCard = {
  key: string
  name: string
  meta: string
  reason: string
  /** "★ 4.8" (real, Google-attributed on the card) or "9.1" (generic). */
  score: string | null
  /** Live proxy URL or stock dish path; null → colour field. */
  photoSrc: string | null
  /** "Google · {author}" line — required attribution, live photos only. */
  attribution: string | null
  tone: string
}

const dishCard = (d: Dish, mood: Mood): DemoCard => ({
  key: `dish-${d.dish}`,
  name: d.dish,
  meta: `${d.cuisine} · ${d.area} · ${d.price}`,
  reason: mood.label,
  score: d.score.toFixed(1),
  photoSrc: d.photo ? `/brand/dishes/${d.photo}.webp` : null,
  attribution: null,
  tone: d.tone,
})

// No distance in the meta: the engine's reason line already carries it.
const liveCard = (r: DemoResult): DemoCard => ({
  key: `live-${r.id}`,
  name: r.name,
  meta: metaLine(r),
  reason: r.reason,
  score: r.rating != null ? `★ ${r.rating.toFixed(1)}` : null,
  photoSrc: r.hasPhoto && r.placeId ? demoPhotoUrl(r.placeId) : null,
  attribution:
    r.hasPhoto ? (r.photoAuthor?.name ? `Google · ${r.photoAuthor.name}` : 'Google') : null,
  tone: cuisineTone(r.cuisine),
})

const SPRING = { type: 'spring', duration: 0.55, bounce: 0.24 } as const

type Chip = { key: string; label: string }

export default function DemoSection() {
  const reduce = useReducedMotion() ?? false
  const showcase = useShowcase()
  // Area chips unless the API has already proven unreachable — the old
  // mood demo is the fallback, not the default.
  const liveMode = showcase.status !== 'fallback'

  const [chip, setChip] = useState<Chip | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [picks, setPicks] = useState<DemoCard[]>([])
  const [isLiveResult, setIsLiveResult] = useState(false)
  const [gone, setGone] = useState(0)
  const decideTimer = useRef(0)

  useEffect(() => () => window.clearTimeout(decideTimer.current), [])

  const chips: Chip[] = liveMode
    ? DEMO_AREAS.map((a) => ({ key: a.key, label: a.label }))
    : MOODS.map((m) => ({ key: m.label, label: m.label }))

  const moodFallback = (label?: string): { cards: DemoCard[]; live: boolean } => {
    const mood = MOODS.find((m) => m.label === label) ?? MOODS[0]
    return { cards: decideThree(mood).map((d) => dishCard(d, mood)), live: false }
  }

  const choose = (c: Chip) => {
    if (deciding) return
    setChip(c)
    setGone(0)
    setPicks([])
    setDeciding(true)
    // The "Deciding" beat doubles as the fetch window: long enough to read
    // as thought, and the engine's answer is usually back well inside it.
    const beat = new Promise<void>((res) => {
      decideTimer.current = window.setTimeout(res, reduce ? 80 : 900)
    })
    const data = liveMode ? getDemo(c.key) : Promise.resolve(null)
    Promise.all([data, beat]).then(([payload]) => {
      const out =
        liveMode && payload
          ? { cards: payload.results.map(liveCard), live: true }
          : moodFallback(liveMode ? undefined : c.key)
      setPicks(out.cards)
      setIsLiveResult(out.live)
      setDeciding(false)
    })
  }

  const reset = () => {
    window.clearTimeout(decideTimer.current)
    setChip(null)
    setPicks([])
    setGone(0)
    setDeciding(false)
  }

  const dismissTop = () => setGone((n) => n + 1)
  const remaining = picks.slice(gone)
  const done = chip !== null && !deciding && remaining.length === 0

  return (
    <section className="demo-section" id="demo">
      <div className="demo-head">
        <h2 className="demo-title">{liveMode ? 'Try it. Pick an area.' : 'Try it. Tap a mood.'}</h2>
        <p className="demo-sub">One tap in. Exactly 3 out.</p>
      </div>

      <div className="demo-stage" data-state={chip ? (deciding ? 'deciding' : 'results') : 'chips'}>
        {/* ---- the chips ---- */}
        <AnimatePresence>
          {chip === null ? (
            <motion.div
              key="chips"
              className="demo-chips"
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
            >
              {chips.map((c) => (
                <motion.button
                  key={c.key}
                  type="button"
                  className="demo-chip"
                  layoutId={reduce ? undefined : `chip-${c.key}`}
                  onClick={() => choose(c)}
                  whileTap={reduce ? undefined : { scale: 0.95 }}
                  transition={SPRING}
                >
                  {c.label}
                </motion.button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ---- the deciding beat ---- */}
        <AnimatePresence>
          {deciding && chip ? (
            <motion.div
              key="deciding"
              className="demo-deciding"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                className="demo-chip demo-chip-active"
                layoutId={reduce ? undefined : `chip-${chip.key}`}
                transition={SPRING}
              >
                {chip.label}
              </motion.span>
              <span className="ps-dots demo-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ---- the three ---- */}
        {chip && !deciding ? (
          <div className="demo-deck">
            <AnimatePresence>
              {remaining
                .map((card, i) => ({ card, depth: i, rank: gone + i + 1 }))
                .slice(0, 3)
                .reverse()
                .map(({ card, depth, rank }) => (
                  <DeckCard
                    key={card.key}
                    card={card}
                    rank={rank}
                    depth={depth}
                    chip={chip}
                    reduce={reduce}
                    onDismiss={dismissTop}
                  />
                ))}
            </AnimatePresence>

            {done ? (
              <motion.div
                className="demo-done"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING}
              >
                <p>That was the whole decision.</p>
                <button type="button" className="demo-reset" onClick={reset}>
                  <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
                  {liveMode ? 'Try another area' : 'Try another mood'}
                </button>
              </motion.div>
            ) : null}
          </div>
        ) : null}
      </div>

      {chip && !deciding && !done ? (
        <div className="demo-footrow">
          <p className="demo-hint">Swipe a card either way to pass it</p>
          <button type="button" className="demo-reset demo-reset-quiet" onClick={reset}>
            <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
            Start over
          </button>
        </div>
      ) : null}

      {isLiveResult || liveMode ? <VenueNote /> : null}
    </section>
  )
}

function DeckCard({
  card,
  rank,
  depth,
  chip,
  reduce,
  onDismiss,
}: {
  card: DemoCard
  rank: number
  depth: number
  chip: Chip
  reduce: boolean
  onDismiss: () => void
}) {
  const top = depth === 0

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 110 || Math.abs(info.velocity.x) > 500) {
      onDismiss()
    }
  }

  if (reduce) {
    return (
      <div className="demo-card demo-card-static">
        <CardFace card={card} rank={rank} />
        {top ? (
          <button type="button" className="demo-reset" onClick={onDismiss}>
            Next
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <motion.div
      className="demo-card"
      style={{ zIndex: 10 - depth, touchAction: 'pan-y' }}
      layoutId={rank === 1 ? `chip-${chip.key}` : undefined}
      initial={rank === 1 ? undefined : { opacity: 0, y: 46, scale: 0.92 }}
      animate={{
        opacity: 1,
        y: depth * -14,
        scale: 1 - depth * 0.05,
        transition: { ...SPRING, delay: rank === 1 ? 0 : 0.12 * (rank - 1) },
      }}
      exit={{ opacity: 0, transition: { duration: 0.22 } }}
      drag={top ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.7}
      onDragEnd={top ? onDragEnd : undefined}
      whileDrag={{ scale: 1.03 }}
    >
      <CardFace card={card} rank={rank} />
    </motion.div>
  )
}

function CardFace({ card, rank }: { card: DemoCard; rank: number }) {
  // A live photo that fails (expired, capped, offline) must become the
  // cuisine colour field — a broken image can never render.
  const [photoFailed, setPhotoFailed] = useState(false)
  const showPhoto = card.photoSrc !== null && !photoFailed

  return (
    <>
      {showPhoto ? (
        <img
          src={card.photoSrc!}
          alt=""
          className="demo-card-photo"
          width={400}
          height={400}
          loading="lazy"
          decoding="async"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <span className="demo-card-field" style={{ background: card.tone }} aria-hidden="true" />
      )}
      <span className="demo-card-scrim" aria-hidden="true" />
      <span className="demo-card-rank">{rank}</span>
      {card.score ? (
        <span className="demo-card-score">
          {card.score}
          {/* Live ratings carry their attribution on the pill unless the
              photo's own Google line is already on the card. */}
          {card.attribution === null && card.key.startsWith('live-') ? ' · Google' : ''}
        </span>
      ) : null}
      {showPhoto && card.attribution ? (
        <span className="demo-card-attr">{card.attribution}</span>
      ) : null}
      <div className="demo-card-body">
        <h3>{card.name}</h3>
        <p>{card.meta}</p>
        <em>{card.reason}</em>
      </div>
    </>
  )
}
