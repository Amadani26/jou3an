# Jou3an — Codebase Context

## What This App Is
Jou3an (جوعان) is a food decision engine for Dubai. Not a restaurant listing app, not an aggregator — a decision layer that returns exactly 3 food recommendations based on natural language input or mood chips. Tagline: "Hungry? We decide for you."

## Monorepo Structure
```
/jou3an
├── client/          # React + Vite + TypeScript + Tailwind — marketing landing page (PWA)
├── server/          # Node.js + Express + TypeScript + Prisma — backend API
├── mobile/          # React Native + Expo — iOS/Android app (primary focus)
└── CLAUDE.md        # This file
```
Note: `client/` and `server/` are npm workspaces (see root `package.json`). `mobile/` is a standalone Expo project (NOT a workspace) with its own `node_modules` and `.npmrc` (`legacy-peer-deps=true`) to avoid React Native hoisting issues.

## Tech Stack
Frontend (client/): React 19, Vite, TypeScript, Tailwind CSS v3, React Router (single "/" route). NOTE: now a marketing landing page only — React Query, Axios, AuthContext and all app pages/API calls were removed.
Backend (server/): Node.js, Express, TypeScript, Prisma ORM (v6), PostgreSQL (Supabase), Passport.js, JWT, bcryptjs, Zod
Mobile (mobile/): Expo SDK 57, React Native 0.86, Expo Router, NativeWind v4, Reanimated 4 (+ react-native-worklets), React Query, Axios, Expo SecureStore
Database: Supabase (PostgreSQL) — hosted on EU (Frankfurt) region
AI: Anthropic Claude API — @anthropic-ai/sdk (Phase 4, not yet activated; decision engine is currently a tag/keyword matcher in `server/src/services/decisionEngine.ts`)

## Design System (Non-Negotiable)
Colors: red #E8272A, gold #FFB547, green #2DCE89
Background: #080808 (base), #0F0F0F, #141414, #1A1A1A, #222222
Border: #242424 (default), #1C1C1C (soft)
Text: #F2EDE8 (primary), #8A847E (secondary), #504B47 (muted)
Fonts: Syne 800 (display/headlines, web), DM Sans (body), Instrument Serif italic (accent, web)
  - Mobile note: only DM Sans is loaded (weights 400/500/600/700/800). Syne/Instrument Serif are web-only; mobile uses DM Sans 800 for display and `fontStyle: 'italic'` for accents.
Border radius: 10px (sm), 16px (md), 24px (lg), 32px (xl)
Animation: cubic-bezier(0.16,1,0.3,1) ease-out throughout

## Database Schema (Prisma)
Models: User, Restaurant, DecisionSession, DailyPick
Key enums: LocationArea (JLT, DIFC, DOWNTOWN, BUSINESS_BAY, MARINA, OTHER), BudgetRange (LOW, MID, HIGH), AccountTier (FREE, PRO), DecisionAction (DIRECTIONS, CALL, ORDER) — used by the `DecisionSession.actionTaken` field
Database URL: Supabase connection string in server/.env (two URLs: DATABASE_URL = transaction pooler on :6543 with `pgbouncer=true`; DIRECT_URL = session pooler on :5432 for migrations)

## API Routes (server/)
```
POST   /api/decisions/query            — main decision engine call (optional auth; associates user if logged in)
PATCH  /api/decisions/:id/select       — record user selection + action
GET    /api/restaurants/:id            — single restaurant
GET    /api/daily/today                — today's Daily Top 3 (restaurants populated)
GET    /api/users/me                   — current user profile (auth required)
PATCH  /api/users/me/preferences       — update preferences (auth required)
POST   /api/auth/signup                — create account, returns JWT + user
POST   /api/auth/login                 — login (passport-local), returns JWT + user
GET    /api/auth/me                    — current user (auth required)
GET    /api/auth/google                — Google OAuth start (degrades gracefully if unconfigured)
GET    /api/auth/google/callback       — Google OAuth callback (redirects with token)
POST   /api/auth/logout                — logout / destroy session
POST   /api/admin/daily                — set today's Daily Top 3 (admin only)
GET    /api/admin/restaurants          — list restaurants, paginated 50/page (admin only)
POST   /api/admin/restaurants          — create restaurant (admin only)
PATCH  /api/admin/restaurants/:id      — update / toggle restaurant (admin only)
GET    /health                         — health check ({ status, timestamp })
```
Admin = authenticated user whose email matches `ADMIN_EMAIL` (`requireAdmin` middleware).
⚠️ Not yet implemented server-side: `GET /api/users/me/history` — the mobile History screen calls it and currently falls back to its empty state.

## Mobile App Screens (mobile/)
Tab screens (app/(tabs)/):
- index.tsx — Home: hero headline, search input, mood chips, Daily Top 3 (skeletons + pulsing dot)
- decide.tsx — Decide: full screen search + mood chips + "Decide for me →"
- history.tsx — History: past decision sessions (auth-gated)
- profile.tsx — Profile: preferences, history, account

