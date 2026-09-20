/**
 * Pure-CSS iPhone frame — no image library, no device mockup PNG. The rail,
 * the screen bezel and the Dynamic Island are all borders/gradients, so the
 * only asset is the screenshot itself.
 *
 * The screenshot is a real capture from the iOS simulator (Home screen with
 * Daily Top 3), living in public/brand/app-screens/.
 */
export default function PhoneMockup({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <div className={`phone-float ${className}`}>
      {/* Red bloom behind the device — ties it to the accent without touching it */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: '118%',
          height: '58%',
          background:
            'radial-gradient(circle, rgba(254,0,0,0.20), transparent 70%)',
          filter: 'blur(64px)',
        }}
      />

      <div className="phone-frame">
        <div className="phone-screen">
          <img
            src={src}
            alt={alt}
            className="phone-shot"
            // Eager, not lazy: this sits beside the primary CTA, and at 158 kB
            // it should be on screen the moment the reveal animation plays
            // rather than popping in afterwards.
            width={900}
            height={1957}
            decoding="async"
            // If the asset ever goes missing, drop the <img> rather than let the
            // browser paint alt text across the panel — the frame then reads as
            // a powered-off phone instead of a broken image.
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          {/* Dynamic Island */}
          <span aria-hidden className="phone-island" />
          {/* Glass sheen across the panel */}
          <span aria-hidden className="phone-sheen" />
        </div>
      </div>
    </div>
  )
}
