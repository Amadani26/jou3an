import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight } from 'lucide-react'
import { Chip } from '../components/MoodChips'

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
  { id: '20-40', label: 'AED 20–40', sub: 'Everyday eats' },
  { id: '40-80', label: 'AED 40–80', sub: 'Treat yourself' },
  { id: '80+', label: 'AED 80+', sub: 'Special occasion' },
]

const DIETARY = ['Vegetarian', 'Halal', 'Gluten-Free', 'None']

function toggle(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [cuisines, setCuisines] = useState<string[]>([])
  const [spots, setSpots] = useState('')
  const [budget, setBudget] = useState<string>('40-80')
  const [dietary, setDietary] = useState<string[]>([])

  return (
    <div className="max-w-[720px] mx-auto px-4 md:px-8 pt-14 pb-28">
      <div className="text-center mb-10 fade-up">
        <h1 className="font-display font-extrabold text-3xl md:text-4xl text-text-primary">
          Let's get your{' '}
          <em className="font-serif italic font-normal text-red">taste</em> right
        </h1>
        <p className="text-text-secondary mt-2">
          Answer a few quick questions so we can decide better.
        </p>
      </div>

      <div className="card p-7 md:p-9 space-y-9 fade-up" style={{ animationDelay: '0.1s' }}>
        {/* Q1 */}
        <div>
          <h2 className="font-display font-bold text-lg text-text-primary mb-3">
            What cuisines do you love?
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

        {/* Q2 */}
        <div>
          <h2 className="font-display font-bold text-lg text-text-primary mb-1">
            Any usual spots?
          </h2>
          <p className="text-sm text-text-muted mb-3">Optional</p>
          <input
            className="field"
            placeholder="e.g. Allo Beirut, Reif, Pickl…"
            value={spots}
            onChange={(e) => setSpots(e.target.value)}
          />
        </div>

        {/* Q3 */}
        <div>
          <h2 className="font-display font-bold text-lg text-text-primary mb-3">
            Budget per meal?
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
                <div className="text-sm text-text-secondary mt-1">{b.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Q4 */}
        <div>
          <h2 className="font-display font-bold text-lg text-text-primary mb-3">
            Dietary requirements?
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

        {/* Desktop: inline CTA. Mobile: sticky bottom bar above the tab bar. */}
        <div
          className="fixed md:static left-0 right-0 z-40 px-4 py-3 md:p-0 bg-gradient-to-t from-bg to-transparent md:bg-none"
          style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => navigate('/')}
            className="btn-primary w-full text-base"
          >
            Let's Eat
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
