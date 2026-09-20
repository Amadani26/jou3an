import { useState } from 'react'
import {
  ArrowRight,
  Beef,
  Bike,
  ChevronLeft,
  Coffee,
  Fish,
  Flame,
  Globe,
  HelpCircle,
  Leaf,
  MapPin,
  Moon,
  Navigation,
  Pizza,
  RotateCcw,
  Search,
  Shuffle,
  Soup,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import {
  DEMO_AREAS,
  DEMO_CUISINES,
  decideThree,
  reasonFor,
  type DecisionFilters,
  type DemoCuisine,
  type DemoRestaurant,
} from '../lib/demoData'
import WaitlistCTA from './WaitlistCTA'

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const ICONS: Record<DemoCuisine['icon'], typeof Flame> = {
  flame: Flame,
  fish: Fish,
  burger: Beef,
  curry: UtensilsCrossed,
  moon: Moon,
  leaf: Leaf,
  pizza: Pizza,
  noodles: Soup,
}

/**
 * The demo mirrors the mobile Decide tab: a four-step brief, then exactly 3
 * picks. It is the DECISION ENGINE, not the swipe deck — swiping is a separate
 * tab in the app and showing it here muddled what the product actually does.
 */
type Stage = 'location' | 'cuisine' | 'format' | 'vibe' | 'results'

/** The four wizard steps, in order — 'results' is the payoff, not a step. */
const STEPS: Stage[] = ['location', 'cuisine', 'format', 'vibe']

const STAGE_LABEL: Record<Stage, string> = {
  location: 'Step 1 · Where',
  cuisine: 'Step 2 · What',
  format: 'Step 3 · How',
  vibe: 'Step 4 · Mood',
  results: 'Your 3',
}

function StageHeader({ stage, onBack }: { stage: Stage; onBack?: () => void }) {
  const active = STEPS.indexOf(stage)

  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-4">
      <span className="flex items-center gap-2 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="-ml-1.5 shrink-0 grid place-items-center rounded-full text-text-secondary transition-colors hover:text-text-primary"
            style={{ width: 26, height: 26 }}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <span className="text-[11px] uppercase tracking-[0.16em] text-text-secondary truncate">
          {STAGE_LABEL[stage]}
        </span>
      </span>

      <span className="flex items-center gap-1.5 shrink-0">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className="rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              height: 5,
              width: i === active ? 18 : 5,
              // On the results screen every step is behind us, so all four fill.
              background:
                stage === 'results' || i <= active ? 'var(--red)' : '#2A2A2A',
            }}
          />
        ))}
      </span>
    </div>
  )
}

