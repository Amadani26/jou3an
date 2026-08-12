import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Search } from 'lucide-react'
import MoodChips from '../components/MoodChips'
import DailyCard from '../components/DailyCard'
import { useDailyToday } from '../lib/hooks'
import { prettyArea } from '../lib/api'
import { hapticSuccess } from '../lib/haptics'

const TOP3 = [
  {
    rank: 1,
    name: 'Reif Japanese Kushiyaki',
    cuisine: 'Japanese',
    area: 'Dar Wasl',
    price: 'AED 45',
    restaurantId: '1',
  },
  {
    rank: 2,
    name: 'Allo Beirut',
    cuisine: 'Lebanese',
    area: 'JLT',
    price: 'AED 35',
    restaurantId: '2',
  },
  {
    rank: 3,
    name: 'Pickl',
    cuisine: 'Smash Burgers',
    area: 'City Walk',
    price: 'AED 40',
    restaurantId: '3',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'search' | 'ai'>('search')
  const [query, setQuery] = useState('')
  const { data: daily } = useDailyToday()

  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
  }).format(new Date())

  // Prefer live data from the API; fall back to static picks when offline.
  const topPicks =
    daily?.results && daily.results.length > 0
      ? daily.results.slice(0, 3).map((r, i) => ({
          rank: i + 1,
          name: r.name,
          cuisine: r.cuisineType,
          area: prettyArea(r.area),
          price: `AED ${r.priceMin}`,
          restaurantId: r.id,
        }))
      : TOP3

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) {
      hapticSuccess()
      navigate(`/results?q=${encodeURIComponent(q)}`)
    }
  }

  return (
    <div className="relative px-4 md:px-8 pb-28 overflow-hidden">
      {/* Hero */}
      <section className="relative max-w-[720px] mx-auto pt-16 md:pt-24 flex flex-col items-center text-center">
        {/* Gradient orbs */}
        <span
          className="pointer-events-none absolute -top-10 -left-16 w-72 h-72 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(232,39,42,0.28), transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
        <span
          className="pointer-events-none absolute -bottom-28 -right-16 w-80 h-80 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(255,181,71,0.20), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />

        <div className="relative fade-up" style={{ animationDelay: '0.05s' }}>
          <p
            className="text-red font-medium mb-4"
            style={{ fontSize: '1.05rem' }}
            dir="rtl"
          >
            جوعان على إيش؟
          </p>
          <h1
            className="font-display font-extrabold uppercase text-text-primary"
            style={{
              fontSize: 'clamp(2.8rem, 12vw, 6.5rem)',
              lineHeight: 0.92,
            }}
          >
            Hungry?
            <br />
            We{' '}
            <em className="font-serif italic normal-case font-normal text-red">
              decide
            </em>
          </h1>
        </div>

        <p
          className="relative mt-6 max-w-[480px] text-text-secondary fade-up"
          style={{ animationDelay: '0.15s' }}
        >
          Tell us what you're craving. We'll handle the rest.
        </p>

        {/* Mode toggle */}
        <div
          className="relative mt-8 inline-flex items-center gap-1 p-1 rounded-full bg-bg-2 border border-border fade-up"
          style={{ animationDelay: '0.2s' }}
        >
          {(
            [
              { id: 'search', label: '🔍 Quick Search' },
              { id: 'ai', label: '🤖 AI Decide' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={clsx(
                'px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
                mode === m.id
                  ? 'bg-red text-white'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Search / AI panel */}
        <div
          className="relative mt-6 w-full max-w-[560px] fade-up"
          style={{ animationDelay: '0.28s' }}
        >
          {mode === 'search' ? (
            <form
              onSubmit={submit}
              className="flex items-center gap-2 pl-5 pr-2 py-2 rounded-[20px] md:rounded-[32px] bg-bg-2 border border-border transition-colors duration-300 focus-within:border-[rgba(232,39,42,0.5)]"
            >
              <Search size={18} className="text-text-secondary shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={(e) =>
                  setTimeout(
                    () =>
                      e.target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      }),
                    300,
                  )
                }
                placeholder="What are you craving?"
                className="flex-1 min-w-0 bg-transparent outline-none text-base text-text-primary placeholder:text-text-muted"
              />
              <button type="submit" className="btn-primary rounded-full">
                Decide
              </button>
            </form>
          ) : (
            <div className="relative overflow-hidden rounded-[32px] bg-bg-2 border border-[rgba(232,39,42,0.3)] p-6 text-left">
              <span
                className="absolute top-0 inset-x-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(232,39,42,0.85), transparent)',
                }}
              />
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[rgba(232,39,42,0.1)] flex items-center justify-center text-xl">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-text-primary">
                      Jou3an AI
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-green">
                      <span className="w-1.5 h-1.5 rounded-full bg-green pulse-dot" />
                      Active
                    </span>
                  </div>
                  <div className="text-sm text-text-secondary">
                    Your personal food concierge
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-text-secondary">
                Chat with Jou3an and I'll pick the perfect spot based on your
                mood, budget and cravings — no more endless scrolling.
              </p>
              <button
                onClick={() => navigate('/results?q=Surprise%20me')}
                className="btn-primary w-full mt-5"
              >
                Start a Conversation
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Mood chips */}
      <section
        className="relative max-w-[720px] mx-auto mt-12 fade-up"
        style={{ animationDelay: '0.36s' }}
      >
        <MoodChips />
      </section>

      {/* Today's Top 3 */}
      <section
        className="relative max-w-[1000px] mx-auto mt-20 fade-up"
        style={{ animationDelay: '0.44s' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-red pulse-dot" />
          <span className="text-xs uppercase tracking-[0.2em] text-text-secondary">
            {weekday}'s Top 3
          </span>
        </div>
        <h2 className="font-display font-bold text-2xl text-text-primary mb-5">
          {daily?.themeLabel ?? 'What Dubai Is Eating Right Now'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topPicks.map((r) => (
            <DailyCard
              key={r.restaurantId}
              {...r}
              onClick={() =>
                navigate(`/results?q=${encodeURIComponent(r.name)}`)
              }
            />
          ))}
        </div>
      </section>
    </div>
  )
}
