import { useState } from 'react'
import type { FormEvent } from 'react'
import { Apple } from 'lucide-react'

const MOODS = [
  'Cheap',
  'Healthy',
  'Late Night',
  'High Protein',
  'Comfort Food',
  'Quick',
  'Date Night',
  'Halal',
]

const STEPS = [
  {
    n: '1',
    title: 'Tell us what you want',
    body: 'Type anything — "cheap healthy lunch", "date night", "late-night shawarma" — or just tap a mood.',
  },
  {
    n: '2',
    title: 'We decide for you',
    body: 'Our AI reads your craving, budget and area, then picks exactly 3 options. No lists to scroll.',
  },
  {
    n: '3',
    title: 'Go eat',
    body: 'Tap Directions, Reserve, or Order and you’re out the door. Decision made in seconds.',
  },
]

/** Smoothly scroll to the waitlist section. */
export function scrollToWaitlist() {
  document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })
}

function Chip({ label }: { label: string }) {
  return (
    <span className="shrink-0 px-4 py-2 rounded-full text-sm border bg-bg-2 border-border text-text-secondary select-none">
      {label}
    </span>
  )
}

export default function Landing() {
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState(false)

  const comingSoon = () => window.alert('Coming soon')

  const joinWaitlist = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    // Frontend-only for now — no backend capture yet.
    setJoined(true)
    setEmail('')
  }

  return (
    <div className="relative overflow-hidden">
      {/* ============================================================ */}
      {/* SECTION 1 — HERO                                             */}
      {/* ============================================================ */}
      <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-5 md:px-8">
        {/* Gradient orbs */}
        <span
          className="pointer-events-none absolute top-0 -left-16 w-80 h-80 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(232,39,42,0.28), transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
        <span
          className="pointer-events-none absolute bottom-0 -right-16 w-96 h-96 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(255,181,71,0.20), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        <div className="relative flex flex-col items-center">
          <p
            className="text-red uppercase fade-up"
            style={{
              fontSize: '11px',
              letterSpacing: '0.14em',
              marginBottom: 20,
            }}
          >
            Dubai&apos;s Food Decision Engine
          </p>

          <h1
            className="font-display font-extrabold uppercase text-text-primary fade-up"
            style={{
              fontSize: 'clamp(3.2rem, 9vw, 6.5rem)',
              lineHeight: 0.92,
              animationDelay: '0.05s',
            }}
          >
            Hungry?
            <br />
            We{' '}
            <em className="font-serif italic normal-case font-normal text-red">
              decide
            </em>
          </h1>

          <p
            className="mt-6 max-w-[480px] text-text-secondary fade-up"
            style={{ animationDelay: '0.15s' }}
          >
            Tell us what you&apos;re craving. We&apos;ll give you exactly 3
            options. No menus. No scrolling. Just a decision.
          </p>

          <div
            className="mt-9 flex flex-col sm:flex-row items-center gap-3 fade-up"
            style={{ animationDelay: '0.22s' }}
          >
            <button onClick={comingSoon} className="btn-primary rounded-full px-6 py-3.5">
              <Apple size={18} />
              Download on iOS
            </button>
            <button onClick={comingSoon} className="btn-ghost px-6 py-3.5">
              <span className="material-symbols-outlined text-[18px]">android</span>
              Get Android App
            </button>
          </div>

          <p
            className="mt-5 text-text-muted text-sm fade-up"
            style={{ animationDelay: '0.28s' }}
          >
            Available soon · Dubai, UAE
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <span className="material-symbols-outlined text-text-muted bounce-dot text-[28px]">
            keyboard_arrow_down
          </span>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 2 — HOW IT WORKS                                     */}
      {/* ============================================================ */}
      <section className="relative max-w-[1000px] mx-auto px-5 md:px-8 py-24 md:py-32">
        <p className="text-xs uppercase tracking-[0.2em] text-red mb-4">
          How It Works
        </p>
        <h2
          className="font-display font-extrabold text-text-primary"
          style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 1.02 }}
        >
          From hungry to decided in{' '}
          <em className="font-serif italic font-normal text-red">10 seconds</em>
        </h2>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="bg-bg-2 border border-border"
              style={{ borderRadius: 24, padding: 28 }}
            >
              <div
                className="font-display font-extrabold text-red leading-none"
                style={{ fontSize: '4rem', opacity: 0.4 }}
              >
                {s.n}
              </div>
              <h3 className="mt-4 font-display font-bold text-xl text-text-primary">
                {s.title}
              </h3>
              <p className="mt-2 text-text-secondary text-[15px] leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 3 — THE 3 RULE                                       */}
      {/* ============================================================ */}
      <section className="relative px-5 md:px-8 py-24 md:py-32 text-center">
        <div className="max-w-[760px] mx-auto flex flex-col items-center">
          <h2
            className="font-display font-extrabold text-text-primary"
            style={{ fontSize: 'clamp(2.2rem, 6vw, 4rem)', lineHeight: 1.02 }}
          >
            Never more than{' '}
            <em className="font-serif italic font-normal text-red">3</em>{' '}
            options.
          </h2>

          <span
            className="block mt-8 mb-8 h-[3px] w-20 rounded-full"
            style={{ background: 'var(--red)' }}
          />

          <p className="max-w-[560px] text-text-secondary text-lg leading-relaxed">
            Most food apps give you 500 choices and call it helpful. We give you
            3. The right 3. Because the best decision engine isn&apos;t one that
            shows you everything — it&apos;s one that knows what to cut.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 4 — MOOD CHIPS SHOWCASE                              */}
      {/* ============================================================ */}
      <section className="relative px-5 md:px-8 py-24 md:py-32 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-red mb-8">
          What Are You In The Mood For?
        </p>

        <div className="max-w-[640px] mx-auto flex flex-wrap justify-center gap-2.5">
          {MOODS.map((m) => (
            <Chip key={m} label={m} />
          ))}
        </div>

        <p className="mt-8 text-text-secondary">
          Tap a mood. Get 3 perfect picks. Done.
        </p>
      </section>

      {/* ============================================================ */}
      {/* SECTION 5 — EARLY ACCESS / WAITLIST                          */}
      {/* ============================================================ */}
      <section
        id="waitlist"
        className="relative px-5 md:px-8 py-24 md:py-32 text-center scroll-mt-20"
      >
        <div className="max-w-[620px] mx-auto flex flex-col items-center">
          <h2
            className="font-display font-extrabold text-text-primary"
            style={{ fontSize: 'clamp(2.2rem, 6vw, 3.75rem)', lineHeight: 1.02 }}
          >
            Be first in Dubai.
          </h2>
          <p className="mt-5 max-w-[460px] text-text-secondary text-lg leading-relaxed">
            We&apos;re launching soon. Drop your email and we&apos;ll let you
            know the moment Jou3an is live.
          </p>

          {joined ? (
            <p className="mt-9 text-green font-medium">
              You&apos;re on the list. We&apos;ll be in touch.
            </p>
          ) : (
            <form
              onSubmit={joinWaitlist}
              className="mt-9 w-full flex flex-col sm:flex-row items-stretch gap-3 max-w-[520px]"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="flex-1 min-w-0 bg-bg-2 border border-border text-text-primary placeholder:text-text-muted outline-none transition-colors duration-300 focus:border-[rgba(232,39,42,0.55)]"
                style={{ borderRadius: 32, padding: '12px 20px', fontSize: 16 }}
              />
              <button type="submit" className="btn-primary rounded-full px-6 py-3">
                Join Waitlist
              </button>
            </form>
          )}

          <p className="mt-4 text-text-muted text-sm">
            No spam. Just one email when we launch.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 6 — FOOTER                                           */}
      {/* ============================================================ */}
      <footer className="relative px-5 md:px-8 pt-16 pb-14 border-t border-border-soft text-center">
        <div className="max-w-[720px] mx-auto flex flex-col items-center gap-3">
          <div className="font-display font-extrabold text-2xl tracking-tight text-text-primary">
            Jou<span className="text-red">3</span>an
          </div>
          <div className="text-red text-sm" dir="rtl">
            جوعان
          </div>
          <p className="text-text-secondary text-sm">
            Dubai&apos;s food decision engine
          </p>

          <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
            <a href="#" className="transition-colors hover:text-text-primary">
              Privacy
            </a>
            <span className="text-text-muted">·</span>
            <a href="#" className="transition-colors hover:text-text-primary">
              Terms
            </a>
            <span className="text-text-muted">·</span>
            <a href="#" className="transition-colors hover:text-text-primary">
              Contact
            </a>
          </div>

          <p className="mt-4 text-text-muted text-xs">
            © 2026 Jou3an FZ-LLC · Dubai, UAE
          </p>
        </div>
      </footer>
    </div>
  )
}
