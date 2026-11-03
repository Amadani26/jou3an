import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import Nav from './components/Nav'
import Landing from './pages/Landing'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

/* The artifact review build serves from a subpath with no rewrite rules, so
   real pathnames can never match — hashes can. Production stays on paths. */
const Router = import.meta.env.VITE_ARTIFACT === '1' ? HashRouter : BrowserRouter

/**
 * The app without a router — so the prerender script can wrap it in a
 * StaticRouter while the browser build keeps its own. See
 * scripts/prerender.mjs for why this split exists.
 */
export function Shell() {
  return (
    <>
      <Nav />
      <main className="pt-[calc(56px_+_env(safe-area-inset-top))] md:pt-[62px]">
        <Routes>
          <Route path="/" element={<Landing />} />
          {/* Linked from the footer AND opened cold from the mobile app's
              signup screen and Profile, so these must resolve on a direct
              hit — see vercel.json's SPA rewrite. */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <Router>
      <Shell />
      {/* Vercel Web Analytics — cookieless, aggregate page counts, no
          personal data. PRODUCTION ONLY by design: preview deployments are
          review traffic, not visitors, so the script never loads there
          (vite.config.ts forwards VERCEL_ENV as VITE_VERCEL_ENV). The
          privacy policy describes exactly this — keep the two in step. */}
      {import.meta.env.VITE_VERCEL_ENV === 'production' ? <Analytics /> : null}
    </Router>
  )
}
