import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  authLogin,
  authLogout,
  authMe,
  authSignup,
  clearToken,
  getToken,
  saveToken,
  type User,
} from '../lib/api'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<User>
  signup: (
    name: string,
    email: string,
    phoneNumber: string,
    password: string,
  ) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Validate any stored token on mount.
  useEffect(() => {
    let active = true
    ;(async () => {
      const token = await getToken()
      if (!token) {
        if (active) setIsLoading(false)
        return
      }
      try {
        const me = await authMe()
        if (active) setUser(me)
      } catch {
        await clearToken()
        if (active) setUser(null)
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authLogin({ email, password })
    await saveToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const signup = useCallback(
    async (name: string, email: string, phoneNumber: string, password: string) => {
      const res = await authSignup({ name, email, phoneNumber, password })
      await saveToken(res.token)
      setUser(res.user)
      return res.user
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await authLogout()
    } catch {
      /* stateless token — ignore network errors */
    }
    await clearToken()
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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
