import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import WaitlistCount from '../WaitlistCount'
import ResultCardMini from '../ResultCardMini'
import { scrollToWaitlist } from '../../lib/scroll'
import { CATALOGUE_CARDS } from '../../lib/restaurantCards'

/**
 * HERO B — product first.
 *
 * The phone is the hero. The real results screen sits in a device frame lit
 * from the upper right by the page's one red light, and three result cards
 * float off the glass in real 3D — a perspective container, each card at its
 * own translateZ, so they sit genuinely in front of and behind the device
 * rather than being flat rectangles pretending with a shadow.
 *
 * Scroll drives depth, not just position: as the page moves the cards drift
 * apart and forward at different rates, which is what sells the space between
 * them. Three transform writes a frame.
 */

/** Real rows, and the reason lines the engine actually produces for them. */
const PICKS = [
  { card: CATALOGUE_CARDS[0], reason: 'Open now · 0.9 km' },
  { card: CATALOGUE_CARDS[1], reason: 'Matches your vibe' },
  { card: CATALOGUE_CARDS[2], reason: 'The spend you go for' },
]

export default function HeroProduct() {
  const ref = useRef<HTMLElement | null>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  // Each card leaves on its own path and at its own rate. Equal motion would
  // read as one flat sheet sliding; unequal motion is what reads as depth.
  const yA = useTransform(scrollYProgress, [0, 1], [0, -150])
  const yB = useTransform(scrollYProgress, [0, 1], [0, -250])
  const yC = useTransform(scrollYProgress, [0, 1], [0, -95])
  const xA = useTransform(scrollYProgress, [0, 1], [0, -40])
  const xC = useTransform(scrollYProgress, [0, 1], [0, 46])
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -52])

  const floats = [
    { y: yA, x: xA, cls: 'float-a' },
    { y: yB, x: undefined, cls: 'float-b' },
    { y: yC, x: xC, cls: 'float-c' },
  ]

  return (
    <section
      ref={ref}
      className="hero-bleed hero-product relative min-h-[100svh] overflow-hidden flex flex-col"
    >
      <span aria-hidden="true" className="hero-glow hero-glow-product" />

      <div className="product-copy">
        <h1 className="hero-h product-h">
          <span className="hero-line">
            <span className="hero-word">Hungry?</span>
          </span>
          <span>
            <span className="hero-word">We</span>{' '}
            <span className="hero-word hero-accent">decide</span>
          </span>
        </h1>
        <p className="hero-sub product-sub">
          <b>Dubai&apos;s first food decision engine.</b> Exactly 3 places — no
          menus, no scrolling, just a decision.
        </p>
      </div>

      {/* perspective lives on the stage so every child shares one vanishing point */}
      <div className="product-stage">
        <motion.div
          className="product-phone"
          style={reduce ? undefined : { y: phoneY }}
        >
          {/* No drawn notch: the screenshot is a real device capture and
              already has one. A second would be a notch on top of a notch. */}
          <div className="product-screen">
            <img
              src="/brand/app-screens/results.webp"
              alt="The Jou3an app returning exactly three places to eat"
              width={520}
              height={1130}
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </motion.div>

        {/*
          TWO elements per card, and that is not an accident: the outer one
          owns the STATIC 3D placement (translateZ + rotateY, in CSS) and the
          inner one owns the scroll drift. Motion writes the whole `transform`
          property, so animating x/y on the placed element would silently erase
          its depth and flatten the whole stage.
        */}
        {floats.map((f, i) => (
          <div key={PICKS[i].card.n} className={`product-float ${f.cls}`}>
            <motion.div style={reduce ? undefined : { y: f.y, x: f.x }}>
              <ResultCardMini
                card={PICKS[i].card}
                rank={i + 1}
                reason={PICKS[i].reason}
                size={i === 1 ? 'md' : 'sm'}
              />
            </motion.div>
          </div>
        ))}
      </div>

      <div className="product-cta">
        <button type="button" onClick={scrollToWaitlist} className="hero-cta">
          Join the waitlist
        </button>
        <WaitlistCount className="hero-count" />
      </div>
    </section>
  )
}
