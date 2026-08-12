import { scrollToWaitlist } from '../pages/Landing'

export default function Nav() {
  return (
    <header
      className="fixed top-0 inset-x-0 z-50 h-[calc(56px_+_env(safe-area-inset-top))] md:h-[62px] pt-[env(safe-area-inset-top)] md:pt-0 flex items-center justify-between px-4 md:px-8 border-b border-border-soft"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(8, 8, 8, 0.72)',
      }}
    >
      {/* Logo */}
      <a
        href="/"
        className="font-display font-extrabold text-xl tracking-tight text-text-primary select-none"
      >
        Jou
        <span className="relative inline-block">
          3
          <span className="absolute -top-0.5 -right-1 w-[6px] h-[6px] rounded-full bg-red" />
        </span>
        an
      </a>

      {/* Waitlist CTA */}
      <button
        onClick={scrollToWaitlist}
        className="px-4 py-2 rounded-full bg-red text-white text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-10px_rgba(232,39,42,0.7)]"
      >
        Join Waitlist
      </button>
    </header>
  )
}
