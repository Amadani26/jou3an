import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  authLogin,
  authLogout,
  authMe,
  authSignup,
  TOKEN_KEY,
  type User,
} from '../lib/api'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<User>
  signup: (name: string, email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 1) Capture a token handed back from the Google OAuth redirect (?token=…)
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken)
      params.delete('token')
      const clean =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : '') +
        window.location.hash
      window.history.replaceState({}, '', clean)
    }

    // 2) Validate any stored token against the server
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setIsLoading(false)
      return
    }

    authMe()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authLogin({ email, password })
    localStorage.setItem(TOKEN_KEY, res.token)
    setUser(res.user)
    return res.user
  }, [])

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await authSignup({ name, email, password })
      localStorage.setItem(TOKEN_KEY, res.token)
      setUser(res.user)
      return res.user
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await authLogout()
    } catch {
      /* best effort — token is stateless anyway */
    }
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
