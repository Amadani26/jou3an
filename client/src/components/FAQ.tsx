import { useReveal } from '../lib/reveal'

/**
 * FAQ — large questions, answers ALWAYS OPEN.
 *
 * No accordion anywhere: on a phone every answer is readable without a tap
 * (tapping six chevrons to read six sentences is work the page was asking the
 * visitor to do for it), and on desktop each pair is a two-column row —
 * question left at display size, answer right at text size — with a subtle
 * once-only rise as it enters. The question column reads as an index.
 *
 * Copy unchanged from the accordion it replaces.
 */

const FAQS = [
  {
    q: 'What is Jou3an?',
    a: 'A food decision engine for Dubai. Tell it your area and what you feel like, and it returns exactly three places to eat — not a list of five hundred. It is the decision layer, not another directory.',
  },
  {
    q: 'When does it launch?',
    a: 'We are in private testing now and rolling out to the waitlist in batches. Join and you will hear from us the day your invite is ready.',
  },
  {
    q: 'Which cities?',
    a: 'Dubai first, and properly — every restaurant verified, mapped and rated before it enters the engine. Other Gulf cities follow once Dubai is covered end to end.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. Deciding is free and stays free. A Pro tier will add extras later, but the core three picks are never behind a paywall.',
  },
  {
    q: 'Is this another delivery app?',
    a: 'No. We do not deliver, we decide. Once you have your three, you tap through to directions, a phone call, or whichever delivery app you already use.',
  },
  {
    q: 'What do waitlist members get?',
    a: 'First access before public launch, a say in which areas and cuisines we cover next, and founding-member status on anything paid we ship later.',
  },
]

function Row({ q, a, index }: { q: string; a: string; index: number }) {
  const { ref, shown } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className="faq-row"
      data-shown={shown ? 'yes' : 'no'}
      style={{ transitionDelay: `${(index % 3) * 60}ms` }}
    >
      <h3 className="faq-q">{q}</h3>
      <p className="faq-a">{a}</p>
    </div>
  )
}

export default function FAQ() {
  return (
    <section className="faq-section" id="faq">
      <h2 className="faq-title">Questions, answered.</h2>
      <div className="faq-rows">
        {FAQS.map((f, i) => (
          <Row key={f.q} q={f.q} a={f.a} index={i} />
        ))}
      </div>
    </section>
  )
}
