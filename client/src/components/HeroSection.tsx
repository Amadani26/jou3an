import WaitlistCount from './WaitlistCount'
import { scrollToWaitlist } from '../lib/scroll'

/**
 * The hero — and the only section on the page with NO JavaScript animation.
 *
 * Everything here is a one-shot, predetermined entrance: the monument wipes in,
 * three words rise, the copy follows. Nothing is interruptible, nothing is
 * driven by input, nothing needs to be retargeted mid-flight. That is exactly
 * the case where CSS beats a JS animation library, for two reasons that both
 * matter on a phone:
 *
 *   1. CSS keyframes run off the main thread, so the hero still animates
 *      smoothly while React is booting and the rest of the page is parsing.
 *   2. It keeps the animation library out of the critical path entirely — the
 *      hero is the LCP element, and it should not wait on a 49 KB download to
 *      finish painting. Motion loads with the first section below the fold.
 *
 * Stagger delays are inline because they are data about the words, not style.
 */
const WORDS = [
  { text: 'Hungry?', breakAfter: true },
  { text: 'We' },
  { text: 'decide', accent: true },
]

export default function HeroSection() {
  return (
    <section className="hero-bleed relative min-h-[100svh] overflow-hidden flex flex-col">
      {/*
        THE LIGHT SOURCE. One red light and nothing else — the gold orb is
        gone, so the page has a single colour of light and the red never has to
        compete with a second hue. It breathes on a slow loop; the blur is
        rastered once and only transform and opacity animate after that.
      */}
      <span aria-hidden="true" className="hero-glow" />

      {/*
        THE MONUMENT. The 3 is the one thing on this page no competitor can
        use: in the Arabic chat alphabet 3 is ع, the letter in جوعان, and it is
        also the number of answers. Cropped by the top and right edges so it
        reads as architecture rather than a logo dropped in a corner.

        It wipes in with clip-path rather than fading, so the glyph is drawn
        into existence instead of a finished shape appearing at low opacity.
        aria-hidden: it is scenery, and a screen reader announcing "3" here
        would be noise.
      */}
      <span aria-hidden="true" className="hero-three">
        3
      </span>

      <div className="hero-body">
        <h1 className="hero-h">
          {WORDS.map((w, i) => (
            <span key={w.text} className={w.breakAfter ? 'hero-line' : undefined}>
              <span
                className={`hero-word${w.accent ? ' hero-accent' : ''}`}
                style={{ animationDelay: `${180 + i * 70}ms` }}
              >
                {w.text}
              </span>
              {!w.breakAfter && i < WORDS.length - 1 ? ' ' : null}
            </span>
          ))}
        </h1>

        {/*
          Carries the claim the old eyebrow carried. The eyebrow itself is gone
          — a tiny tracked-caps label above a headline is the commonest tell on
          a generated page, and none of Apple, Linear, Stripe or Vercel uses
          one — but the claim it made is still here, inside the sentence.
        */}
        <p className="hero-sub hero-fade" style={{ animationDelay: '420ms' }}>
          <b>Dubai&apos;s first food decision engine.</b> Tell us what
          you&apos;re craving and get exactly 3 places — no menus, no scrolling,
          just a decision.
        </p>

        <div
          className="w-full max-w-[460px] hero-fade"
          style={{ animationDelay: '520ms' }}
        >
          <button type="button" onClick={scrollToWaitlist} className="hero-cta">
            Join the waitlist
          </button>

          {/* Renders its own <p>, so it takes the class rather than a wrapper. */}
          <WaitlistCount className="hero-count" />
          <p className="hero-meta">Launching in Dubai · Invites in batches</p>
        </div>
      </div>
    </section>
  )
}
