# Jou3an — Codebase Context

## What This App Is
Jou3an (جوعان) is a food decision engine for Dubai. Not a restaurant listing app, not an aggregator — a decision layer that returns exactly 3 food recommendations based on natural language input or mood chips. Tagline: "Hungry? We decide for you."

## Monorepo Structure
```
/jou3an
├── client/          # React + Vite + TypeScript + Tailwind — web app (PWA)
├── server/          # Node.js + Express + TypeScript + Prisma — backend API
├── mobile/          # React Native + Expo — iOS/Android app (primary focus)
└── CLAUDE.md        # This file
```
Note: `client/` and `server/` are npm workspaces (see root `package.json`). `mobile/` is a standalone Expo project (NOT a workspace) with its own `node_modules` and `.npmrc` (`legacy-peer-deps=true`) to avoid React Native hoisting issues.

## Tech Stack
Frontend (client/): React 19, Vite, TypeScript, Tailwind CSS v3, React Router, React Query, Axios
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

Mobile shared: `mobile/lib/api.ts` (axios + SecureStore JWT interceptor + typed endpoints + display helpers), `mobile/contexts/AuthContext.tsx` (JWT in SecureStore, `/api/auth/me` validation on mount, login/signup/logout).

## What's Built (Completed Phases)
✅ Phase 1: Monorepo scaffold — client + server + root concurrently setup
✅ Phase 2: Web frontend UI — all pages, components, design system
✅ Phase 3: Backend + Database — Prisma schema, all API routes, 25 restaurant seed data, Daily picks
✅ Phase 4: SKIPPED (AI engine — placeholder tag/keyword matcher in place; real AI to be activated when Anthropic API key is ready)
✅ Phase 5: Auth — Passport.js, email/password, Google OAuth (code ready, creds pending), JWT, AuthContext
✅ Phase 6: Daily Top 3 + Admin panel
✅ PWA: Service worker, manifest, install prompt, mobile-first responsive layout, generated icons
✅ Phase M1: Expo scaffold — navigation, design tokens, base components, AuthContext
✅ Phase M2: Core mobile screens — Home, Decide, Results, History, Restaurant Detail, ResultCard, DailyCard
✅ Phase M3: Auth screens, Onboarding, Profile, Pro page
✅ Phase M-Polish: Mobile UI polish — emoji-free chips/labels everywhere; tab bar (26px icons, red active dot, fontSize-9/700/1.8-tracking labels, solid #080808 bg, single 1px #1C1C1C top border, no shadows); Home red LinearGradient glow + shimmer skeleton cards (interpolateColor #141414↔#1A1A1A) shown on load AND error; Decide screen (wrap compact chips, taller full-width input, red-shadow CTA); redesigned Login (logo mark ج, grouped input card w/ divider, Google button via Linking to `${EXPO_PUBLIC_API_URL}/api/auth/google`, bottom sign-up link); unified pressed opacity 0.75 on all cards/buttons; `developmentClient: false` in app.json. New dep in use: `expo-linear-gradient`. Chip now takes a `compact` prop (no emoji prop).

## What's Not Built Yet
❌ Phase M4: API wiring + finishing touches (mobile) — screens fetch live data, but needs: `/api/users/me/history` endpoint (server), decision-select recording from mobile, error/retry polish, mobile Profile/Pro live data
❌ Phase 4: AI decision engine (needs ANTHROPIC_API_KEY in server/.env; replace decisionEngine.ts placeholder)
❌ Google OAuth credentials (needs Google Cloud Console setup — code path exists, degrades gracefully)
❌ Stripe payment integration (Pro subscription)
❌ Railway deployment (backend)
❌ Vercel deployment (web frontend)
❌ App Store / Play Store submission
❌ Landing page (convert web app to marketing page once mobile is done)
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
Continue with Phase M4 — API wiring and finishing touches for the mobile app. First concrete step: add `GET /api/users/me/history` to the server (returns the user's DecisionSessions with the selected restaurant name) so the mobile History screen shows real data.
Then: Railway deployment → Vercel deployment → Phase 4 AI activation.

---
After every prompt that adds a feature or completes a phase, update this CLAUDE.md file:
- Move the item from "What's Not Built Yet" to "What's Built"
- Add any new components, routes, or env vars that were created
- Update "Next Session Starting Point" to reflect current progress
Keep this file accurate — it is the single source of truth for the codebase state.
