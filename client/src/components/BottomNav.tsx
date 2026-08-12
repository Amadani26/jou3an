import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { Home, Sparkles, Clock, User } from 'lucide-react'

const TABS = [
  { label: 'Home', path: '/', Icon: Home, match: (p: string) => p === '/' },
  {
    label: 'Decide',
    path: '/results',
    Icon: Sparkles,
    match: (p: string) => p.startsWith('/results'),
  },
  {
    label: 'History',
    path: '/profile',
    Icon: Clock,
    // History is a shortcut into the profile page; Profile owns the active state
    match: () => false,
  },
  {
    label: 'Profile',
    path: '/profile',
    Icon: User,
    match: (p: string) => p.startsWith('/profile'),
  },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border-soft"
      style={{
        height: 'calc(64px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(8, 8, 8, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="h-16 flex items-stretch">
        {TABS.map(({ label, path, Icon, match }) => {
          const active = match(location.pathname)
          return (
            <Link
              key={label}
              to={path}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center gap-1 relative transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.92]',
                active ? 'text-red' : 'text-text-muted',
              )}
            >
              {active && (
                <span className="absolute top-2 w-1 h-1 rounded-full bg-red" />
              )}
              <Icon size={24} strokeWidth={2} />
              <span className="text-[9px] uppercase tracking-[0.1em] font-medium">
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
