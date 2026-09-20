import { Flame, Layers, Sparkles, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Reveal from './Reveal'

/** The app as it exists today — nothing here is roadmap. */
const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Sparkles,
    title: 'Decision engine',
    body: 'Area, cuisine, delivery or dine-in, casual or fancy. It reads the brief and returns the three that fit.',
  },
  {
    icon: Flame,
    title: 'Swipe to teach it',
    body: 'Tinder-style cards. Swipe right on what tempts you, then ask for three picks built from your taste.',
  },
  {
    icon: Layers,
    title: 'Daily Top 3',
    body: 'A fresh trio every day, themed around what Dubai is actually eating right now. Open and go.',
  },
  {
    icon: Timer,
    title: 'No menus, no scrolling',
    body: 'No listings. No infinite feed. Three cards, each with directions, a call and an order link.',
  },
]

export default function WhatIsJou3an() {
  return (
    <section
      id="what-is-jou3an"
      className="relative px-5 md:px-8 py-24 md:py-32 scroll-mt-20"
    >
      <div className="max-w-[980px] mx-auto">
        {/* ---- The problem ------------------------------------------ */}
        <Reveal>
          <p className="text-xs uppercase tracking-[0.2em] text-red mb-4">
            What is Jou3an
          </p>
          <h2
            className="font-display font-extrabold text-text-primary"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 1.02 }}
          >
            You already know you&apos;re{' '}
            <em className="font-serif italic font-normal text-red">hungry</em>.
          </h2>
        </Reveal>

        <div className="mt-10 grid md:grid-cols-2 gap-x-14 gap-y-8">
          <Reveal delay={80}>
            <p className="text-text-secondary text-lg leading-relaxed max-w-[460px]">
              What you don&apos;t know is where to eat. So it starts — one app,
              then another, then the group chat. Ten, fifteen minutes of
              tab-switching in a city with thousands of restaurants, and the
              answer is the same place you went last week.
            </p>
          </Reveal>

          <Reveal delay={160}>
            <p className="text-text-primary text-lg leading-relaxed max-w-[460px]">
              Jou3an is the layer that ends it. Tell it your vibe and get{' '}
              <strong className="font-semibold text-red">exactly 3</strong>{' '}
              places, in under 10 seconds. Not a list to browse. A decision to
              act on.
            </p>
          </Reveal>
        </div>

        {/* ---- The feature grid ------------------------------------- */}
        <div className="mt-16 md:mt-20 grid sm:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => (
            // Stagger: each tile trails the one before it by 90ms.
            <Reveal key={f.title} delay={i * 90}>
              <FeatureTile {...f} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureTile({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon
  title: string
  body: string
}) {
  return (
    <div className="feature-tile h-full bg-bg-2 border border-border rounded-lg p-6">
      <span
        className="grid place-items-center rounded-md"
        style={{
          width: 40,
          height: 40,
          background: 'rgba(254,0,0,0.10)',
          border: '1px solid rgba(254,0,0,0.28)',
          color: 'var(--red)',
        }}
      >
        <Icon size={19} strokeWidth={1.9} />
      </span>

      <h3 className="mt-5 font-display font-bold text-text-primary text-lg">
        {title}
      </h3>
      <p className="mt-2 text-text-secondary text-[15px] leading-relaxed">
        {body}
      </p>
    </div>
  )
}
