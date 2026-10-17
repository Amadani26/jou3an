import { useReveal } from '../lib/reveal'

/**
 * FEATURES — what the app does, as five lines of display type.
 *
 * No icon tiles, no cards: each capability is one large line that reveals
 * through a MASK (overflow-hidden parent, the line slides up from below its
 * own baseline) with a short stagger — the signature move here. The reveal
 * uses the page's existing IntersectionObserver hook, which fires ONCE and
 * disconnects, so the sequence plays once by construction. No motion library
 * — this section rides in the entry chunk at near-zero cost.
 *
 * The copy carries the claims of the three sections it replaces (How It
 * Works, The 3 Rule, the old feature grid): the brief, the hard 3-answer
 * rule, swipe-to-teach, the Daily Top 3, and no-menus-no-scrolling. Nothing
 * new is claimed; the 10-15-minutes problem line lives in the intro.
 */

const LINES = [
  { text: 'Tell it your vibe.', note: 'Area, cuisine, budget, dine-in or delivery.' },
  { text: 'Get exactly 3 answers.', accent: '3', note: 'Never a list. Never a feed. Three, ranked, with reasons.' },
  { text: 'Swipe to teach it.', note: 'Every swipe tunes your taste profile.' },
  { text: 'A fresh Daily Top 3.', note: 'What Dubai is eating right now, every day.' },
  { text: 'No menus. No scrolling.', note: 'Directions, call, or order — straight from the card.' },
]

function FeatureLine({
  text,
  accent,
  note,
  index,
}: {
  text: string
  accent?: string
  note: string
  index: number
}) {
  const { ref, shown } = useReveal<HTMLLIElement>()
  const parts = accent ? text.split(accent) : null

  return (
    <li ref={ref} className="feat-line" data-shown={shown ? 'yes' : 'no'}>
      <span className="feat-mask">
        <span className="feat-text" style={{ transitionDelay: `${index * 70}ms` }}>
          {parts ? (
            <>
              {parts[0]}
              <em className="feat-accent">{accent}</em>
              {parts[1]}
            </>
          ) : (
            text
          )}
        </span>
      </span>
      <span className="feat-note" style={{ transitionDelay: `${index * 70 + 160}ms` }}>
        {note}
      </span>
    </li>
  )
}

export default function Features() {
  const { ref, shown } = useReveal<HTMLDivElement>()

  return (
    <section className="feat-section">
      <div ref={ref} className="feat-head" data-shown={shown ? 'yes' : 'no'}>
        <h2 className="feat-title">
          You already know you&apos;re hungry.
        </h2>
        <p className="feat-lede">
          What you don&apos;t know is where. Ten, fifteen minutes of
          tab-switching in a city with thousands of restaurants, and you end up
          where you went last week. Jou3an is the layer that ends it — a
          decision in under 10 seconds, not a list to browse.
        </p>
      </div>

      <ul className="feat-list">
        {LINES.map((l, i) => (
          <FeatureLine key={l.text} {...l} index={i} />
        ))}
      </ul>
    </section>
  )
}
