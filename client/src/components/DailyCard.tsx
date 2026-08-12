import { useNavigate } from 'react-router-dom'

export interface DailyCardProps {
  rank: number
  name: string
  cuisine: string
  area: string
  price: string
  restaurantId: string
  onClick?: () => void
}

export default function DailyCard({
  rank,
  name,
  cuisine,
  area,
  price,
  restaurantId,
  onClick,
}: DailyCardProps) {
  const navigate = useNavigate()

  return (
    <button
      onClick={onClick ?? (() => navigate(`/r/${restaurantId}`))}
      className="group relative overflow-hidden text-left rounded-[24px] bg-bg-2 border border-border p-5 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[3px] hover:border-[rgba(232,39,42,0.35)]"
    >
      {/* Red radial glow, top-left corner */}
      <span
        className="pointer-events-none absolute -top-16 -left-16 w-44 h-44 rounded-full opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(circle, rgba(232,39,42,0.28), transparent 70%)',
        }}
      />

      <div className="relative z-10">
        <div
          className="font-display font-extrabold leading-none"
          style={{ fontSize: '2.4rem', color: 'rgba(232,39,42,0.7)' }}
        >
          {rank}
        </div>
        <h3 className="mt-3 font-display font-bold text-lg text-text-primary leading-tight">
          {name}
        </h3>
        <div className="mt-1 text-sm text-text-secondary">
          {cuisine} · {area}
        </div>
        <div className="mt-3 font-semibold text-gold">{price}</div>
      </div>
    </button>
  )
}
