import AppPreview from '../components/AppPreview'
import FAQ from '../components/FAQ'
import Logo from '../components/Logo'
import WaitlistCTA from '../components/WaitlistCTA'
import WaitlistForm from '../components/WaitlistForm'

/** The app's real flow, in three beats. */
const STEPS = [
  {
    n: '01',
    title: 'Tell it your vibe',
    body: 'Pick your area and the cuisines you want — or just say what you’re craving.',
  },
  {
    n: '02',
    title: 'Swipe or let Jou3an decide',
    body: 'Swipe through tinder-style picks, or skip straight to an instant decision.',
  },
  {
    n: '03',
    title: 'Get your 3',
    body: 'Exactly three options with directions, call or reserve, or order. Decided in under 10 seconds.',
  },
]

/**
 * Vertical timeline step — a numbered rail with a connecting line, matching
 * the mobile Home screen's StepRow. No boxes: the three read as one flow.
 */
function StepRow({
  n,
  title,
  body,
  last,
}: {
  n: string
  title: string
  body: string
  last?: boolean
}) {
  return (
    <div className="flex gap-5">
      {/* Rail */}
      <div className="flex flex-col items-center" style={{ width: 46 }}>
        <span
          className="font-display font-extrabold leading-none"
          style={{ fontSize: 28, color: 'var(--red)' }}
        >
          {n}
        </span>
        {!last && (
          <span
            className="flex-1 w-px mt-3"
            style={{ background: 'var(--border)', minHeight: 34 }}
          />
        )}
      </div>

      {/* Copy */}
      <div className={last ? 'pb-0' : 'pb-9'}>
        <h3 className="font-display font-bold text-text-primary text-lg md:text-xl">
          {title}
        </h3>
        <p className="mt-1.5 text-text-secondary text-[15px] leading-relaxed max-w-[460px]">
          {body}
        </p>
      </div>
    </div>
  )
}

export default function Landing() {
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
              'radial-gradient(circle, rgba(255, 49, 51,0.28), transparent 70%)',
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

        <div className="relative flex flex-col items-center w-full">
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

          <WaitlistCTA
            className="mt-9 w-full max-w-[340px] fade-up"
            label="Join the Waitlist"
          />

          <p
            className="mt-5 text-text-muted text-sm fade-up"
            style={{ animationDelay: '0.28s' }}
          >
            Launching in Dubai · Invites in batches
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
      {/* SECTION 2 — HOW IT WORKS (vertical timeline)                 */}
      {/* ============================================================ */}
      <section className="relative max-w-[860px] mx-auto px-5 md:px-8 py-24 md:py-32">
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

        <div className="mt-12">
          {STEPS.map((s, i) => (
            <StepRow
              key={s.n}
              n={s.n}
              title={s.title}
              body={s.body}
              last={i === STEPS.length - 1}
            />
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
      {/* SECTION 4 — INTERACTIVE APP PREVIEW (+ its own waitlist CTA) */}
      {/* ============================================================ */}
      <AppPreview />

      {/* ============================================================ */}
      {/* SECTION 5 — WAITLIST                                         */}
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

          <WaitlistForm />

          <p className="mt-4 text-text-muted text-sm">
            No spam. Just one email when we launch.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION 6 — FAQ                                              */}
      {/* ============================================================ */}
      <FAQ />

      {/* ============================================================ */}
      {/* SECTION 7 — FOOTER                                           */}
      {/* ============================================================ */}
      <footer className="relative px-5 md:px-8 pt-16 pb-14 border-t border-border-soft text-center">
        <div className="max-w-[720px] mx-auto flex flex-col items-center gap-3">
          {/* Footer sits on #080808 — safe for the white wordmark */}
          <Logo height={34} />
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
