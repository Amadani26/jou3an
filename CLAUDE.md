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
Key enums: LocationArea (JLT, DIFC, DOWNTOWN, BUSINESS_BAY, MARINA, OTHER), BudgetRange (LOW, MID, HIGH), AccountTier (FREE, PRO), DecisionAction (DIRECTIONS, CALL, ORDER, SELECT) — used by the `DecisionSession.actionTaken` field (SELECT = user tapped a result card to pick it; migration `add_select_decision_action`)
Database URL: Supabase connection string in server/.env (two URLs: DATABASE_URL = transaction pooler on :6543 with `pgbouncer=true`; DIRECT_URL = session pooler on :5432 for migrations)

## API Routes (server/)
```
POST   /api/decisions/query            — main decision engine call (optional auth; associates user if logged in)
POST   /api/decisions/tinder-suggest   — Food Tinder: { likedIds } → 3 picks + sessionId (placeholder: from liked list or random active; AI in Phase 4)
GET    /api/decisions/history          — auth required: user's picks (selectedResultId not null), joined w/ restaurant, newest first, max 50
PATCH  /api/decisions/:id/select       — record user selection + action
GET    /api/restaurants/nearby         — active restaurants for Food Tinder (accepts lat/lng/radius; NO geo filtering yet — returns all active)
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
Note: the mobile History screen uses `GET /api/decisions/history` (implemented). `GET /api/users/me/history` is still NOT implemented, but nothing depends on it anymore (the old `getUserHistory()` wrapper in mobile/lib/api.ts is now unused).

## Mobile App Screens (mobile/)
Tab screens (app/(tabs)/):
- index.tsx — Home: hero headline, Daily Top 3 (skeletons + pulsing dot), and a "Decide for me →" CTA that opens the Decide flow (the old free-text search box + mood chips were removed)
- decide.tsx — Decide: a 4-step guided filter wizard (no text inputs) → Location (Nearby via expo-location GPS permission / Anywhere) → Cuisine (multi-select chip grid + Skip) → Format (Delivery/Dine In) → Vibe (Casual/Fancy). Slides between steps (Reanimated SlideInLeft/Right), 4-dot progress + back arrow. On finish, builds a prompt string ("Anywhere in Dubai, Lebanese, Dine In, Casual") and pushes to results.tsx. NOTE: "Nearby" requests location permission (denied → silent "Anywhere" fallback) and is included in the prompt string, but true 5km-radius filtering is NOT wired server-side (postDecisionQuery takes only a prompt string — needs backend geo support).
- tinder.tsx — Food Tinder (tab "Swipe", flame icon): fetches GET /api/restaurants/nearby (passes lat/lng from expo-location getLastKnownPosition if permission already granted, else all active). One large swipe card at a time — react-native-gesture-handler Gesture.Pan (rotate ±15°, snap back under threshold, fly off past it), green edge/"INTERESTED" on right-swipe (saved to likedIds) / red edge/"PASS" on left. Tap OR long-press (400ms) opens RestaurantDetailSheet. Bottom "Suggest 3" button (→ "Suggest 3 (Based on your taste)" after 10+ swipes) pushes to results.tsx in tinder mode. Card photo is a branded gradient placeholder — real Google Places photos need the Places API + a photo reference (not available yet).
- history.tsx — History (auth-gated): fetches `GET /api/decisions/history`; scrollable list newest-first, each row = restaurant name, cuisine · area · price, a coloured action tag (Directions=green / Ordered=red / Reserved=gold), and a human date ("Today"/"Yesterday"/"Mon 4 Aug"). Tap a row → RestaurantDetailSheet (actions fall back to Maps — rows carry no phone/delivery URLs). States: 3 shimmer skeleton rows while loading; "Sign in to see your history" + Sign In button when logged out; "No decisions yet — start with the Decide tab" when empty.
- profile.tsx — Profile: preferences, history, account

Stack screens:
- (auth)/login.tsx — Login with email or Google. X/back uses `router.replace('/(tabs)')` (straight to the app); the "Sign up" cross-link uses `<Link replace>` so login/signup never chain through each other.
- (auth)/signup.tsx — Signup. Same independent-entry behaviour: X/back → `router.replace('/(tabs)')`, "Sign in" cross-link uses `<Link replace>`.
- onboarding.tsx — Post-signup preferences (cuisines, budget, area, dietary)
- results.tsx — 3 result cards after decision query (staggered FadeInDown, ProcessingState). Supports two fetch modes via params: default `getDecision(prompt, chips)`, or `mode=tinder` → `tinderSuggest(likedIds)` (Refresh re-runs the same mode + clears selection). Optional `title` param overrides the header. Tap-to-select one card (toggle/switch) → fires `saveDecisionSelection(sessionId, id, 'SELECT')` fire-and-forget, which now persists (a `SELECT` value was added to the `DecisionAction` enum + zod). Selecting a card therefore also creates a history entry (shows as "Selected").
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
ResultCard.tsx — decision result card, redesigned premium/minimal (bg #111111, radius 16, no border, subtle shadow, sizes to content): left rank (48px red #E63946, vertically centered), name (20/700), meta line (cuisine · AED price in amber #F4A261 · pin+area), up to 2 tag pills (#1a1a1a/#2a2a2a border), reasoning line (#E63946 with a dot prefix), and a pinned 3-col action row (Directions/Reserve/Order — icon 20 #666, label 10 #555 uppercase; each col is a flex:1 View wrapper so they split evenly; Directions has paddingLeft 16). Score bars REMOVED (revisit when AI engine is live; `deriveScores` in lib/api is now unused). Tap (onPress) = select (red tint + glow + checkmark; other cards dim to 0.5), long-press (400ms) = RestaurantDetailSheet. Props: `onSelect`, `selected`, `dimmed`.
RestaurantDetailSheet.tsx — reusable bottom-sheet overlay (RN Modal, not a screen): dark backdrop, Reanimated spring slide-up, drag-handle + swipe-down / backdrop-tap to dismiss (react-native-gesture-handler Pan). Top: a full-width paging image carousel (FlatList horizontal + pagingEnabled, ~200px slots, dot pagination) — renders real Images when the `images?: string[]` prop is passed, otherwise 3 dark placeholder slots with a camera icon (wired for future Google Places photo URLs — no restructuring needed later). Below: name, cuisine, price, area, tag chips, rating (number + filled dot), estimated calories, optional description, and the 3 action buttons pinned at the bottom. Exported for reuse (Food Tinder, History). Note: mobile has no Syne font (web-only) so the name uses DMSans_800ExtraBold; the Restaurant model has no description field yet, so description is optional/omitted.

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
✅ Database seeded: 10 Dubai restaurants + 1 DailyPick for today (theme "What Dubai Is Eating Right Now", first 3 restaurants) via `server/prisma/seed.ts` (`cd server && npm run seed`). All restaurants `isActive: true`, ratings 7.9–8.9. NOTE: 'halal' tag removed from all seed data (Dubai default — not a differentiator); mobile also has a `HIDDEN_TAGS = ['halal']` constant in `lib/api.ts` with `visibleTags()` applied wherever tags render (RestaurantDetailSheet chips, `deriveReasoning`) so it never shows even from old data.
✅ Phase M5: Core discovery features (see the Mobile App Screens/Components sections above for detail):
  - Active Decision Flow — the Decide tab is now a 4-step tap-card filter sequence (Location via GPS/expo-location → Cuisine optional multi-select → Delivery/Dine In → Casual/Fancy); Home's old search box was replaced with a "Decide for me →" CTA into that flow. Builds a prompt string and leads to results.tsx, which has a Refresh button (re-runs the same query/mode and replaces all 3 cards).
  - RestaurantDetailSheet — reusable bottom-sheet overlay (RN Modal + Reanimated spring + gesture-handler swipe-to-dismiss). Triggered by long-press (400ms) on ResultCard, and by tap OR long-press on a Food Tinder card, and by tapping a History row.
  - Food Tinder tab (`mobile/app/(tabs)/tinder.tsx`, labelled "Swipe"): swipe right = interested / left = pass on one large card at a time (Gesture.Pan, ±15° rotation, fly-off past threshold, green/red edge tint); "Suggest 3" button (→ "Suggest 3 (Based on your taste)" after 10+ swipes) sends right-swiped IDs and shows 3 picks in results.tsx.
  - History tab (`mobile/app/(tabs)/history.tsx`): authenticated users see past picks (restaurant, action taken as a coloured tag, human date); logged-out and empty states handled; tap a row opens RestaurantDetailSheet.
  - New backend endpoints: `POST /api/decisions/tinder-suggest`, `GET /api/restaurants/nearby`, `GET /api/decisions/history` (all in the API Routes list above).

## What's Not Built Yet
❌ Phase 4: AI decision engine (needs ANTHROPIC_API_KEY in server/.env; replace decisionEngine.ts placeholder)
❌ Google OAuth credentials (needs Google Cloud Console setup — code path exists, degrades gracefully)
❌ Stripe payment integration (Pro subscription)
🅿️ Explore tab — PARKED: placeholder only, to be built after core features are complete. (NOTE: no `explore.tsx` file exists in `app/(tabs)/` yet — the current tabs are Home, Decide, Swipe/Tinder, History, Profile. Create the placeholder tab when work resumes.)
👉 NEXT PHASE (in order): Railway deployment (backend) → Vercel deployment (web landing page) → Phase 4 AI activation → Google Places photo integration → geo-filtering for nearby restaurants
❌ Railway deployment (backend) — see "Railway Environment Variables" section below
❌ Vercel deployment (web landing page)
❌ Google Places photo integration — Food Tinder cards + restaurant detail currently use a gradient placeholder; needs the Places API + a stored photo reference
❌ Geo-filtering for nearby restaurants — `GET /api/restaurants/nearby` accepts lat/lng/radius but returns all active (no distance filtering yet); Decide "Nearby" and Tinder pass coords but they're unused server-side. Needs lat/lng columns in the Restaurant model.
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
Mobile native deps of note: `expo-linear-gradient`, `expo-location` (Decide "Nearby" GPS permission — configured via the `expo-location` plugin in app.json with an iOS `locationWhenInUsePermission` string).

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
Phase M5 (core discovery features — Active Decision Flow, RestaurantDetailSheet, Food Tinder, History) is COMPLETE and the database is seeded (10 restaurants + 1 DailyPick). NEXT PHASE (in order): Railway (backend) → Vercel (web landing page) → Phase 4 AI activation → Google Places photo integration → geo-filtering for nearby restaurants.
First concrete step: deploy `server/` to Railway. Set all keys from the "Railway Environment Variables" section (incl. PORT=3001), run `npx prisma migrate deploy` + `npm run seed` against the Supabase DB, then point `mobile/.env` EXPO_PUBLIC_API_URL and `client/.env` VITE_API_URL at the Railway URL. Then deploy the client/ landing page to Vercel.
Then: Phase 4 AI activation (swap decisionEngine.ts placeholder once ANTHROPIC_API_KEY is set) → Google Places photos (replace Tinder/detail gradient placeholders) → real geo-filtering for `/api/restaurants/nearby` (needs lat/lng columns on Restaurant).
Parked: the Explore tab (placeholder not yet created). Optional non-blocking polish: mobile Profile/Pro live data.

---
After every prompt that adds a feature or completes a phase, update this CLAUDE.md file:
- Move the item from "What's Not Built Yet" to "What's Built"
- Add any new components, routes, or env vars that were created
- Update "Next Session Starting Point" to reflect current progress
Keep this file accurate — it is the single source of truth for the codebase state.
