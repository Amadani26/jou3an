import { ArrowRight } from 'lucide-react'
import { scrollToWaitlist } from '../lib/scroll'
import WaitlistCount from './WaitlistCount'

/**
 * The single call to action on the page: one large "Join the Waitlist" button
 * that scrolls to the form, with the live count directly underneath.
 * Replaces the old App Store / Play Store download buttons.
 */
export default function WaitlistCTA({
  label = 'Join the Waitlist',
  className = '',
}: {
  label?: string
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <button
        onClick={scrollToWaitlist}
        className="btn-primary rounded-full w-full sm:w-auto"
        style={{
          padding: '18px 40px',
          // 19px/700 clears the WCAG "large text" bar (18.66px bold), where
          // white on #FE0000 (4.03:1) passes AA. Pure red caps out below the
          // 4.5:1 normal-text threshold, so the size is doing the work here.
          fontSize: 19,
          fontWeight: 700,
          boxShadow: '0 18px 44px -20px rgba(254,0,0,0.85)',
        }}
      >
        {label}
        <ArrowRight size={18} />
      </button>

      <WaitlistCount className="mt-3.5" />
    </div>
  )
}
