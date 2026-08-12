import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import GoogleIcon from '../components/GoogleIcon'
import { useAuth } from '../contexts/AuthContext'
import { GOOGLE_AUTH_URL } from '../lib/api'

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured: 'Google sign-in isn’t configured yet.',
  google_failed: 'Google sign-in failed. Please try again.',
}

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    GOOGLE_ERRORS[params.get('error') ?? ''] ?? null,
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? 'Unable to sign in. Please check your credentials.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-62px)] flex items-center justify-center px-5 py-16">
      <div className="card w-full max-w-[420px] p-8 fade-up">
        <h1 className="font-display font-extrabold text-2xl text-text-primary">
          Welcome{' '}
          <em className="font-serif italic font-normal text-red">back</em>
        </h1>
        <p className="text-sm text-text-secondary mt-1 mb-6">
          Sign in to keep deciding.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            className="field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red text-center">{error}</p>
        )}

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-border-soft" />
          <span className="text-[11px] uppercase tracking-wide text-text-muted">
            or
          </span>
          <div className="h-px flex-1 bg-border-soft" />
        </div>

        <a href={GOOGLE_AUTH_URL} className="btn-google w-full">
          <GoogleIcon />
          Sign in with Google
        </a>

        <p className="text-sm text-text-secondary text-center mt-6">
          No account?{' '}
          <Link to="/signup" className="text-red font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
