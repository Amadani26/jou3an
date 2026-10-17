import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Vercel sets VERCEL_ENV at build time ('production' | 'preview' |
    // 'development') but Vite only exposes VITE_*-prefixed vars, so it is
    // forwarded by hand. Local builds get '' and behave like production.
    // Used by lib/supabase.ts: preview deployments NEVER write to the real
    // waitlist — reviewers poking the form on a branch must not insert rows.
    'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV ?? ''),
  },
})
