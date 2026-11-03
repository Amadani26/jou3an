import { useState } from 'react'
import { Plus } from 'lucide-react'

/**
 * FAQ — a compact accordion. One open at a time; height animated with the
 * grid-template-rows 0fr -> 1fr trick, so nothing needs measuring; rows are
 * full-width 56px+ tap targets; the plus rotates into a close. Reduced
 * motion: instant open/close (transitions off in CSS).
 *
 * Answers shortened to 1–2 sentences per the approved copy cut — meaning
 * unchanged, including the ruling on pricing ("free" with no forever-claim).
 */

const FAQS = [
  {
    q: 'What is Jou3an?',
    a: 'A decision engine, not a directory. Tell it your area and mood; it returns exactly three places.',
  },
  {
    q: 'When does it launch?',
    a: "We're in private testing, inviting the waitlist in batches. You'll hear the day your invite is ready.",
  },
  {
    q: 'Which cities?',
    a: 'Dubai first — every restaurant verified before it enters the engine. Other Gulf cities follow.',
  },
  {
    q: 'Is it free?',
    a: 'Deciding is free. A Pro tier adds extras later.',
  },
  {
    q: 'Is this another delivery app?',
    a: "No — we decide, we don't deliver. Your three link out to directions, a call, or your delivery app.",
  },
  {
    q: 'What do waitlist members get?',
    a: 'First access, a say in what we cover next, and founding-member status on anything paid.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState(0)

  return (
    <section className="faq-section" id="faq">
      <h2 className="faq-title">Questions, answered.</h2>
      <div className="faq-acc">
        {FAQS.map((f, i) => {
          const isOpen = open === i
          return (
            <div key={f.q} className="faq-item" data-open={isOpen ? 'yes' : 'no'}>
              <button
                type="button"
                className="faq-btn"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                <span>{f.q}</span>
                <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <div className="faq-fold">
                <div className="faq-fold-in">
                  <p>{f.a}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
