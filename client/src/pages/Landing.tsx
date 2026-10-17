import { Suspense, lazy } from 'react'
import CTABand from '../components/CTABand'
import FAQ from '../components/FAQ'
import Features from '../components/Features'
import Footer from '../components/Footer'
import HeroLive from '../components/hero/HeroLive'

/*
 * The page is the product's story, in order: the device deciding (hero) →
 * too many options (the wall) → the engine's filters resolving to 3 → the
 * payoff (decide → act) → try it yourself (the demo) → what it does
 * (features) → questions → join → the name, full width.
 *
 * Everything above the fold is motion-library-free and rides in the entry
 * chunk; the scroll-choreographed sections are lazy, with fallbacks that
 * reserve their exact height so a late chunk cannot shift the page (CLS 0).
 *
 * The old How It Works timeline and The 3 Rule sections are gone AS SECTIONS
 * — their claims (the brief, "never more than 3") live on as Features lines,
 * because the new story already ACTS OUT what those sections used to state.
 */
const ProblemWall = lazy(() => import('../components/problem/ProblemWall'))
const DecideAct = lazy(() => import('../components/DecideAct'))
const DemoSection = lazy(() => import('../components/DemoSection'))

export default function Landing() {
  return (
    <div className="relative overflow-x-clip">
      {/* ============================================================ */}
      {/* SECTION 1 — HERO (CSS device, locked)                        */}
      {/* ============================================================ */}
      <HeroLive />

      {/* ============================================================ */}
      {/* SECTION 2 — PROBLEM (the wall that collapses, locked)        */}
      {/* ============================================================ */}
      <Suspense fallback={<div style={{ height: '320svh' }} aria-hidden="true" />}>
        <ProblemWall />
      </Suspense>

      {/* ============================================================ */}
      {/* SECTION 3 — DECIDE -> ACT (the payoff moment)                */}
      {/* ============================================================ */}
      <Suspense fallback={<div style={{ minHeight: '70svh' }} aria-hidden="true" />}>
        <DecideAct />
      </Suspense>

      {/* ============================================================ */}
      {/* SECTION 4 — THE LIVE DEMO (chips -> swipeable deck)          */}
      {/* ============================================================ */}
      <Suspense fallback={<div style={{ minHeight: '80svh' }} aria-hidden="true" />}>
        <DemoSection />
      </Suspense>

      {/* ============================================================ */}
      {/* SECTION 5 — FEATURES (mask-reveal lines)                     */}
      {/* ============================================================ */}
      <Features />

      {/* ============================================================ */}
      {/* SECTION 6 — FAQ (answers always open)                        */}
      {/* ============================================================ */}
      <FAQ />

      {/* ============================================================ */}
      {/* SECTION 7 — CTA BAND (the band is the form)                  */}
      {/* ============================================================ */}
      <CTABand />

      {/* ============================================================ */}
      {/* SECTION 8 — FOOTER (the name, full width)                    */}
      {/* ============================================================ */}
      <Footer />
    </div>
  )
}
