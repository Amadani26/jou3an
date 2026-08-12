import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  SlidersHorizontal,
  Shuffle,
  ArrowLeft,
  Play,
  Image as ImageIcon,
  Map,
} from 'lucide-react'
import ResultCard from '../components/ResultCard'
import type { ResultCardProps } from '../components/ResultCard'
import ProcessingState from '../components/ProcessingState'
import { useDecision } from '../lib/hooks'
import { patchDecisionSelect, prettyArea, type Restaurant } from '../lib/api'

const prettyTag = (tag: string) =>
  tag
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

function toCardProps(r: Restaurant, i: number): ResultCardProps {
  return {
    rank: (i + 1) as 1 | 2 | 3,
    name: r.name,
    cuisine: r.cuisineType,
    priceRange: `AED ${r.priceMin}–${r.priceMax}`,
    area: prettyArea(r.area),
    reasoning: r.tags.slice(0, 2).map(prettyTag).join(' · ') || 'Top match',
    rating: r.ratingScore,
    calories: r.averageCalories ?? 0,
    restaurantId: r.id,
  }
}

const RESULTS: ResultCardProps[] = [
  {
    rank: 1,
    name: 'Reif Japanese Kushiyaki',
    cuisine: 'Japanese',
    priceRange: 'AED 40–80',
    area: 'Dar Wasl',
    reasoning: 'High protein · Under AED 40',
    rating: 4.8,
    calories: 620,
    restaurantId: '1',
  },
  {
    rank: 2,
    name: 'Allo Beirut',
    cuisine: 'Lebanese',
    priceRange: 'AED 20–40',
    area: 'JLT',
    reasoning: 'Great value · Quick service',
    rating: 4.6,
    calories: 540,
    restaurantId: '2',
  },
  {
    rank: 3,
    name: 'Pickl',
    cuisine: 'Smash Burgers',
    priceRange: 'AED 40–80',
    area: 'City Walk',
    reasoning: 'Comfort food · Late night',
    rating: 4.5,
    calories: 780,
    restaurantId: '3',
  },
]

const TABS = [
  { id: 'youtube', label: 'YouTube', Icon: Play },
  { id: 'photos', label: 'Photos', Icon: ImageIcon },
  { id: 'maps', label: 'Maps', Icon: Map },
] as const

function MediaPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('youtube')

  return (
    <div className="w-full lg:w-[300px] shrink-0 rounded-[24px] bg-bg-2 border border-border overflow-hidden">
      <div className="flex border-b border-border-soft">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] uppercase tracking-wide transition-colors duration-300',
              tab === id
                ? 'text-text-primary bg-bg-3'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-3">
        <div className="aspect-video w-full rounded-2xl shimmer border border-border-soft" />
        <div className="h-3 w-3/4 rounded-full shimmer" />
        <div className="h-3 w-1/2 rounded-full shimmer" />
        <p className="pt-1 text-[11px] uppercase tracking-wide text-text-muted">
          {tab} preview loading
        </p>
      </div>
    </div>
  )
}

export default function Results() {
  const [params] = useSearchParams()
  const query = params.get('q') || 'Your pick'
  const decision = useDecision()

  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<ResultCardProps[]>(RESULTS)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    let cancelled = false
    // Ensure the processing animation is visible for a beat.
    const minDelay = new Promise((r) => setTimeout(r, 900))

    Promise.all([
      decision.mutateAsync({ prompt: query, moodChips: [] }).catch(() => null),
      minDelay,
    ]).then(([data]) => {
      if (cancelled) return
      if (data && data.results.length > 0) {
        setCards(data.results.map(toCardProps))
        setSessionId(data.sessionId)
      } else {
        // Server offline — keep the static fallback picks.
        setCards(RESULTS)
        setSessionId(null)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const handleAction = (
    restaurantId: string,
    action: 'DIRECTIONS' | 'CALL' | 'ORDER',
  ) => {
    if (!sessionId) return
    patchDecisionSelect(sessionId, {
      selectedResultId: restaurantId,
      actionTaken: action,
    }).catch(() => {
      /* best-effort analytics */
    })
  }

  const handleDismiss = (restaurantId: string) => {
    setCards((prev) => prev.filter((c) => c.restaurantId !== restaurantId))
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 md:px-8 pt-12 pb-28">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-[0.2em] text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-red pulse-dot" />
            Decided for you
          </div>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl text-text-primary">
            {query}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-ghost">
            <SlidersHorizontal size={15} />
            Filter
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[rgba(232,39,42,0.08)] border border-[rgba(232,39,42,0.35)] text-red transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:bg-[rgba(232,39,42,0.14)]">
            <Shuffle size={15} />
            Shuffle
          </button>
        </div>
      </div>

      {loading ? (
        <ProcessingState />
      ) : (
        <div className="space-y-4">
          {cards.map((r, i) => (
            <div
              key={r.restaurantId}
              className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start fade-up"
              style={{ animationDelay: `${0.05 + i * 0.1}s` }}
            >
              <ResultCard
                {...r}
                onAction={(action) => handleAction(r.restaurantId, action)}
                onDismiss={() => handleDismiss(r.restaurantId)}
              />
              <div className="hidden lg:block">
                <MediaPanel />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Back to search */}
      <div className="mt-12 text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors duration-300 hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          Back to search
        </Link>
      </div>
    </div>
  )
}
