import { useState } from 'react'
import clsx from 'clsx'
import { hapticTap } from '../lib/haptics'

/** Reusable pill chip — shared by MoodChips, Onboarding and Profile. */
export function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        hapticTap()
        onClick()
      }}
      className={clsx(
        'shrink-0 px-4 py-2 rounded-full text-sm border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95',
        active
          ? 'bg-[rgba(232,39,42,0.06)] border-[rgba(232,39,42,0.45)] text-red'
          : 'bg-bg-2 border-border text-text-secondary hover:-translate-y-px hover:border-[rgba(232,39,42,0.35)] hover:text-text-primary',
      )}
    >
      {label}
    </button>
  )
}

const MOODS = [
  '🔥 Cheap',
  '🥗 Healthy',
  '🌙 Late Night',
  '💪 High Protein',
  '🛋️ Comfort Food',
  '⚡ Quick',
  '🌹 Date Night',
  '✅ Halal',
]

export default function MoodChips({
  onChange,
}: {
  onChange?: (selected: string[]) => void
}) {
  const [active, setActive] = useState<string[]>([])

  const toggle = (mood: string) => {
    setActive((prev) => {
      const next = prev.includes(mood)
        ? prev.filter((m) => m !== mood)
        : [...prev, mood]
      onChange?.(next)
      return next
    })
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto hide-scrollbar md:flex-wrap md:justify-center md:overflow-visible">
      {MOODS.map((mood) => (
        <Chip
          key={mood}
          label={mood}
          active={active.includes(mood)}
          onClick={() => toggle(mood)}
        />
      ))}
    </div>
  )
}