/** Full-width option row — the app's BigCard: icon, title, sub-line. */
function OptionRow({
  icon: Icon,
  title,
  sub,
  accent,
  selected,
  onClick,
}: {
  icon: typeof Flame
  title: string
  sub: string
  accent?: boolean
  selected?: boolean
  onClick: () => void
}) {
  const highlight = accent || selected

  return (
    <button
      onClick={onClick}
      className="flex flex-row items-center gap-3 px-3.5 py-3.5 text-left w-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98]"
      style={{
        background: selected ? '#1a0d0d' : 'var(--bg-2)',
        border: `1px solid ${highlight ? 'rgba(254,0,0,0.55)' : 'var(--border)'}`,
        borderRadius: 16,
      }}
    >
      <Icon
        size={19}
        className="shrink-0"
        style={{ color: highlight ? 'var(--red)' : 'var(--text-secondary)' }}
      />
      <span className="min-w-0">
        <span
          className="block font-bold text-[15px] truncate"
          style={{ color: highlight ? 'var(--red)' : 'var(--text-primary)' }}
        >
          {title}
        </span>
        <span className="block text-[11px] text-text-secondary truncate">
          {sub}
        </span>
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Step 1 — location                                                   */
/* ------------------------------------------------------------------ */

function LocationStage({ onPick }: { onPick: (label: string, area: string | null) => void }) {
  const [picking, setPicking] = useState(false)

  if (picking) {
    return (
      <div className="px-5 pb-5 flex flex-col gap-3 fade-up">
        <p className="text-text-primary font-display font-bold text-lg leading-snug">
          Which area?
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          {DEMO_AREAS.map((a) => (
            <button
              key={a}
              onClick={() => onPick(`Near ${a}`, a)}
              className="flex items-center gap-2 px-3.5 py-3 text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98]"
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 16,
              }}
            >
              <MapPin size={15} className="shrink-0 text-text-secondary" />
              <span className="font-bold text-[14px] text-text-primary truncate">
                {a}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setPicking(false)}
          className="mx-auto mt-1 text-text-secondary text-sm transition-colors hover:text-text-primary"
        >
          ‹ Location options
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 pb-5 flex flex-col gap-3 fade-up">
      <p className="text-text-primary font-display font-bold text-lg leading-snug">
        Where are you?
      </p>

      <OptionRow
        icon={Navigation}
        title="Nearby"
        sub="Use my location"
        onClick={() => onPick('Nearby', null)}
      />
      <OptionRow
        icon={Globe}
        title="Anywhere in Dubai"
        sub="No distance limit"
        onClick={() => onPick('Anywhere in Dubai', null)}
      />
      <OptionRow
        icon={Search}
        title="Pick an area"
        sub="Search a neighbourhood"
        onClick={() => setPicking(true)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Step 2 — cuisine (multi-select)                                     */
/* ------------------------------------------------------------------ */

function CuisineCard({
  cuisine,
  selected,
  onClick,
}: {
  cuisine: DemoCuisine
  selected: boolean
  onClick: () => void
}) {
  const Icon = ICONS[cuisine.icon]

  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className="flex flex-col items-start gap-2 px-3.5 py-3.5 text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98]"
      style={{
        background: selected ? '#1a0d0d' : 'var(--bg-2)',
        border: `1px solid ${selected ? 'rgba(254,0,0,0.55)' : 'var(--border)'}`,
        borderRadius: 16,
      }}
    >
      <Icon
        size={19}
        className="shrink-0"
        style={{ color: selected ? 'var(--red)' : 'var(--text-secondary)' }}
      />
      <span className="min-w-0 w-full">
        <span
          className="block font-bold text-[15px] truncate"
          style={{ color: selected ? 'var(--red)' : 'var(--text-primary)' }}
        >
          {cuisine.name}
        </span>
        <span className="block text-[11px] text-text-secondary truncate">
          {cuisine.descriptor}
        </span>
      </span>
    </button>
  )
}

function CuisineStage({
  picked,
  onToggle,
  onSkip,
  onContinue,
}: {
  picked: string[]
  onToggle: (name: string) => void
  onSkip: () => void
  onContinue: () => void
}) {
  return (
    <div className="px-5 pb-5 flex flex-col gap-3 fade-up">
      <p className="text-text-primary font-display font-bold text-lg leading-snug">
        What are you feeling?
      </p>

      <OptionRow
        icon={HelpCircle}
        title="No preference"
        sub="Show me anything"
        onClick={onSkip}
      />

      <div className="grid grid-cols-2 gap-2.5">
        {DEMO_CUISINES.map((c) => (
          <CuisineCard
            key={c.name}
            cuisine={c}
            selected={picked.includes(c.name)}
            onClick={() => onToggle(c.name)}
          />
        ))}
      </div>

      <OptionRow
        icon={Shuffle}
        title="Surprise me"
        sub="Let Jou3an decide"
        accent
        onClick={onSkip}
      />

      <button
        onClick={onContinue}
        disabled={!picked.length}
        className="btn-primary w-full mt-1"
        style={{
          borderRadius: 16,
          padding: '14px 20px',
          opacity: picked.length ? 1 : 0.35,
          cursor: picked.length ? 'pointer' : 'not-allowed',
        }}
      >
        Continue
        <ArrowRight size={17} />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Steps 3 & 4 — format and vibe                                       */
/* ------------------------------------------------------------------ */

function ChoiceStage({
  title,
  options,
  onPick,
}: {
  title: string
  options: { icon: typeof Flame; title: string; sub: string }[]
  onPick: (choice: string) => void
}) {
  return (
    <div className="px-5 pb-5 flex flex-col gap-3 fade-up">
      <p className="text-text-primary font-display font-bold text-lg leading-snug">
        {title}
      </p>
      {options.map((o) => (
        <OptionRow
          key={o.title}
          icon={o.icon}
          title={o.title}
          sub={o.sub}
          onClick={() => onPick(o.title)}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Results — exactly 3 (mirrors the app's ResultCard)                  */
/* ------------------------------------------------------------------ */

function ResultCard({
  restaurant,
  rank,
  reason,
  delay,
}: {
  restaurant: DemoRestaurant
  rank: number
  reason: string
  delay: number
}) {
  return (
    <div
      className="overflow-hidden fade-up"
      style={{
        background: '#111111',
        borderRadius: 16,
        animationDelay: `${delay}s`,
        boxShadow: '0 14px 30px -22px rgba(0,0,0,0.9)',
      }}
    >
      {/* Photo header with the rank overlaid */}
      <div className="relative" style={{ height: 104 }}>
        <img
          src={restaurant.photos[0]}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <span
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(8,8,8,0.92) 0%, rgba(8,8,8,0.25) 60%, transparent 100%)',
          }}
        />
        <span
          className="absolute bottom-1.5 left-4 font-display font-extrabold leading-none"
          style={{ fontSize: 34, color: 'var(--red)' }}
        >
          {rank}
        </span>
      </div>

      <div className="px-4 py-3.5">
        <h4 className="font-bold text-[16px] text-text-primary truncate">
          {restaurant.name}
        </h4>

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <span className="text-text-secondary">{restaurant.cuisine}</span>
          <span className="text-text-muted">·</span>
          <span style={{ color: '#F4A261' }}>
            AED {restaurant.priceMin}–{restaurant.priceMax}
          </span>
          <span className="text-text-muted">·</span>
          <span className="inline-flex items-center gap-1 text-text-secondary">
            <MapPin size={11} />
            {restaurant.area}
          </span>
        </p>

        {/* Red reasoning pill — built from the brief, so it reflects the input */}
        <span
          className="inline-block mt-2.5 px-2.5 py-1 text-[11px] font-medium"
          style={{
            color: 'var(--red)',
            background: 'rgba(254,0,0,0.12)',
            border: '1px solid rgba(254,0,0,0.3)',
            borderRadius: 999,
          }}
        >
          {reason}
        </span>
      </div>
    </div>
  )
}

function ResultsStage({
  filters,
  location,
  results,
  onRestart,
}: {
  filters: DecisionFilters
  location: string
  results: DemoRestaurant[]
  onRestart: () => void
}) {
  // The brief, played back verbatim — the same prompt string the mobile Decide
  // flow builds before it calls the engine.
  const prompt = [location, ...filters.cuisines, filters.format, filters.vibe]
    .join(', ')

  return (
    <div className="px-5 pb-5 flex flex-col gap-3">
      <p className="text-text-primary font-display font-bold text-lg leading-snug">
        Here are your 3.
      </p>

      <p
        className="text-[11px] text-text-secondary leading-relaxed px-3 py-2"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}
      >
        <span className="text-text-muted">You asked for </span>
        {prompt}
      </p>

      {results.map((r, i) => (
        <ResultCard
          key={r.id}
          restaurant={r}
          rank={i + 1}
          reason={reasonFor(r, filters)}
          delay={i * 0.08}
        />
      ))}

      <button
        onClick={onRestart}
        className="btn-ghost mx-auto mt-1"
        style={{ borderRadius: 999 }}
      >
        <RotateCcw size={15} />
        Try again
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

const FORMATS = [
  { icon: Bike, title: 'Delivery', sub: 'Bring it to me' },
  { icon: UtensilsCrossed, title: 'Dine In', sub: 'I will go there' },
]

const VIBES = [
  { icon: Coffee, title: 'Casual', sub: 'Relaxed and quick' },
  { icon: Sparkles, title: 'Fancy', sub: 'Worth dressing up' },
]

export default function AppPreview() {
  const [stage, setStage] = useState<Stage>('location')
  const [location, setLocation] = useState('Anywhere in Dubai')
  const [area, setArea] = useState<string | null>(null)
  const [cuisines, setCuisines] = useState<string[]>([])
  const [format, setFormat] = useState<DecisionFilters['format']>('Dine In')
  const [filters, setFilters] = useState<DecisionFilters | null>(null)
  const [results, setResults] = useState<DemoRestaurant[]>([])

  const decide = (vibe: DecisionFilters['vibe']) => {
    const f: DecisionFilters = { area, cuisines, format, vibe }
    setFilters(f)
    setResults(decideThree(f))
    setStage('results')
  }

  const restart = () => {
    setStage('location')
    setLocation('Anywhere in Dubai')
    setArea(null)
    setCuisines([])
    setFormat('Dine In')
    setFilters(null)
    setResults([])
  }

  // Walking back one step at a time, the way the app's header arrow does.
  const back = () => {
    const i = STEPS.indexOf(stage)
    if (i > 0) setStage(STEPS[i - 1])
  }

  return (
    <section
      id="preview"
      className="relative px-5 md:px-8 py-24 md:py-32 scroll-mt-20"
    >
      <div className="max-w-[1000px] mx-auto text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-red mb-4">
          Try It Now
        </p>
        <h2
          className="font-display font-extrabold text-text-primary"
          style={{ fontSize: 'clamp(1.75rem, 5vw, 3.25rem)', lineHeight: 1.05 }}
        >
          The decision engine, in your{' '}
          <em className="font-serif italic font-normal text-red">browser</em>
        </h2>
        <p className="mt-5 mx-auto max-w-[460px] text-text-secondary leading-relaxed">
          Four taps — where, what, how, what mood. Sample Dubai restaurants, and
          exactly three at the end. No account, no scrolling.
        </p>
      </div>

      {/* Phone-shaped frame */}
      <div
        className="mt-12 mx-auto w-full max-w-[400px] bg-bg-1 border border-border overflow-hidden"
        style={{ borderRadius: 32, boxShadow: '0 40px 90px -50px rgba(0,0,0,1)' }}
      >
        <StageHeader
          stage={stage}
          onBack={stage !== 'location' && stage !== 'results' ? back : undefined}
        />

        {stage === 'location' && (
          <LocationStage
            onPick={(label, a) => {
              setLocation(label)
              setArea(a)
              setStage('cuisine')
            }}
          />
        )}

        {stage === 'cuisine' && (
          <CuisineStage
            picked={cuisines}
            onToggle={(name) =>
              setCuisines((prev) =>
                prev.includes(name)
                  ? prev.filter((n) => n !== name)
                  : [...prev, name],
              )
            }
            onSkip={() => {
              setCuisines([])
              setStage('format')
            }}
            onContinue={() => setStage('format')}
          />
        )}

        {stage === 'format' && (
          <ChoiceStage
            title="Delivery or dine in?"
            options={FORMATS}
            onPick={(c) => {
              setFormat(c as DecisionFilters['format'])
              setStage('vibe')
            }}
          />
        )}

        {stage === 'vibe' && (
          <ChoiceStage
            title="What is the mood?"
            options={VIBES}
            onPick={(c) => decide(c as DecisionFilters['vibe'])}
          />
        )}

        {stage === 'results' && filters && (
          <ResultsStage
            filters={filters}
            location={location}
            results={results}
            onRestart={restart}
          />
        )}
      </div>

      <p className="mt-6 text-center text-text-muted text-[13px]">
        Demo only — sample data, no account needed.
      </p>

      <WaitlistCTA label="Join the Waitlist" className="mt-10" />
    </section>
  )
}
