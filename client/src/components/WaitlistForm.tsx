import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { isValidEmail, joinWaitlist } from '../lib/supabase'
import { refreshWaitlistCount } from '../lib/waitlistCount'
import WaitlistCount from './WaitlistCount'

type Status = 'idle' | 'submitting' | 'joined' | 'duplicate' | 'invalid' | 'error'

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (status === 'submitting') return

    if (!isValidEmail(email)) {
      setStatus('invalid')
      return
    }

    setStatus('submitting')
    const result = await joinWaitlist(email)

    if (result === 'joined') {
      refreshWaitlistCount()
      setStatus('joined')
      setEmail('')
      return
    }
    setStatus(result === 'duplicate' ? 'duplicate' : 'error')
  }

  /* --- Success ---------------------------------------------------- */
  if (status === 'joined') {
    return (
      <div className="mt-9 w-full max-w-[520px] flex flex-col items-center fade-up">
        <div
          className="w-full flex items-center gap-3 bg-bg-2 border"
          style={{
            borderRadius: 32,
            padding: '18px 22px',
            borderColor: 'rgba(45,206,137,0.35)',
          }}
        >
          <span
            className="shrink-0 grid place-items-center rounded-full"
            style={{
              width: 34,
              height: 34,
              background: 'rgba(45,206,137,0.14)',
              color: 'var(--green)',
            }}
          >
            <Check size={18} />
          </span>
          <div className="text-left">
            <p className="text-text-primary font-semibold">You&apos;re in.</p>
            <p className="text-text-secondary text-sm">
              We&apos;ll email you the moment Jou3an goes live in Dubai.
            </p>
          </div>
        </div>

        <WaitlistCount className="mt-4" />

        <button
          onClick={() => setStatus('idle')}
          className="mt-3 text-text-muted text-sm transition-colors hover:text-text-secondary"
        >
          Add another email
        </button>
      </div>
    )
  }

  /* --- Form ------------------------------------------------------- */
  const busy = status === 'submitting'

  return (
    <div className="mt-9 w-full max-w-[520px] flex flex-col items-center">
      <form
        onSubmit={submit}
        noValidate
        className="w-full flex flex-col sm:flex-row items-stretch gap-3"
      >
        <input
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status !== 'idle' && status !== 'submitting') setStatus('idle')
          }}
          placeholder="you@email.com"
          aria-label="Email address"
          aria-invalid={status === 'invalid'}
          className="flex-1 min-w-0 bg-bg-2 border text-text-primary placeholder:text-text-muted outline-none transition-colors duration-300 focus:border-[rgba(254,0,0,0.55)]"
          style={{
            borderRadius: 32,
            padding: '15px 22px',
            fontSize: 16,
            borderColor:
              status === 'invalid' ? 'rgba(254,0,0,0.6)' : 'var(--border)',
          }}
        />
        <button
          type="submit"
          disabled={busy}
          className="btn-primary rounded-full shrink-0"
          style={{ padding: '15px 28px', opacity: busy ? 0.7 : 1 }}
        >
          {busy ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              Joining
            </>
          ) : (
            <>
              Join the Waitlist
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>

      <WaitlistCount className="mt-4" />

      {status === 'invalid' && (
        <p className="mt-3 text-red text-sm">
          That email doesn&apos;t look right. Mind checking it?
        </p>
      )}
      {status === 'duplicate' && (
        <p className="mt-3 text-gold text-sm">
          You&apos;re already on the list — nothing more to do. We&apos;ll be in
          touch.
        </p>
      )}
      {status === 'error' && (
        <p className="mt-3 text-red text-sm">
          Something went wrong on our end. Try again in a moment.
        </p>
      )}
    </div>
  )
}
