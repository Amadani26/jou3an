import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

/**
 * Shared shell for /privacy and /terms.
 *
 * Prose, not marketing: a single readable column, no orbs, no reveal
 * animations, no CTA. Someone reading this is checking what we do with their
 * data or what they just agreed to — the page's whole job is to be legible and
 * to get out of the way.
 *
 * ⚠️ The landing page's own `Reveal` wrapper is deliberately NOT used here.
 * Legal text that fades in as you scroll is text that is briefly invisible,
 * and these pages are also what a reviewer (Apple, a DPA) reads with
 * JavaScript throttled.
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  /** Human date, e.g. "5 October 2026". Rendered as "Last updated …". */
  updated: string
  children: ReactNode
}) {
  // React Router keeps the old scroll offset across a route change, so
  // arriving here from the FOOTER lands you at the bottom of a legal
  // document. Reset on mount.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="relative px-5 md:px-8 py-16 md:py-24">
      <article className="max-w-[760px] mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <span aria-hidden="true">←</span> Back to Jou3an
        </Link>

        <h1
          className="mt-8 font-display font-extrabold text-text-primary"
          style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', lineHeight: 1.05 }}
        >
          {title}
        </h1>

        <p className="mt-4 text-sm text-text-muted">Last updated {updated}</p>

        {/* `legal-prose` carries the spacing and type scale for everything
            below — see index.css. Writing it here instead of on 60 individual
            elements is what keeps the documents readable as documents. */}
        <div className="legal-prose mt-10">{children}</div>

        <hr className="mt-16 border-border-soft" />
        <p className="mt-6 text-xs text-text-muted">
          Jou3an FZ-LLC · Dubai, United Arab Emirates
        </p>
      </article>
    </div>
  )
}
