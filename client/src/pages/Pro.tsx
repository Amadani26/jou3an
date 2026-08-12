import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Check, Star, X } from 'lucide-react'

type FeatureType = 'check' | 'star' | 'x'
interface Feature {
  label: string
  type: FeatureType
}

const FREE_FEATURES: Feature[] = [
  { label: '5 decisions per day', type: 'check' },
  { label: 'Basic AI recommendations', type: 'check' },
  { label: 'Standard results', type: 'check' },
  { label: 'Decision history', type: 'x' },
  { label: 'Personalisation', type: 'x' },
]

const PRO_FEATURES: Feature[] = [
  { label: 'Unlimited decisions', type: 'check' },
  { label: 'Priority AI engine', type: 'check' },
  { label: 'Exclusive picks', type: 'star' },
  { label: 'Full decision history', type: 'check' },
  { label: 'Deep personalisation', type: 'star' },
]

function FeatureRow({ feature }: { feature: Feature }) {
  return (
    <li className="flex items-center gap-3">
      {feature.type === 'check' && (
        <span className="w-5 h-5 rounded-full bg-[rgba(45,206,137,0.15)] flex items-center justify-center shrink-0">
          <Check size={13} className="text-green" />
        </span>
      )}
      {feature.type === 'star' && (
        <span className="w-5 h-5 rounded-full bg-[rgba(255,181,71,0.15)] flex items-center justify-center shrink-0">
          <Star size={13} className="text-gold fill-current" />
        </span>
      )}
      {feature.type === 'x' && (
        <span className="w-5 h-5 rounded-full bg-bg-3 flex items-center justify-center shrink-0">
          <X size={13} className="text-text-muted" />
        </span>
      )}
      <span
        className={clsx(
          'text-sm',
          feature.type === 'x' ? 'text-text-muted' : 'text-text-primary',
        )}
      >
        {feature.label}
      </span>
    </li>
  )
}

export default function Pro() {
  const navigate = useNavigate()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

  const proPrice = billing === 'monthly' ? 'AED 29' : 'AED 199'
  const proPer = billing === 'monthly' ? '/mo' : '/yr'

  return (
    <div className="relative max-w-[900px] mx-auto px-4 md:px-8 pt-16 pb-28 overflow-hidden">
      {/* Hero */}
      <section className="relative text-center fade-up">
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-10 w-80 h-80 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(232,39,42,0.25), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <h1
          className="relative font-display font-extrabold uppercase text-text-primary"
          style={{ fontSize: 'clamp(2.6rem, 8vw, 5rem)', lineHeight: 0.95 }}
        >
          Upgrade to{' '}
          <em className="font-serif italic normal-case font-normal text-red">
            Pro
          </em>
        </h1>
        <p className="relative mt-4 text-text-secondary max-w-[440px] mx-auto">
          Unlimited decisions, priority AI and picks you won't find anywhere
          else.
        </p>
      </section>

      {/* Billing toggle */}
      <div
        className="flex items-center justify-center gap-3 mt-8 fade-up"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-bg-2 border border-border">
          {(['monthly', 'annual'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={clsx(
                'px-4 py-2 rounded-full text-sm font-medium capitalize transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
                billing === b
                  ? 'bg-red text-white'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {b}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[rgba(45,206,137,0.15)] text-green">
          Save 30%
        </span>
      </div>

      {/* Plan cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10 fade-up"
        style={{ animationDelay: '0.18s' }}
      >
        {/* Free */}
        <div className="card p-7 flex flex-col">
          <div className="text-sm uppercase tracking-wide text-text-secondary">
            Free
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="font-display font-extrabold text-4xl text-text-primary">
              AED 0
            </span>
            <span className="text-text-secondary">/mo</span>
          </div>
          <ul className="mt-6 space-y-3 flex-1">
            {FREE_FEATURES.map((f) => (
              <FeatureRow key={f.label} feature={f} />
            ))}
          </ul>
          <button className="btn-ghost w-full mt-7 rounded-2xl py-3">
            Current Plan
          </button>
        </div>

        {/* Pro */}
        <div className="relative overflow-hidden rounded-[32px] bg-bg-2 border border-[rgba(232,39,42,0.4)] p-7 flex flex-col">
          <span
            className="absolute top-0 inset-x-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(232,39,42,0.85), transparent)',
            }}
          />
          <div className="flex items-center justify-between">
            <div className="text-sm uppercase tracking-wide text-red">Pro</div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[rgba(232,39,42,0.12)] text-red">
              Most Popular
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="font-display font-extrabold text-4xl text-text-primary">
              {proPrice}
            </span>
            <span className="text-text-secondary">{proPer}</span>
          </div>
          <ul className="mt-6 space-y-3 flex-1">
            {PRO_FEATURES.map((f) => (
              <FeatureRow key={f.label} feature={f} />
            ))}
          </ul>
          <button
            onClick={() => navigate('/signup')}
            className="btn-primary w-full mt-7 py-3"
          >
            Get Pro Access
          </button>
        </div>
      </div>
    </div>
  )
}
