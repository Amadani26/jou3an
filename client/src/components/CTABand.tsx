import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { isValidEmail, joinWaitlist, preloadSupabase } from '../lib/supabase'
import { refreshWaitlistCount } from '../lib/waitlistCount'
import WaitlistCount from './WaitlistCount'

/**
 * THE CTA BAND — the whole band IS the form.
 *
 * A full-bleed field of the brand red; the sentence ends in the input, and
 * "Join" is the sentence's last word, set in the same display type as the
 * headline. Black ink on #FE0000 measures 5.25:1 — AA for normal text — so
 * the band can carry real copy, not just a shout.
 *
 * States, all animated in CSS off one data attribute:
 *   focus      the input's underline draws itself (scaleX), :focus-within
 *   submitting Join dims and the band holds
 *   joined     the form swaps for "You're in." + a check that pops in; the
 *              live counter (optimistically bumped) confirms the write
 *   duplicate  "You're already on the list." — a fact, not an error
 *   error      what went wrong and that it can be retried
 *
 * iOS: the input is 17px (16px is the auto-zoom floor), the band lives in
 * normal flow so the keyboard scrolls it rather than covering it, and the
 * submit sits beside the field — never under the keyboard.
 *
 * The band keeps the ids the rest of the page navigates to: #waitlist (the
 * hero CTA and nav scroll here) and #waitlist-email (focused after scroll).
 * On Vercel previews joinWaitlist is mocked upstream — no rows, same states.
 */

type Status = 'idle' | 'submitting' | 'joined' | 'duplicate' | 'invalid' | 'error'

export default function CTABand() {
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
      return
    }
    setStatus(result === 'duplicate' ? 'duplicate' : 'error')
  }

  const joined = status === 'joined'

  return (
    <section className="cta-band" id="waitlist" data-status={status}>
      {joined ? (
        <div className="cta-done" role="status">
          <span className="cta-check" aria-hidden="true">
            <Check size={30} strokeWidth={3} />
          </span>
          <h2 className="cta-line">You&apos;re in.</h2>
          <p className="cta-note">One email when we launch in Dubai. No spam.</p>
          <WaitlistCount className="cta-count" />
        </div>
      ) : (
        <form className="cta-form" onSubmit={submit} noValidate>
          <h2 className="cta-line">Be first in Dubai.</h2>

          <div className="cta-row">
            <span className="cta-field">
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
                onFocus={preloadSupabase}
                placeholder="you@email.com"
                aria-label="Email address"
                aria-invalid={status === 'invalid'}
                disabled={status === 'submitting'}
              />
              <i className="cta-underline" aria-hidden="true" />
            </span>
            <button type="submit" className="cta-join" disabled={status === 'submitting'}>
              Join
            </button>
          </div>

          <p className="cta-note" aria-live="polite">
            {status === 'invalid'
              ? 'That email does not look right — check it and try again.'
              : status === 'duplicate'
                ? 'You are already on the list.'
                : status === 'error'
                  ? 'Could not reach the list. Try again in a moment.'
                  : 'No spam. Just one email when we launch.'}
          </p>
          <WaitlistCount className="cta-count" />
        </form>
      )}
    </section>
  )
}
