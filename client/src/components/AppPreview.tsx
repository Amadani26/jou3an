import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowRight,
  Beef,
  Fish,
  Flame,
  Heart,
  Leaf,
  MapPin,
  Moon,
  Pizza,
  RotateCcw,
  Shuffle,
  Soup,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import {
  DEMO_CUISINES,
  buildDeck,
  pickThree,
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

type Stage = 'pick' | 'swipe' | 'results'

const STAGE_LABEL: Record<Stage, string> = {
  pick: 'Step 1 · Your vibe',
  swipe: 'Step 2 · Swipe',
  results: 'Step 3 · Your 3',
}

function StageHeader({ stage }: { stage: Stage }) {
  const order: Stage[] = ['pick', 'swipe', 'results']
  const active = order.indexOf(stage)

  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-4">
      <span className="text-[11px] uppercase tracking-[0.16em] text-text-secondary">
        {STAGE_LABEL[stage]}
      </span>
      <span className="flex items-center gap-1.5">
        {order.map((s, i) => (
          <span
            key={s}
            className="rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              height: 5,
              width: i === active ? 18 : 5,
              background: i <= active ? 'var(--red)' : '#2A2A2A',
            }}
          />
        ))}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Stage 1 — cuisine picker (mirrors the app's 2-col icon cards)       */
/* ------------------------------------------------------------------ */

function CuisineCard({
  cuisine,
  selected,
  wide,
  accent,
  onClick,
}: {
  cuisine: DemoCuisine | { name: string; descriptor: string; icon: 'shuffle' }
  selected?: boolean
  wide?: boolean
  accent?: boolean
  onClick: () => void
}) {
  const Icon = cuisine.icon === 'shuffle' ? Shuffle : ICONS[cuisine.icon]
  const highlight = selected || accent

  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`flex ${
        wide ? 'flex-row items-center gap-3 py-3.5' : 'flex-col items-start gap-2 py-3.5'
      } px-3.5 text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98]`}
      style={{
        background: selected ? '#1a0d0d' : 'var(--bg-2)',
        border: `1px solid ${highlight ? 'rgba(255, 49, 51,0.55)' : 'var(--border)'}`,
        borderRadius: 16,
      }}
    >
      <Icon
        size={19}
        style={{ color: highlight ? 'var(--red)' : 'var(--text-secondary)' }}
        className="shrink-0"
      />
      <span className="min-w-0">
        <span
          className="block font-bold text-[15px] truncate"
          style={{ color: highlight ? 'var(--red)' : 'var(--text-primary)' }}
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

function PickStage({
  picked,
  onToggle,
  onSurprise,
  onContinue,
}: {
  picked: string[]
  onToggle: (name: string) => void
  onSurprise: () => void
  onContinue: () => void
}) {
  return (
    <div className="px-5 pb-5 flex flex-col gap-3 fade-up">
      <p className="text-text-primary font-display font-bold text-lg leading-snug">
        What are you feeling?
      </p>

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

      <CuisineCard
        cuisine={{ name: 'Surprise me', descriptor: 'Let Jou3an decide', icon: 'shuffle' }}
        wide
        accent
        onClick={onSurprise}
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
/* Stage 2 — swipe deck                                                */
/* ------------------------------------------------------------------ */

const SWIPE_THRESHOLD = 95

function SwipeCard({
  restaurant,
  dragX,
  paused,
}: {
  restaurant: DemoRestaurant
  dragX: number
  paused: boolean
}) {
  const [photo, setPhoto] = useState(0)

  // Auto-advancing slideshow, cross-faded — the mobile Tinder card's
  // CardSlideshow. The photo advances when the active progress bar finishes
  // filling, so a drag (which pauses the CSS animation) pauses the slideshow
  // too and resumes from where it left off instead of restarting.
  const advance = () => setPhoto((p) => (p + 1) % restaurant.photos.length)

  const likeOpacity = Math.min(1, Math.max(0, dragX / SWIPE_THRESHOLD))
  const passOpacity = Math.min(1, Math.max(0, -dragX / SWIPE_THRESHOLD))

  return (
    <div
      className="absolute inset-0 overflow-hidden select-none"
      style={{ borderRadius: 24, background: 'var(--bg-2)' }}
    >
      {/* Photos — own stacking context so they stay under the scrim */}
      <div className="absolute inset-0">
        {restaurant.photos.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            loading="lazy"
            className="demo-photo absolute inset-0 w-full h-full object-cover"
            style={{ opacity: i === photo ? 1 : 0 }}
          />
        ))}
      </div>

      {/* Bottom scrim — real photos are bright and wash out the title */}
      <span
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: '62%',
          background:
            'linear-gradient(to top, rgba(8,8,8,0.94) 0%, rgba(8,8,8,0.62) 45%, transparent 100%)',
        }}
      />

      {/* Stories-style segmented progress */}
      <div
        className={`absolute top-3 inset-x-3 flex gap-1.5 ${
          paused ? 'progress-paused' : ''
        }`}
      >
        {restaurant.photos.map((src, i) => (
          <span
            key={src}
            className="flex-1 h-[3px] rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.22)' }}
          >
            <span
              className={`block h-full rounded-full ${i === photo ? 'progress-fill' : ''}`}
              onAnimationEnd={i === photo ? advance : undefined}
              style={{
                background: 'rgba(255,255,255,0.85)',
                width: i < photo ? '100%' : i === photo ? undefined : '0%',
              }}
            />
          </span>
        ))}
      </div>

      {/* Swipe verdict badges */}
      <span
        className="absolute top-9 left-4 px-3 py-1.5 font-display font-extrabold text-[13px] tracking-wider uppercase pointer-events-none"
        style={{
          border: '2px solid var(--green)',
          color: 'var(--green)',
          borderRadius: 10,
          transform: 'rotate(-12deg)',
          opacity: likeOpacity,
        }}
      >
        Interested
      </span>
      <span
        className="absolute top-9 right-4 px-3 py-1.5 font-display font-extrabold text-[13px] tracking-wider uppercase pointer-events-none"
        style={{
          border: '2px solid var(--red)',
          color: 'var(--red)',
          borderRadius: 10,
          transform: 'rotate(12deg)',
          opacity: passOpacity,
        }}
      >
        Pass
      </span>

      {/* Info overlay */}
      <div className="absolute inset-x-0 bottom-0 p-5 pointer-events-none">
        <h3 className="font-display font-extrabold text-white text-[22px] leading-tight">
          {restaurant.name}
        </h3>
        <p className="mt-1 text-[13px] text-[#CFC9C4]">
          {restaurant.cuisine} · AED {restaurant.priceMin}–{restaurant.priceMax}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#A9A29C]">
          <MapPin size={12} />
          {restaurant.area}
          <span className="text-text-muted">·</span>
          {restaurant.distanceKm} km
        </p>
      </div>
    </div>
  )
}

