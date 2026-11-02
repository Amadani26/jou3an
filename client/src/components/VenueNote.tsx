import { PRIVACY_EMAIL } from '../lib/legal'

/**
 * The real-restaurant disclaimer — shown near every section that displays
 * live venues (the demo and Decide→Act at minimum). The wording also lives
 * in the Terms; keep the two in step.
 */
export default function VenueNote() {
  return (
    <p className="venue-note">
      Live results from Jou3an&apos;s engine. Not affiliated with the
      restaurants shown. Restaurant owner?{' '}
      <a href={`mailto:${PRIVACY_EMAIL}?subject=Restaurant%20listing%20on%20jou3an.me`}>
        Contact us
      </a>{' '}
      to update or remove your listing.
    </p>
  )
}
