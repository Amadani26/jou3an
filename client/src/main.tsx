import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Fade out the boot splash once React has mounted.
declare global {
  interface Window {
    __hideSplash?: () => void
  }
}
requestAnimationFrame(() => window.__hideSplash?.())

// Register the service worker (production only — avoids caching the Vite dev server)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* ignore registration failures */
    })
  })
}
