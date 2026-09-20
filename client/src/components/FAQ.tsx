import { useState } from 'react'
import { Plus } from 'lucide-react'

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

function Item({ q, a, open, onToggle }: {
  q: string
  a: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-border-soft">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-5 text-left py-5 md:py-6 group"
      >
        <span
          className="font-display font-bold text-text-primary transition-colors duration-300 group-hover:text-white"
          style={{ fontSize: 'clamp(1.05rem, 2.4vw, 1.3rem)', lineHeight: 1.3 }}
        >
          {q}
        </span>
        <span
          className="shrink-0 mt-0.5 grid place-items-center rounded-full border border-border text-text-secondary transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            width: 30,
            height: 30,
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            borderColor: open ? 'rgba(254,0,0,0.55)' : 'var(--border)',
            color: open ? 'var(--red)' : 'var(--text-secondary)',
          }}
        >
          <Plus size={16} />
        </span>
      </button>

      {/* Grid-rows trick: animates height without measuring the content. */}
      <div
        className="grid"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
          transition:
            'grid-template-rows 0.4s var(--ease), opacity 0.3s var(--ease)',
        }}
      >
        <div className="overflow-hidden">
          <p className="text-text-secondary text-[15px] leading-relaxed pb-6 pr-10 max-w-[640px]">
            {a}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section
      id="faq"
      className="relative max-w-[860px] mx-auto px-5 md:px-8 py-24 md:py-32 scroll-mt-20"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-red mb-4">
        Questions
      </p>
      <h2
        className="font-display font-extrabold text-text-primary"
        style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 1.02 }}
      >
        Everything you&apos;re{' '}
        <em className="font-serif italic font-normal text-red">wondering</em>
      </h2>

      <div className="mt-10 border-t border-border-soft">
        {FAQS.map((f, i) => (
          <Item
            key={f.q}
            q={f.q}
            a={f.a}
            open={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </div>
    </section>
  )
}
