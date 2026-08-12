import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Utensils, RotateCcw } from 'lucide-react'
import { Chip } from '../components/MoodChips'

const HISTORY = [
  { id: 'h1', query: 'High protein, under AED 40', picked: 'Reif Japanese Kushiyaki' },
  { id: 'h2', query: 'Late night comfort food', picked: 'Pickl' },
  { id: 'h3', query: 'Quick healthy lunch', picked: 'Allo Beirut' },
]

const CUISINES = [
  'Lebanese',
  'Japanese',
  'Italian',
  'Indian',
  'Mexican',
  'American',
  'Chinese',
  'Thai',
  'Mediterranean',
  'Emirati',
]

const BUDGETS = [
  { id: '20-40', label: 'AED 20–40' },
  { id: '40-80', label: 'AED 40–80' },
  { id: '80+', label: 'AED 80+' },
]

const DIETARY = ['Vegetarian', 'Halal', 'Gluten-Free', 'None']

function toggle(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
}

export default function Profile() {
  const navigate = useNavigate()
  // Pre-filled preferences
  const [cuisines, setCuisines] = useState<string[]>(['Japanese', 'Lebanese'])
  const [budget, setBudget] = useState('40-80')
  const [dietary, setDietary] = useState<string[]>(['Halal'])

  return (
    <div className="max-w-[820px] mx-auto px-4 md:px-8 pt-14 pb-28">
      <h1 className="font-display font-extrabold text-3xl md:text-4xl text-text-primary fade-up">
        Your{' '}
        <em className="font-serif italic font-normal text-red">Profile</em>
      </h1>

      {/* Decision history */}
      <section className="mt-8 fade-up" style={{ animationDelay: '0.1s' }}>
        <div className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
          Decision History
        </div>
        <div className="space-y-3">
          {HISTORY.map((h) => (
            <div
              key={h.id}
              className="flex items-center gap-4 card !rounded-[24px] p-4"
            >
              <div className="w-11 h-11 rounded-2xl bg-[rgba(232,39,42,0.1)] flex items-center justify-center shrink-0">
                <Utensils size={18} className="text-red" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-text-primary truncate">
                  {h.query}
                </div>
                <div className="text-sm text-text-secondary truncate">
                  Picked: {h.picked}
                </div>
              </div>
              <button
                onClick={() =>
                  navigate(`/results?q=${encodeURIComponent(h.query)}`)
                }
                className="btn-ghost shrink-0"
              >
                <RotateCcw size={14} />
                Replay
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Preferences */}
      <section className="mt-12 fade-up" style={{ animationDelay: '0.18s' }}>
        <div className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
          Your Preferences
        </div>
        <div className="card p-7 space-y-8">
          <div>
            <h2 className="font-display font-bold text-lg text-text-primary mb-3">
              Favourite cuisines
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {CUISINES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={cuisines.includes(c)}
                  onClick={() => setCuisines((prev) => toggle(prev, c))}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg text-text-primary mb-3">
              Budget per meal
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {BUDGETS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBudget(b.id)}
                  className={clsx(
                    'rounded-[24px] bg-bg-2 border p-5 text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px',
                    budget === b.id
                      ? 'border-red'
                      : 'border-border hover:border-[#3a3a3a]',
                  )}
                >
                  <div className="font-display font-bold text-text-primary">
                    {b.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-display font-bold text-lg text-text-primary mb-3">
              Dietary requirements
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {DIETARY.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  active={dietary.includes(d)}
                  onClick={() => setDietary((prev) => toggle(prev, d))}
                />
              ))}
            </div>
          </div>

          <button className="btn-primary w-full">Save Preferences</button>
        </div>
      </section>
    </div>
  )
}
