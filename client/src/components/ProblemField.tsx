import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { RESTAURANT_NAMES } from '../lib/restaurantNames'

/**
 * THE PROBLEM, acted out rather than described.
 *
 * A dense field of real restaurant names drifts behind the copy, contracts as
 * the section is scrolled, and resolves into three. The names are texture, not
 * data: see lib/restaurantNames.ts.
 *
 * ⚠️ NO NUMBERS LIVE IN THIS SECTION, and none may be added. The size of our
 * catalogue is not the size of Dubai's restaurant scene, so any count printed
 * here — "580", "hundreds of", "every restaurant in Dubai" — would be a claim
 * we cannot support. The field says "too many" by being too many to read.
 *
 * PERFORMANCE SHAPE, which is the whole reason it is built this way:
 * roughly a hundred names are on screen, and animating a hundred elements per
 * frame would not hold 60fps on a phone. So the names are split across five
 * LAYERS, and only the five layer wrappers are driven by scroll — five
 * transform writes a frame, not a hundred. Drift is a CSS keyframe on an inner
 * wrapper (a separate element, so the two transforms never fight), and the
 * per-name fade is one class flip with CSS transitions, not a per-item spring.
 */

const LAYERS = 5
const PER_LAYER = 22

/** Deterministic, so the field is identical on every render and every reload. */
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

type Item = { name: string; left: number; top: number; size: number }

/**
 * A jittered grid rather than pure random placement: pure random piles names
 * on top of each other and leaves holes, which reads as a bug rather than as a
 * crowd.
 */
function buildLayers(): Item[][] {
  const rng = makeRng(0x3bda51)
  const cols = 4
  const rows = Math.ceil(PER_LAYER / cols)
  const layers: Item[][] = []
  let n = 0

  for (let l = 0; l < LAYERS; l++) {
    const items: Item[] = []
    for (let i = 0; i < PER_LAYER; i++) {
      const c = i % cols
      const r = Math.floor(i / cols)
      items.push({
        name: RESTAURANT_NAMES[n++ % RESTAURANT_NAMES.length],
        left: (c / cols) * 100 + (rng() * 26 - 9),
        // (rows - 1) so the last row lands ON 100% rather than at 5/6 of it,
        // which left the bottom of the screen visibly thinning out — and a
        // crowd that runs out before the edge stops reading as a crowd.
        top: (r / (rows - 1)) * 100 + (rng() * 18 - 9),
        // Deeper layers sit smaller, so the field has depth instead of being
        // one flat wall of type.
        size: 0.72 + rng() * 0.5 - l * 0.045,
      })
    }
    layers.push(items)
  }
  return layers
}

const LAYER_DATA = buildLayers()

/** The three that survive. Real rows, chosen for length so the stack is even. */
const SURVIVORS = ['Arabian Tea House', 'Social House', 'Pier 7']

export default function ProblemField() {
  const ref = useRef<HTMLDivElement | null>(null)
  const reduce = useReducedMotion()

  // 'start start' -> 'end end' maps progress onto EXACTLY the window where the
  // sticky child is held: 0 when the section's top reaches the top of the
  // viewport, 1 when its bottom reaches the bottom. ('start end' -> 'end start'
  // spans the approach and the exit too, which squeezed the whole sequence
  // into the middle third and had the field finished before it was on screen.)
  // No pinning and no scroll hijacking: the page scrolls natively and we only
  // read how far it got.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  // The field contracts toward the middle and dims out across the middle of
  // the scroll, so the condensing happens while the section is on screen.
  // The beats are sequential, not stacked: the field is dense and legible
  // before anything moves, contracts through the middle, and is gone by the
  // time the answer arrives. "Too many options." leaves as the answer enters,
  // so the two lines are never on screen together contradicting each other.
  const fieldScale = useTransform(scrollYProgress, [0.08, 0.62], [1, 0.4])
  const fieldOpacity = useTransform(scrollYProgress, [0.1, 0.3, 0.6], [1, 1, 0])
  // Visible from the first frame of the section and driven out by scroll
  // alone. It deliberately has NO whileInView entrance: a MotionValue in
  // `style` wins over a variant animation, so the two would have fought over
  // opacity and the entrance would simply never have played.
  const askOpacity = useTransform(scrollYProgress, [0.46, 0.6], [1, 0])
  const askY = useTransform(scrollYProgress, [0.46, 0.6], [0, -22])
  // Deliberately NOT a filter: blur() here. An animated blur over a
  // viewport-sized element re-rasters the whole layer every frame, which is
  // the single most reliable way to drop below 60fps on an iPhone. Scale and
  // opacity carry the condensing on their own, and stay on the compositor.

  const answerOpacity = useTransform(scrollYProgress, [0.6, 0.74], [0, 1])
  const answerY = useTransform(scrollYProgress, [0.6, 0.74], [26, 0])

  return (
    <section ref={ref} className="problem-section">
      <div className="problem-sticky">
        {/* ---------- the field ---------- */}
        <motion.div
          aria-hidden="true"
          className="problem-field"
          style={
            reduce
              ? undefined
              : { scale: fieldScale, opacity: fieldOpacity }
          }
        >
          {LAYER_DATA.map((items, l) => (
            <div key={l} className="problem-layer" data-drift={l % 3}>
              {items.map((it, i) => (
                <span
                  key={`${l}-${i}`}
                  className="problem-name"
                  style={{
                    left: `${it.left}%`,
                    top: `${it.top}%`,
                    fontSize: `${it.size}rem`,
                    opacity: 0.19 + (LAYERS - l) * 0.085,
                  }}
                >
                  {it.name}
                </span>
              ))}
            </div>
          ))}
        </motion.div>

        {/* ---------- the copy ---------- */}
        <div className="problem-copy">
          <motion.h2
            className="problem-line"
            style={reduce ? undefined : { opacity: askOpacity, y: askY }}
          >
            Too many options.
          </motion.h2>

          <motion.div
            className="problem-answer"
            style={reduce ? undefined : { opacity: answerOpacity, y: answerY }}
          >
            <div className="problem-survivors">
              {SURVIVORS.map((name, i) => (
                <span key={name} className="problem-survivor" style={{ transitionDelay: `${i * 60}ms` }}>
                  {name}
                </span>
              ))}
            </div>
            <p className="problem-line problem-line-answer">Exactly 3 answers.</p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
