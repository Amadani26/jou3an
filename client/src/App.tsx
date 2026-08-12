import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import Landing from './pages/Landing'

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="pt-[calc(56px_+_env(safe-area-inset-top))] md:pt-[62px]">
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
