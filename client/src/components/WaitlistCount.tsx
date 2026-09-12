import { useWaitlistCount } from '../lib/waitlistCount'

/**
 * Live signup count, read from the `waitlist_count()` RPC (which already
 * includes the 731 baseline). Falls back to the static baseline on failure —
 * see lib/supabase.ts.
 */
export default function WaitlistCount({ className = '' }: { className?: string }) {
  const count = useWaitlistCount()

  return (
    <p className={`text-text-muted text-[13px] ${className}`}>
      <span className="text-text-secondary font-medium">
        {count.toLocaleString('en-US')}
      </span>{' '}
      people already on the list
    </p>
  )
}
