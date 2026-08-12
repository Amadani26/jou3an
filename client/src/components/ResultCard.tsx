import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { MapPin, Phone, ShoppingBag, Star, Flame, X } from 'lucide-react'
import { hapticTap, hapticSuccess } from '../lib/haptics'

export interface ResultScores {
  match: number
  value: number
  speed: number
  popularity: number
}

export interface ResultCardProps {
  rank: 1 | 2 | 3
  name: string
  cuisine: string
  priceRange: string
  area: string
  reasoning: string
  rating: number
  calories: number
  restaurantId: string
  scores?: ResultScores
  onAction?: (action: 'DIRECTIONS' | 'CALL' | 'ORDER') => void
  onDismiss?: () => void
}

const DEFAULT_SCORES: Record<number, ResultScores> = {
  1: { match: 96, value: 88, speed: 82, popularity: 90 },
  2: { match: 89, value: 92, speed: 74, popularity: 84 },
  3: { match: 84, value: 79, speed: 91, popularity: 71 },
}

const SWIPE_THRESHOLD = 100

export default function ResultCard({
  rank,
  name,
  cuisine,
  priceRange,
  area,
  reasoning,
  rating,
  calories,
  restaurantId,
  scores,
  onAction,
  onDismiss,
}: ResultCardProps) {
  const s = scores ?? DEFAULT_SCORES[rank] ?? DEFAULT_SCORES[1]

  const bars = [
    { label: 'Match', value: s.match, color: 'var(--red)' },
    { label: 'Value', value: s.value, color: 'var(--gold)' },
    { label: 'Speed', value: s.speed, color: 'var(--green)' },
    { label: 'Popularity', value: s.popularity, color: 'var(--text-primary)' },
  ]

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name} ${area}`,
  )}`

  // --- Swipe handling (left = dismiss, right = order) ---
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<null | 'h' | 'v'>(null)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e: ReactPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY }
    axis.current = null
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!start.current) return
    const mx = e.clientX - start.current.x
    const my = e.clientY - start.current.y
    if (axis.current === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      axis.current = Math.abs(mx) > Math.abs(my) ? 'h' : 'v'
      if (axis.current === 'h') {
        setDragging(true)
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    }
    if (axis.current === 'h') setDx(mx)
  }
  const endDrag = () => {
    if (dx <= -SWIPE_THRESHOLD) {
      hapticTap()
      onDismiss?.()
    } else if (dx >= SWIPE_THRESHOLD) {
      hapticSuccess()
      onAction?.('ORDER')
    }
    start.current = null
    axis.current = null
    setDragging(false)
    setDx(0)
  }

  const revealRight = Math.max(0, Math.min(1, dx / SWIPE_THRESHOLD)) // swiping right → Order
  const revealLeft = Math.max(0, Math.min(1, -dx / SWIPE_THRESHOLD)) // swiping left → Not this

  return (
    <div className="relative">
      {/* Swipe reveal hints */}
      <div className="absolute inset-0 rounded-[20px] md:rounded-[32px] overflow-hidden flex items-center justify-between px-7 pointer-events-none">
        <span
          className="flex items-center gap-2 text-green font-semibold"
          style={{ opacity: revealRight }}
        >
          <ShoppingBag size={20} /> Order
        </span>
        <span
          className="flex items-center gap-2 text-red font-semibold"
          style={{ opacity: revealLeft }}
        >
          Not this <X size={20} />
        </span>
      </div>

      <div
        className="group relative rounded-[20px] md:rounded-[32px] bg-bg-2 border border-border overflow-hidden md:hover:-translate-y-[3px] md:hover:border-[rgba(232,39,42,0.4)] md:hover:shadow-[0_0_0_1px_rgba(232,39,42,0.28),0_30px_60px_-30px_rgba(232,39,42,0.4)]"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging
            ? 'none'
            : 'transform 0.35s cubic-bezier(0.16,1,0.3,1), border-color 0.5s, box-shadow 0.5s',
        }}
        data-restaurant-id={restaurantId}
      >
        {/* Top section — also the swipe surface */}
        <div
          className="px-[18px] py-[18px] md:px-[26px] md:py-6"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="flex items-start gap-4">
            <div
              className="font-display font-extrabold leading-none shrink-0 text-[2.4rem] md:text-[3.2rem]"
              style={{ color: 'rgba(232,39,42,0.65)' }}
            >
              {rank}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display font-extrabold text-[1.25rem] leading-tight text-text-primary">
                  {name}
                </h3>
                <div className="flex items-center gap-1 shrink-0 text-gold text-sm font-semibold">
                  <Star size={14} className="fill-current" />
                  {rating.toFixed(1)}
                </div>
              </div>

              <div className="mt-1 text-sm text-text-secondary">
                {cuisine} · {priceRange}
              </div>

              <div className="mt-1 flex items-center gap-3 text-sm text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} />
                  {area}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Flame size={14} />
                  {calories} kcal
                </span>
              </div>

              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[rgba(232,39,42,0.06)] border border-[rgba(232,39,42,0.35)] text-red">
                {reasoning}
              </div>
            </div>
          </div>

          {/* Score bars */}
          <div className="mt-6 grid grid-cols-4 gap-3">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="h-0.5 w-full rounded-full bg-bg-4 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${b.value}%`, background: b.color }}
                  />
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-wide text-text-muted">
                  {b.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action row */}
        <div className="grid grid-cols-3 border-t border-border-soft">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              hapticTap()
              onAction?.('DIRECTIONS')
            }}
            className="flex flex-col items-center justify-center gap-1.5 min-h-[52px] py-4 text-text-secondary transition-colors duration-300 hover:bg-bg-3 hover:text-text-primary active:bg-bg-3"
          >
            <MapPin size={20} />
            <span className="text-[10px] uppercase tracking-wide">Directions</span>
          </a>
          <button
            type="button"
            onClick={() => {
              hapticTap()
              onAction?.('CALL')
            }}
            className="flex flex-col items-center justify-center gap-1.5 min-h-[52px] py-4 text-text-secondary border-x border-border-soft transition-colors duration-300 hover:bg-bg-3 hover:text-text-primary active:bg-bg-3"
          >
            <Phone size={20} />
            <span className="text-[10px] uppercase tracking-wide">Reserve</span>
          </button>
          <button
            type="button"
            onClick={() => {
              hapticTap()
              onAction?.('ORDER')
            }}
            className="flex flex-col items-center justify-center gap-1.5 min-h-[52px] py-4 text-text-secondary transition-colors duration-300 hover:bg-bg-3 hover:text-text-primary active:bg-bg-3"
          >
            <ShoppingBag size={20} />
            <span className="text-[10px] uppercase tracking-wide">Order</span>
          </button>
        </div>
      </div>
    </div>
  )
}
