import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { LogOut, User as UserIcon, Crown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { User } from '../lib/api'

const TABS = [
  { label: 'Home', path: '/' },
  { label: 'Decide', path: '/results' },
  { label: 'History', path: '/profile' },
  { label: 'Pro', path: '/pro' },
]

function initialsOf(user: User): string {
  const source = user.name?.trim() || user.email
  if (user.name?.trim()) {
    return user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
  }
  return source[0]?.toUpperCase() ?? '?'
}

export default function Nav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path)

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/')
  }

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
      <Link
        to="/"
        className="font-display font-extrabold text-xl tracking-tight text-text-primary select-none"
      >
        Jou
        <span className="relative inline-block">
          3
          <span className="absolute -top-0.5 -right-1 w-[6px] h-[6px] rounded-full bg-red" />
        </span>
        an
      </Link>

      {/* Center pill tab switcher */}
      <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-bg-2 border border-border">
        {TABS.map((t) => (
          <Link
            key={t.label}
            to={t.path}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
              isActive(t.path)
                ? 'bg-bg-4 text-text-primary'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Right cluster */}
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green pulse-dot" />
          <span className="text-xs uppercase tracking-wide text-text-secondary">
            AI Live
          </span>
        </div>

        {isAuthenticated && user ? (
          <div className="relative hidden md:block">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-bg-2 border border-border transition-colors duration-300 hover:border-[#3a3a3a]"
            >
              <span className="w-7 h-7 rounded-full bg-red text-white grid place-items-center text-xs font-semibold">
                {initialsOf(user)}
              </span>
              <span className="hidden sm:block text-sm text-text-primary max-w-[120px] truncate">
                {user.name || user.email}
              </span>
            </button>

            {menuOpen && (
              <>
                {/* click-away overlay */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-52 z-50 rounded-2xl bg-bg-2 border border-border overflow-hidden shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]">
                  <div className="px-4 py-3 border-b border-border-soft">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {user.name || 'Jou3an user'}
                    </div>
                    <div className="text-xs text-text-secondary truncate">
                      {user.email}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/profile')
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-3 hover:text-text-primary"
                  >
                    <UserIcon size={15} />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/pro')
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-3 hover:text-text-primary"
                  >
                    <Crown size={15} className="text-gold" />
                    Upgrade to Pro
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red border-t border-border-soft transition-colors hover:bg-bg-3"
                  >
                    <LogOut size={15} />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-2 rounded-full text-sm font-medium text-text-secondary transition-colors duration-300 hover:text-text-primary"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 rounded-full bg-red text-white text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-10px_rgba(232,39,42,0.7)]"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