Stack screens:
- (auth)/login.tsx — Login with email or Google
- (auth)/signup.tsx — Signup
- onboarding.tsx — Post-signup preferences (cuisines, budget, area, dietary)
- results.tsx — 3 result cards after decision query (staggered FadeInDown, ProcessingState)
- restaurant/[id].tsx — Restaurant detail
- pro.tsx — Pro subscription page
- +not-found.tsx — 404 fallback

Routing: expo-router file-based. Root layout `app/_layout.tsx` wires fonts (useFonts), QueryClientProvider, AuthProvider, SafeArea + GestureHandler roots, StatusBar, and splash-screen hide.

## Mobile Components (mobile/components/)
Typography.tsx — DisplayText, BodyText, MutedText
Card.tsx — base pressable card
Chip.tsx — mood/filter chip with haptics (impactAsync Light)
RedButton.tsx — primary CTA with Reanimated press animation (+ `small` variant)
GhostButton.tsx — secondary outlined button
ProcessingState.tsx — animated loading dots with cycling text
DailyCard.tsx — daily pick card (rank, name, cuisine, area, price)
ResultCard.tsx — decision result card (rank, name, meta, reasoning, animated score bars, action row)

Mobile shared: `mobile/lib/api.ts` (axios + SecureStore JWT request interceptor + a 401 response interceptor that clears the token and redirects to login — skips `/api/auth/*` — + typed endpoints + display helpers). Named Decide-flow wrappers over the existing endpoints: `getDecision(prompt, moodChips)` → `POST /api/decisions/query`; `getDailyPicks()` → `GET /api/daily/today`; `saveDecisionSelection(sessionId, selectedId, actionTaken)` → `PATCH /api/decisions/:sessionId/select`. `mobile/contexts/AuthContext.tsx` (JWT in SecureStore, `/api/auth/me` validation on mount, login/signup/logout).

