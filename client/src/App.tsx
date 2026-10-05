import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import Landing from './pages/Landing'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
