import { useRef, useState } from 'react'
import { useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import ResultCardMini from '../ResultCardMini'
import { DISHES } from '../../lib/dishes'

/**
 * PROBLEM B — the grid collapses.
 *
 * A dense grid of real catalogue rows fills the screen. Scrolling ripples it
 * from the outside in, the cards sweep toward the centre and go, and three are
 * left to grow into full result cards.
 *
 * ⚠️ NO COUNT APPEARS HERE and none may be added. The grid is a SAMPLE, not a
 * census: the catalogue's size is not the size of Dubai's restaurant scene, so
 * "X restaurants" in this section would be a claim we cannot support. Density
 * carries the meaning on its own.
 *
 * PERFORMANCE — why this is three class flips and not a scroll binding:
 * thirty-odd cards cannot each be driven from JS every frame on a phone. Each
 * card instead owns a STATIC transform target and a STATIC transition-delay
 * derived from its distance to the centre, both set once at mount. Scroll only
 * flips a stage on the container; the compositor runs the rest. The ripple IS
 * the delay function, and the spring IS the easing curve — a back-out cubic
 * that overshoots a little and settles, so the cards arrive with weight.
 */

/*
 * TWO columns on a phone, not four. Four fitted more cards on screen and made
 * every one of them unreadable — "Arabian Tea House" rendered as "Ara…", which
 * is not a restaurant card, it is a grey rectangle with an ellipsis. Density
 * is worth nothing if the thing being counted cannot be read. Desktop widens
 * to four in CSS; the row count is what keeps the field full either way.
 */
const COLS = 2
const ROWS = 9
const TOTAL = COLS * ROWS
/** Middle of the grid, so the three that survive are the ones under your eye. */
const KEEP = [8, 10, 12]

/** Generic dish rows — the zero-risk rule keeps real venues out of marketing. */
function dishCard(i: number) {
  const d = DISHES[i]
  return { n: d.dish, c: d.cuisine, a: d.area }
}

type Stage = 'dense' | 'collapsing' | 'resolved'

export default function ProblemGrid() {
  const ref = useRef<HTMLElement | null>(null)
  const reduce = useReducedMotion()
  const [stage, setStage] = useState<Stage>('dense')

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const next: Stage = p > 0.58 ? 'resolved' : p > 0.22 ? 'collapsing' : 'dense'
    setStage((s) => (s === next ? s : next))
  })

  const cards = Array.from({ length: TOTAL }, (_, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    // Distance from the grid's centre, normalised. It decides two things: how
    // far a card travels inward, and when it leaves — which is the ripple.
    const dx = col - (COLS - 1) / 2
    const dy = row - (ROWS - 1) / 2
    const dist = Math.hypot(dx / COLS, dy / ROWS)
    const keepIndex = KEEP.indexOf(i)
    return {
      i,
      card: dishCard((i * 7) % DISHES.length),
      keep: keepIndex >= 0,
      keepIndex,
      // Outermost cards leave first, so the collapse reads as a wave arriving
      // at the centre rather than everything vanishing at once.
      delay: Math.round((0.52 - dist) * 460),
      tx: -dx * 26,
      ty: -dy * 22,
    }
  })

  return (
    <section ref={ref} className="grid-section">
      <div className="grid-sticky" data-stage={reduce ? 'resolved' : stage}>
        <div className="grid-field">
          {cards.map((c) => (
            <div
              key={c.i}
              className="grid-cell"
              data-keep={c.keep ? 'yes' : 'no'}
              style={{
                ['--tx' as string]: `${c.tx}px`,
                ['--ty' as string]: `${c.ty}px`,
                ['--d' as string]: `${Math.max(0, c.delay)}ms`,
                ['--k' as string]: String(c.keepIndex),
              }}
            >
              {/* Text-only until the collapse resolves, then the survivors
                  take the app's full card shape — rank panel and all. */}
              <ResultCardMini
                card={c.card}
                size="sm"
                textOnly={!(c.keep && stage === 'resolved')}
                rank={c.keep ? c.keepIndex + 1 : undefined}
              />
            </div>
          ))}
        </div>

        <div className="grid-copy">
          <h2 className="grid-line">
            {stage === 'resolved' ? 'Exactly 3 answers.' : 'Too many options.'}
          </h2>
          <p className="grid-sub">
            {stage === 'resolved'
              ? 'Chosen for where you are, what you feel like, and what you usually spend.'
              : 'Every one of them open, rated and plausible. That is the problem.'}
          </p>
        </div>
      </div>
    </section>
  )
}