## What's Built (Completed Phases)
✅ Phase 1: Monorepo scaffold — client + server + root concurrently setup
✅ Phase 2: Web frontend UI — original app pages, components, design system (SUPERSEDED — see Landing page below)
✅ Landing page: client/ converted to a single-page marketing site (`client/src/pages/Landing.tsx`, only route is "/"). 6 sections — Hero (iOS/Android download buttons show "Coming soon" alert), How It Works (3 steps), The 3 Rule, Mood Chips showcase (text-only, non-interactive), Waitlist email capture, Footer. Simplified `Nav.tsx` (logo + "Join Waitlist" CTA that smooth-scrolls to #waitlist). Removed: all other pages, AuthContext, PrivateRoute, BottomNav, InstallPrompt, Layout, MoodChips/DailyCard/ResultCard/ProcessingState/GoogleIcon, lib/{api,hooks,haptics}, and the react-query + axios deps. Design system, fonts, CSS variables, Tailwind config and PWA (manifest + service worker) kept as-is. Waitlist email capture is frontend-only (no backend) — submit just shows a success message.
✅ Phase 3: Backend + Database — Prisma schema, all API routes, restaurant seed data (currently 10 restaurants + 1 DailyPick), Daily picks
✅ Phase 4: SKIPPED (AI engine — placeholder tag/keyword matcher in place; real AI to be activated when Anthropic API key is ready)
✅ Phase 5: Auth — Passport.js, email/password, Google OAuth (code ready, creds pending), JWT, AuthContext
✅ Phase 6: Daily Top 3 + Admin panel
✅ PWA: Service worker, manifest, install prompt, mobile-first responsive layout, generated icons
✅ Phase M1: Expo scaffold — navigation, design tokens, base components, AuthContext
✅ Phase M2: Core mobile screens — Home, Decide, Results, History, Restaurant Detail, ResultCard, DailyCard
✅ Phase M3: Auth screens, Onboarding, Profile, Pro page
✅ Phase M-Polish: Mobile UI polish — emoji-free chips/labels everywhere; tab bar (26px icons, red active dot, fontSize-9/700/1.8-tracking labels, solid #080808 bg, single 1px #1C1C1C top border, no shadows); Home red LinearGradient glow + shimmer skeleton cards (interpolateColor #141414↔#1A1A1A) shown on load AND error; Decide screen (wrap compact chips, taller full-width input, red-shadow CTA); redesigned Login + matching Signup (logo mark ج, centered layout, grouped input card w/ 1px dividers — Signup adds a Confirm Password field w/ match validation, Google button via Linking to `${EXPO_PUBLIC_API_URL}/api/auth/google`, bottom cross-link); unified pressed opacity 0.75 on all cards/buttons; `developmentClient: false` in app.json. New dep in use: `expo-linear-gradient`. Chip now takes a `compact` prop (no emoji prop).
✅ Phase M4: Mobile API wiring COMPLETE — all wiring lives in `mobile/lib/api.ts` (no separate services/ file). Home Daily Top 3 → `getDailyPicks()` (shimmer skeletons on load, static fallback picks on failure — never crashes); Decide → Results → `getDecision()`; `saveDecisionSelection()` is now called from `results.tsx` after an action is taken (Directions/Reserve/Order fire it in the background, fire-and-forget); 401 responses auto-clear the token + redirect to login. Backend endpoints were reused as-is — no new mock endpoints. The existing endpoints are: `POST /api/decisions/query`, `GET /api/daily/today`, `PATCH /api/decisions/:id/select` (the mobile wrappers map onto these). Remaining polish (not blocking): `/api/users/me/history` endpoint (server), error/retry polish, mobile Profile/Pro live data.
✅ Database seeded: 10 Dubai restaurants + 1 DailyPick for today (theme "What Dubai Is Eating Right Now", first 3 restaurants) via `server/prisma/seed.ts` (`cd server && npm run seed`). All restaurants `isActive: true`, ratings 7.9–8.9.

## What's Not Built Yet
❌ Phase 4: AI decision engine (needs ANTHROPIC_API_KEY in server/.env; replace decisionEngine.ts placeholder)
❌ Google OAuth credentials (needs Google Cloud Console setup — code path exists, degrades gracefully)
❌ Stripe payment integration (Pro subscription)
👉 NEXT PHASE: Railway deployment (backend) → Vercel deployment (web landing page)
❌ Railway deployment (backend) — see "Railway Environment Variables" section below
❌ Vercel deployment (web landing page)
❌ App Store / Play Store submission
❌ Push notifications
❌ Google Maps API integration

## Environment Variables
server/.env required keys:
- DATABASE_URL (Supabase transaction pooler, :6543, pgbouncer=true)
- DIRECT_URL (Supabase session pooler, :5432, for migrations)
- JWT_SECRET
- ANTHROPIC_API_KEY (not yet active)
- GOOGLE_CLIENT_ID (not yet set up)
- GOOGLE_CLIENT_SECRET (not yet set up)
- SESSION_SECRET
- ADMIN_EMAIL (email of the admin user for /api/admin/* routes)

mobile/.env required keys:
- EXPO_PUBLIC_API_URL (http://localhost:3001 for dev, Railway URL for prod; use LAN IP on a physical device)

client/.env required keys:
- VITE_API_URL (http://localhost:3001 for dev)
- VITE_ADMIN_PASSWORD (client-side gate for the web /admin panel)

## Railway Environment Variables (backend deployment)
Set these in the Railway service for the `server/` deployment:
- DATABASE_URL (Supabase transaction pooler, :6543, pgbouncer=true)
- DIRECT_URL (Supabase session pooler, :5432, for migrations)
- JWT_SECRET
- ANTHROPIC_API_KEY
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- SESSION_SECRET
- PORT=3001
- CLIENT_URL (production Vercel URL of the landing page — added to the CORS allowlist; falls back to http://localhost:5173 if unset)

## Dev Commands
From /jou3an root: `npm run dev` (starts client on :5173 + server on :3001 via concurrently)
From /jou3an/mobile: `npx expo start` (then press i for iOS simulator)
Server only: `cd server && npm run dev`
Client only: `npm run dev -w client`
Database migrations: `cd server && npx prisma migrate dev`
Database seed: `cd server && npm run seed`
Type-check mobile: `cd mobile && npx tsc --noEmit`
Validate mobile bundle: `cd mobile && npx expo export --platform ios`
View database: Supabase dashboard → Table Editor

## Key Product Rules (Never Violate)
- Always return exactly 3 results — never 2, never 4
- No infinite scroll, no browse sessions, no listing pages
- Speed is the product — results must load under 2 seconds
- No sponsored placements distorting results
- Max 3 action buttons per result card (Directions, Reserve, Order)

## Next Session Starting Point
Phase M4 (mobile API wiring) is COMPLETE and the database is seeded (10 restaurants + 1 DailyPick). NEXT PHASE: deployment — Railway (backend) → Vercel (web landing page).
First concrete step: deploy `server/` to Railway. Set all keys from the "Railway Environment Variables" section (incl. PORT=3001), run `npx prisma migrate deploy` + `npm run seed` against the Supabase DB, then point `mobile/.env` EXPO_PUBLIC_API_URL and `client/.env` VITE_API_URL at the Railway URL. Then deploy the client/ landing page to Vercel.
Later: Phase 4 AI activation (swap decisionEngine.ts placeholder once ANTHROPIC_API_KEY is set); optional non-blocking polish — `GET /api/users/me/history` for the mobile History screen, mobile Profile/Pro live data.

---
After every prompt that adds a feature or completes a phase, update this CLAUDE.md file:
- Move the item from "What's Not Built Yet" to "What's Built"
- Add any new components, routes, or env vars that were created
- Update "Next Session Starting Point" to reflect current progress
Keep this file accurate — it is the single source of truth for the codebase state.
