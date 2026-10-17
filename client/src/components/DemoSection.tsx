import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
} from 'motion/react'
import { RotateCcw } from 'lucide-react'
import { DISHES, type Dish } from '../lib/dishes'

/**
 * THE LIVE DEMO — the page's one truly interactive moment.
 *
 * Tap a mood chip and it MORPHS into the first of three result cards (a
 * shared layoutId carries the chip's own pill across the transition), with
 * the other two springing in behind it after a short "Deciding" beat. The
 * top card is swipeable with real physics — drag it, flick it, and it flies
 * off with your velocity while the next card scales up to take its place.
 * Swipe through all three and the demo offers the next mood.
 *
 * ⚠️ ZERO-RISK: everything served is a generic dish from src/lib/dishes.ts.
 * No venues, no third-party marks, no network — the engine here is a simple
 * client-side scorer standing in for the real one.
 *
 * Reduced motion: no morph, no springs, no drag — chips become a static list
 * of three results on tap, and a plain button advances them.
 */

type Mood = {
  label: string
  /** Pick dishes whose character fits the mood — deterministic, no RNG. */
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

const SPRING = { type: 'spring', duration: 0.55, bounce: 0.24 } as const

export default function DemoSection() {
  const reduce = useReducedMotion() ?? false
  const [mood, setMood] = useState<Mood | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [picks, setPicks] = useState<Dish[]>([])
  const [gone, setGone] = useState(0)
  const decideTimer = useRef(0)

  useEffect(() => () => window.clearTimeout(decideTimer.current), [])

  const choose = (m: Mood) => {
    if (deciding) return
    setMood(m)
    setGone(0)
    setPicks([])
    setDeciding(true)
    // The "Deciding" beat: long enough to read as thought, short enough to
    // never feel like a spinner.
    decideTimer.current = window.setTimeout(
      () => {
        setPicks(decideThree(m))
        setDeciding(false)
      },
      reduce ? 80 : 900,
    )
  }

  const reset = () => {
    window.clearTimeout(decideTimer.current)
    setMood(null)
    setPicks([])
    setGone(0)
    setDeciding(false)
  }

  const dismissTop = () => setGone((n) => n + 1)
  const remaining = picks.slice(gone)
  const done = mood !== null && !deciding && remaining.length === 0

  return (
    <section className="demo-section" id="demo">
      <div className="demo-head">
        <h2 className="demo-title">Try it. Tap a mood.</h2>
        <p className="demo-sub">
          One tap in. Exactly 3 out.
        </p>
      </div>

      <div className="demo-stage" data-state={mood ? (deciding ? 'deciding' : 'results') : 'chips'}>
        {/* ---- the chips ---- */}
        <AnimatePresence>
          {mood === null ? (
            <motion.div
              key="chips"
              className="demo-chips"
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
            >
              {MOODS.map((m) => (
                <motion.button
                  key={m.label}
                  type="button"
                  className="demo-chip"
                  layoutId={reduce ? undefined : `chip-${m.label}`}
                  onClick={() => choose(m)}
                  whileTap={reduce ? undefined : { scale: 0.95 }}
                  transition={SPRING}
                >
                  {m.label}
                </motion.button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ---- the deciding beat ---- */}
        <AnimatePresence>
          {deciding && mood ? (
            <motion.div
              key="deciding"
              className="demo-deciding"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* The tapped chip lands here mid-morph: same layoutId. */}
              <motion.span
                className="demo-chip demo-chip-active"
                layoutId={reduce ? undefined : `chip-${mood.label}`}
                transition={SPRING}
              >
                {mood.label}
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
        {mood && !deciding ? (
          <div className="demo-deck">
            <AnimatePresence>
              {remaining
                .map((d, i) => ({ d, depth: i, rank: gone + i + 1 }))
                .slice(0, 3)
                .reverse()
                .map(({ d, depth, rank }) => (
                  <DeckCard
                    key={d.dish}
                    dish={d}
                    rank={rank}
                    depth={depth}
                    mood={mood}
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
                  Try another mood
                </button>
              </motion.div>
            ) : null}
          </div>
        ) : null}
      </div>

      {mood && !deciding && !done ? (
        <div className="demo-footrow">
          <p className="demo-hint">Swipe a card either way to pass it</p>
          <button type="button" className="demo-reset demo-reset-quiet" onClick={reset}>
            <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
            Start over
          </button>
        </div>
      ) : null}
    </section>
  )
}

function DeckCard({
  dish,
  rank,
  depth,
  mood,
  reduce,
  onDismiss,
}: {
  dish: Dish
  rank: number
  depth: number
  mood: Mood
  reduce: boolean
  onDismiss: () => void
}) {
  const top = depth === 0

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // Momentum dismissal: a long drag OR a quick flick both count.
    if (Math.abs(info.offset.x) > 110 || Math.abs(info.velocity.x) > 500) {
      onDismiss()
    }
  }

  if (reduce) {
    // Static list form: no stacking, no drag; a button advances.
    return (
      <div className="demo-card demo-card-static">
        <CardFace dish={dish} rank={rank} mood={mood} />
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
      // The first card morphs FROM the tapped chip (shared layoutId).
      layoutId={rank === 1 ? `chip-${mood.label}` : undefined}
      initial={rank === 1 ? undefined : { opacity: 0, y: 46, scale: 0.92 }}
      animate={{
        opacity: 1,
        y: depth * -14,
        scale: 1 - depth * 0.05,
        transition: { ...SPRING, delay: rank === 1 ? 0 : 0.12 * (rank - 1) },
      }}
      exit={{
        // Leaves with the drag's direction; x is wherever the drag put it.
        opacity: 0,
        transition: { duration: 0.22 },
      }}
      drag={top ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.7}
      onDragEnd={top ? onDragEnd : undefined}
      whileDrag={{ scale: 1.03 }}
    >
      <CardFace dish={dish} rank={rank} mood={mood} />
    </motion.div>
  )
}

function CardFace({ dish, rank, mood }: { dish: Dish; rank: number; mood: Mood }) {
  return (
    <>
      {dish.photo ? (
        <img
          src={`/brand/dishes/${dish.photo}.webp`}
          alt=""
          className="demo-card-photo"
          width={800}
          height={600}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="demo-card-field" style={{ background: dish.tone }} aria-hidden="true" />
      )}
      <span className="demo-card-scrim" aria-hidden="true" />
      <span className="demo-card-rank">{rank}</span>
      <span className="demo-card-score">{dish.score.toFixed(1)}</span>
      <div className="demo-card-body">
        <h3>{dish.dish}</h3>
        <p>
          {dish.cuisine} · {dish.area} · {dish.price}
        </p>
        <em>{mood.label}</em>
      </div>
    </>
  )
}