function SwipeStage({
  deck,
  index,
  onSwipe,
  onFinish,
}: {
  deck: DemoRestaurant[]
  index: number
  onSwipe: (dir: 'like' | 'pass') => void
  onFinish: () => void
}) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [flyOut, setFlyOut] = useState<'like' | 'pass' | null>(null)
  const startX = useRef(0)

  const current = deck[index]
  const next = deck[index + 1]

  // Fly the card off, then tell the parent to advance.
  const commit = (dir: 'like' | 'pass') => {
    if (flyOut) return
    setFlyOut(dir)
    setDragging(false)
    window.setTimeout(() => {
      setFlyOut(null)
      setDragX(0)
      onSwipe(dir)
    }, 300)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (flyOut) return
    startX.current = e.clientX
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || flyOut) return
    setDragX(e.clientX - startX.current)
  }

  const onPointerUp = () => {
    if (!dragging || flyOut) return
    setDragging(false)
    if (dragX > SWIPE_THRESHOLD) commit('like')
    else if (dragX < -SWIPE_THRESHOLD) commit('pass')
    else setDragX(0)
  }

  if (!current) return null

  const offset = flyOut ? (flyOut === 'like' ? 700 : -700) : dragX
  const rotate = (offset / 18).toFixed(2)

  return (
    <div className="px-5 pb-5 flex flex-col fade-up">
      {/* Card stack */}
      <div className="relative" style={{ height: 350 }}>
        {next && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              borderRadius: 24,
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              transform: 'scale(0.94) translateY(12px)',
              opacity: 0.55,
            }}
          />
        )}

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{
            // pan-y keeps vertical page scrolling alive while we own the
            // horizontal axis for the swipe.
            touchAction: 'pan-y',
            transform: `translateX(${offset}px) rotate(${rotate}deg)`,
            transition:
              dragging && !flyOut
                ? 'none'
                : 'transform 0.3s var(--ease), opacity 0.3s var(--ease)',
            opacity: flyOut ? 0 : 1,
          }}
        >
          <SwipeCard
            key={current.id}
            restaurant={current}
            dragX={offset}
            paused={dragging}
          />
        </div>
      </div>

      {/* Desktop / tap controls */}
      <div className="mt-5 flex items-center justify-center gap-5">
        <button
          onClick={() => commit('pass')}
          aria-label="Pass"
          className="grid place-items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-95"
          style={{
            width: 54,
            height: 54,
            background: 'var(--bg-2)',
            border: '1px solid rgba(255, 49, 51,0.45)',
            color: 'var(--red)',
          }}
        >
          <X size={22} />
        </button>

        <span className="text-text-muted text-[12px] w-[110px] text-center">
          {index + 1} of {deck.length}
          <br />
          <span className="text-[11px]">Swipe or tap</span>
        </span>

        <button
          onClick={() => commit('like')}
          aria-label="Interested"
          className="grid place-items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-95"
          style={{
            width: 54,
            height: 54,
            background: 'var(--bg-2)',
            border: '1px solid rgba(45,206,137,0.45)',
            color: 'var(--green)',
          }}
        >
          <Heart size={21} />
        </button>
      </div>

      <button
        onClick={onFinish}
        className="mt-4 mx-auto text-text-secondary text-sm transition-colors hover:text-text-primary"
      >
        Skip to my 3 →
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Stage 3 — exactly 3 results (mirrors the app's ResultCard)          */
/* ------------------------------------------------------------------ */

function ResultCard({
  restaurant,
  rank,
  delay,
}: {
  restaurant: DemoRestaurant
  rank: number
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

        {/* Red reasoning pill — the "why this one" */}
        <span
          className="inline-block mt-2.5 px-2.5 py-1 text-[11px] font-medium"
          style={{
            color: 'var(--red)',
            background: 'rgba(255, 49, 51,0.12)',
            border: '1px solid rgba(255, 49, 51,0.3)',
            borderRadius: 999,
          }}
        >
          {restaurant.reason}
        </span>
      </div>
    </div>
  )
}

function ResultsStage({
  results,
  onRestart,
}: {
  results: DemoRestaurant[]
  onRestart: () => void
}) {
  return (
    <div className="px-5 pb-5 flex flex-col gap-3">
      <p className="text-text-primary font-display font-bold text-lg leading-snug">
        Here are your 3.
      </p>

      {results.map((r, i) => (
        <ResultCard key={r.id} restaurant={r} rank={i + 1} delay={i * 0.08} />
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

export default function AppPreview() {
  const [stage, setStage] = useState<Stage>('pick')
  const [picked, setPicked] = useState<string[]>([])
  const [deck, setDeck] = useState<DemoRestaurant[]>([])
  const [index, setIndex] = useState(0)
  const [liked, setLiked] = useState<string[]>([])
  const [results, setResults] = useState<DemoRestaurant[]>([])

  const startSwiping = (cuisines: string[]) => {
    setPicked(cuisines)
    setDeck(buildDeck(cuisines))
    setIndex(0)
    setLiked([])
    setStage('swipe')
  }

  const finish = (likedIds: string[], currentDeck: DemoRestaurant[]) => {
    setResults(pickThree(currentDeck, likedIds))
    setStage('results')
  }

  const handleSwipe = (dir: 'like' | 'pass') => {
    const card = deck[index]
    const nextLiked = dir === 'like' && card ? [...liked, card.id] : liked
    setLiked(nextLiked)

    if (index + 1 >= deck.length) finish(nextLiked, deck)
    else setIndex(index + 1)
  }

  const restart = () => {
    setStage('pick')
    setPicked([])
    setDeck([])
    setIndex(0)
    setLiked([])
    setResults([])
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
          style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 1.02 }}
        >
          The app, in your{' '}
          <em className="font-serif italic font-normal text-red">browser</em>
        </h2>
        <p className="mt-5 mx-auto max-w-[460px] text-text-secondary leading-relaxed">
          A working slice of the real decision flow, with sample Dubai
          restaurants. Pick a vibe, swipe, get your three.
        </p>
      </div>

      {/* Phone-shaped frame */}
      <div
        className="mt-12 mx-auto w-full max-w-[400px] bg-bg-1 border border-border overflow-hidden"
        style={{ borderRadius: 32, boxShadow: '0 40px 90px -50px rgba(0,0,0,1)' }}
      >
        <StageHeader stage={stage} />

        {stage === 'pick' && (
          <PickStage
            picked={picked}
            onToggle={(name) =>
              setPicked((prev) =>
                prev.includes(name)
                  ? prev.filter((n) => n !== name)
                  : [...prev, name],
              )
            }
            onSurprise={() => startSwiping([])}
            onContinue={() => startSwiping(picked)}
          />
        )}

        {stage === 'swipe' && (
          <SwipeStage
            deck={deck}
            index={index}
            onSwipe={handleSwipe}
            onFinish={() => finish(liked, deck)}
          />
        )}

        {stage === 'results' && (
          <ResultsStage results={results} onRestart={restart} />
        )}
      </div>

      <p className="mt-6 text-center text-text-muted text-[13px]">
        Demo only — sample data, no account needed.
      </p>

      <WaitlistCTA
        label="Join the Waitlist"
        className="mt-10"
      />
    </section>
  )
}
