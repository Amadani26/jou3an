import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { MapPin, Phone, ShoppingBag } from 'lucide-react'
import { DISHES, SURVIVOR_INDEXES } from '../lib/dishes'

/**
 * DECIDE → ACT — the app's payoff moment, performed by the page.
 *
 * The mobile app's SelectionReward is the model: "YOU'RE GOING TO {pick}", a
 * red rule drawing itself under the name, then the three action tiles. The
 * signature move is that entrance — eyebrow, name, rule, tiles, each a beat
 * behind the last — played ONCE when the section first enters the viewport
 * (whileInView + once: the play-once rule for anything scroll-triggered).
 *
 * The tiles are really pressable: spring press feedback and a one-shot red
 * ring on release, because a row of action buttons that ignores taps reads
 * as a mockup. They perform the UI without pretending to be it — tapping
 * navigates nowhere and claims nothing.
 *
 * ⚠️ ZERO-RISK: the pick is a generic dish (the hero's first survivor), the
 * labels are the app's real tile labels, and no third-party name or mark
 * appears — "Order" is a verb, not a brand.
 */

const PICK = DISHES[SURVIVOR_INDEXES[0]]

const TILES = [
  { label: 'Directions', Icon: MapPin },
  { label: 'Call', Icon: Phone },
  { label: 'Order', Icon: ShoppingBag },
] as const

const EASE_OUT = [0.23, 1, 0.32, 1] as const

function ActionTile({
  label,
  Icon,
  reduce,
}: {
  label: string
  Icon: typeof MapPin
  reduce: boolean
}) {
  // Keyed re-mount restarts the ring's CSS animation on every press.
  const [pulse, setPulse] = useState(0)

  return (
    <motion.button
      type="button"
      className="act-tile"
      aria-label={`${label} — demo only`}
      onClick={() => setPulse((n) => n + 1)}
      whileTap={reduce ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', duration: 0.3, bounce: 0.1 }}
    >
      {pulse > 0 ? <span key={pulse} className="act-ring" aria-hidden="true" /> : null}
      <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
    </motion.button>
  )
}

export default function DecideAct() {
  const reduce = useReducedMotion() ?? false

  return (
    <section className="act-section">
      <div className="act-stage">
        <motion.p
          className="act-eyebrow"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-12%' }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          You&apos;re going to
        </motion.p>

        <motion.h2
          className="act-name"
          initial={reduce ? false : { opacity: 0, y: 22, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-12%' }}
          transition={{ type: 'spring', duration: 0.7, bounce: 0.24, delay: 0.1 }}
        >
          {PICK.dish}
        </motion.h2>

        {/* The red rule draws itself under the name — the app's own flourish. */}
        <motion.span
          className="act-rule"
          aria-hidden="true"
          initial={reduce ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: '-12%' }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.28 }}
        />

        <motion.p
          className="act-meta"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-12%' }}
          transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.34 }}
        >
          {PICK.cuisine} · {PICK.area} · {PICK.price}
        </motion.p>

        <div className="act-tiles">
          {TILES.map((t, i) => (
            <motion.div
              key={t.label}
              initial={reduce ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-12%' }}
              transition={{ type: 'spring', duration: 0.55, bounce: 0.22, delay: 0.4 + i * 0.09 }}
            >
              <ActionTile label={t.label} Icon={t.Icon} reduce={reduce} />
            </motion.div>
          ))}
        </div>

        <motion.p
          className="act-sub"
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-12%' }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          Decided, saved, and on your way. The whole thing took three taps.
        </motion.p>
      </div>
    </section>
  )
}
