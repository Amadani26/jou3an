import { useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import ResultCardMini from '../ResultCardMini'
import { CATALOGUE_CARDS } from '../../lib/restaurantCards'

/**
 * PROBLEM A — decision chaos.
 *
 * Schematic cards stack up and overlap the way a stack of half-open apps does
 * while you fail to decide. Then one swipe clears the lot and three clean
 * cards are left standing.
 *
 * ⚠️ THE CHAOS CARDS ARE DELIBERATELY NOT ANYONE'S PRODUCT. Grey blocks and
 * bars, no logos, no colours borrowed from a competitor, no readable names.
 * They stand for "another app, and another" — and a recognisable rival's UI
 * here would be both a legal problem and an advert for them.
 *
 * PERFORMANCE: the pile is a one-shot CSS cascade with per-card delays, so
 * fourteen cards arrive without fourteen animations being driven from JS. Only
 * TWO elements are scroll-driven — the pile and the answer — and the scroll
 * value runs through a spring first, so the clearing swipe carries weight and
 * settles instead of tracking the finger exactly.
 */

const CHAOS_COUNT = 14
const PICKS = CATALOGUE_CARDS.slice(3, 6)

export default function ProblemChaos() {
  const ref = useRef<HTMLElement | null>(null)
  const reduce = useReducedMotion()
  const [cleared, setCleared] = useState(false)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  // A discrete flip, not a per-frame binding: the swipe is choreography, and
  // choreography that re-renders React sixty times a second is just expensive.
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    setCleared(p > 0.42)
  })

  return (
    <section ref={ref} className="chaos-section">
      <div className="chaos-sticky" data-cleared={cleared ? 'yes' : 'no'}>
        <div className="chaos-stage">
          {/* ---- the pile ---- */}
          <div className="chaos-pile" aria-hidden="true">
            {Array.from({ length: CHAOS_COUNT }, (_, i) => (
              <div
                key={i}
                className="chaos-card"
                style={{
                  // Fanned by index: a pile that is merely stacked reads as one
                  // card, and a pile that is evenly spread reads as a grid.
                  ['--i' as string]: String(i),
                  // Spread hard. The first pass fanned by ±16% and fourteen
                  // cards landed almost on top of each other — a tidy stack,
                  // which is the opposite of the feeling being described.
                  ['--rot' as string]: `${(((i * 37) % 17) - 8) * 2.1}deg`,
                  ['--dx' as string]: `${(((i * 53) % 23) - 11) * 5.2}%`,
                  ['--dy' as string]: `${(((i * 29) % 19) - 9) * 4.4}%`,
                }}
              >
                <ResultCardMini schematic size="sm" />
              </div>
            ))}
          </div>

          {/* ---- what is left ---- */}
          <div className="chaos-answer" aria-hidden={!cleared}>
            {PICKS.map((c, i) => (
              <div
                key={c.n}
                className="chaos-keep"
                style={{ transitionDelay: `${160 + i * 70}ms` }}
              >
                <ResultCardMini card={c} rank={i + 1} size="md" />
              </div>
            ))}
          </div>
        </div>

        <div className="chaos-copy">
          <motion.h2 className="chaos-line" initial={false}>
            {cleared ? 'One decision.' : 'Ten, fifteen minutes.'}
          </motion.h2>
          <p className="chaos-sub">
            {cleared
              ? 'Exactly 3 places, chosen for where you are and what you feel like.'
              : 'One app, then another, then the group chat — and you end up where you went last week.'}
          </p>
        </div>

        {reduce ? null : (
          <span aria-hidden="true" className="chaos-swipe-hint" />
        )}
      </div>
    </section>
  )
}
