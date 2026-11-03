import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // ARTIFACT_BUILD: a review-only build that runs from a subpath with no
  // server rewrites (published as a claude.ai artifact when the Vercel
  // preview is unreachable). Relative base so every asset resolves without a
  // web root; the router switches to hashes for the same reason (App.tsx).
  base: process.env.ARTIFACT_BUILD ? './' : '/',
  define: {
    'import.meta.env.VITE_ARTIFACT': JSON.stringify(process.env.ARTIFACT_BUILD ? '1' : ''),
    // Vercel sets VERCEL_ENV at build time ('production' | 'preview' |
    // 'development') but Vite only exposes VITE_*-prefixed vars, so it is
    // forwarded by hand. Local builds get '' and behave like production.
    // Used by lib/supabase.ts: preview deployments NEVER write to the real
    // waitlist — reviewers poking the form on a branch must not insert rows.
    'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV ?? ''),
  },
})
