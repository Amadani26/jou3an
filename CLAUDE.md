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
User has an optional `phoneNumber String?` (migration `add_user_phone_number`) — captured at signup, returned by `sanitize()` on all auth responses.
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
- decide.tsx — Decide: a 4-step guided filter wizard (no text inputs) → Location (Nearby via expo-location GPS permission / Anywhere) → Cuisine (2-column MULTI-select card grid + Skip) → Format (Delivery/Dine In) → Vibe (Casual/Fancy). The Cuisine step is a non-scrolling 4×2 grid of cards (bg #141414, 1px #242424, radius 16, ~100–110 tall, Ionicons outline icon #8A847E above a DMSans_700Bold 16 #F2EDE8 name + DMSans_400Regular 11 #8A847E descriptor, both ellipsized; selected → border #E63946, bg #1a0d0d, icon+name red). Tapping a card TOGGLES it (state is `cuisines: string[]`, any number can be selected at once) — it does NOT advance; a full-width red `RedButton` "Continue →" below the grid does, and stays dimmed/disabled while nothing is picked. A full-width 64pt "Surprise me" card (shuffle icon, red title, #E6394666 border) closes the grid: it and "Skip cuisine →" both advance immediately and clear all selections (mutually exclusive with picked cuisines; neither adds a cuisine to the prompt). All selected cuisines are joined into the prompt string ("Anywhere in Dubai, Lebanese, Japanese, Dine In, Casual"). Rows are flexGrow:1/flexBasis:0 clamped by min/maxHeight; each card is the row's flex child. Slides between steps (Reanimated SlideInLeft/Right), 4-dot progress + back arrow. On finish, builds a prompt string ("Anywhere in Dubai, Lebanese, Dine In, Casual") and pushes to results.tsx. NOTE: "Nearby" requests location permission (denied → silent "Anywhere" fallback) and is included in the prompt string, but true 5km-radius filtering is NOT wired server-side (postDecisionQuery takes only a prompt string — needs backend geo support).
- tinder.tsx — Food Tinder (tab "Swipe", flame icon): fetches GET /api/restaurants/nearby (passes lat/lng from expo-location getLastKnownPosition if permission already granted, else all active). One large swipe card at a time — react-native-gesture-handler Gesture.Pan (rotate ±15°, snap back under threshold, fly off past it), green edge/"INTERESTED" on right-swipe (saved to likedIds) / red edge/"PASS" on left. Tap OR long-press (400ms) opens RestaurantDetailSheet. Bottom "Suggest 3" button (→ "Suggest 3 (Based on your taste)" after 10+ swipes) pushes to results.tsx in tinder mode. Card photo is a branded gradient placeholder — real Google Places photos need the Places API + a photo reference (not available yet).
- history.tsx — History (auth-gated): fetches `GET /api/decisions/history`; scrollable list newest-first, each row = restaurant name, cuisine · area · price, a coloured action tag (Directions=green / Ordered=red / Reserved=gold), and a human date ("Today"/"Yesterday"/"Mon 4 Aug"). Tap a row → RestaurantDetailSheet (actions fall back to Maps — rows carry no phone/delivery URLs). States: 3 shimmer skeleton rows while loading; "Sign in to see your history" + Sign In button when logged out; "No decisions yet — start with the Decide tab" when empty.
- profile.tsx — Profile: redesigned. Logged in → centered 80px initials avatar (bg #1a0a0a), name + email, a 3-tile stats row (Decisions Made / Restaurants Tried / Favourite Cuisine — all derived from `getDecisionHistory()` via React Query), then grouped #111 cards: Preferences (cuisine/budget/dietary → tap routes to /onboarding), Account (edit profile → /onboarding, change password → "coming soon" alert, Upgrade to Pro → /pro, Notifications local Switch), Danger zone (Log out, Delete account — red; delete shows a confirm Alert then logs out, no backend delete endpoint yet). Logged out → centered ج logo, "Sign in to view your profile", Sign In + Create Account buttons.

Stack screens:
- (auth)/login.tsx — Login with email or Google. X/back uses `router.replace('/(tabs)')` (straight to the app); the "Sign up" cross-link uses `<Link replace>` so login/signup never chain through each other.
- (auth)/signup.tsx — Signup. Fields: Name, Email, Phone number (keyboardType 'phone-pad'), Password, Confirm Password — all mandatory. Empty-on-submit fields flag a red asterisk + red tint (local `Field` helper) plus a "Please fill in all fields." message. `signup(name, email, phoneNumber, password)` posts phoneNumber in the body. Same independent-entry behaviour: X/back → `router.replace('/(tabs)')`, "Sign in" cross-link uses `<Link replace>`.
- onboarding.tsx — Post-signup preferences (cuisines, budget, area, dietary)
- results.tsx — 3 COMPACT result cards after decision query (staggered FadeInDown, ProcessingState), sized so all 3 + Refresh fit without scrolling. Below the cards: a hint "Tap to select · Hold for details" (#444/12/center). Supports two fetch modes via params: default `getDecision(prompt, chips)`, or `mode=tinder` → `tinderSuggest(likedIds)` (Refresh re-runs the same mode + clears selection). Optional `title` param overrides the header. Tapping a card body sets `selectedId` → opens `SelectionConfirmCard` (centered spring-in overlay, "You're going to {name}"). Its single "This is it →" button calls `confirmSelection` → `await saveDecisionSelection(sessionId, id, 'SELECT')`, sets `flashVisible` (full-screen "Enjoy your meal" flash for 1.2s), then `router.replace('/(tabs)')` — the decision is FINAL (replace, no back). The overlay X still dismisses back to the 3 cards before confirming. Long-press on a card sets `detailRestaurant` → opens the read-only `RestaurantDetailSheet` (view only, not select). The compact card's own action row still opens external links directly (openDirections/call/order) for a quick path.
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
DailyCard.tsx — daily pick card: full-width placeholder food image header (height 160, top corners radius 24 to match card) with the rank overlaid bottom-left over a dark gradient, then name, cuisine · area, price below. Image = `getPlaceholderImage(rank - 1)`.
placeholderImages.ts (lib/) — 10 curated Unsplash food photo URLs (w=800&q=80) + `getPlaceholderImage(index)` (deterministic, wraps). Static preview imagery until Google Places photos land in Phase 4. Used by DailyCard + ResultCard; the multi-image swipe carousel lives in RestaurantDetailSheet.
ResultCard.tsx — COMPACT decision result card (bg #111111, radius 16, no border, subtle shadow, ~200px tall so 3 fit on screen): placeholder food image header (height 120, top corners radius 16, `getPlaceholderImage(rank-1)`) with the rank (34px red #E63946) overlaid bottom-left over a dark gradient; then name (16/700, 1 line), meta line (cuisine 12 · AED price 12 amber #F4A261 · pin+area 12), and a compact 3-col action row (Directions/Reserve/Order — icon 18 #666, label 9 #555 uppercase). Tag pills were REMOVED from the card (shown in the confirm overlay instead). Tapping the body fires `onSelect` (parent opens the SelectionConfirmCard); long-press (400ms, Medium haptic) fires `onLongPress` (parent opens RestaurantDetailSheet); the action row fires onDirections/onCall/onOrder directly. Props: `rank, name, cuisine, priceRange, area, onSelect, onLongPress, onDirections, onCall, onOrder`.
SelectionConfirmCard.tsx — full-screen selection confirmation (RN Modal). The tapped result "expands" into a centered card (Reanimated spring scale 0.9→1 + rise + fade) over an rgba(0,0,0,0.85) backdrop. Content: dismiss X (top-right), a "You're going to" (#666/13) + restaurant name (white/24/700) header, a paging image carousel (`getPlaceholderImage`), meta line, rating, tag pills, calories, then a single large red "This is it →" RedButton. Props: `visible, restaurant, rank, flashVisible, onClose, onConfirm`. When `flashVisible` it renders a full-screen "Enjoy your meal" flash (DMSans_800ExtraBold — mobile has no Syne) over everything; the parent owns the await-save → flash → `router.replace('/(tabs)')` sequence.
RestaurantDetailSheet.tsx — reusable bottom-sheet overlay (RN Modal, not a screen): dark backdrop, Reanimated spring slide-up, drag-handle + swipe-down / backdrop-tap to dismiss (react-native-gesture-handler Pan). Top: a full-width paging image carousel (FlatList horizontal + pagingEnabled, ~200px slots, dot pagination) — renders real Images when the `images?: string[]` prop is passed, otherwise 3 dark placeholder slots with a camera icon (wired for future Google Places photo URLs — no restructuring needed later). Below: name, cuisine, price, area, tag chips, rating (number + filled dot), estimated calories, optional description, and the 3 action buttons pinned at the bottom. Exported for reuse (Food Tinder, History). Note: mobile has no Syne font (web-only) so the name uses DMSans_800ExtraBold; the Restaurant model has no description field yet, so description is optional/omitted.

⚠️ Mobile styling gotcha (Pressable): do NOT use the function form `style={({ pressed }) => [...]}` on `Pressable` — in this project (NativeWind v4 interop) the returned styles are DROPPED entirely, so the element silently loses its fill/border/radius/padding and collapses to content size. There is no runtime error; it just renders wrong. Always pass a PLAIN style object or array (both work) and drive press feedback with the shared `usePressed()` hook in `mobile/lib/usePressed.ts`:
```tsx
const { pressed, pressHandlers } = usePressed()
<Pressable {...pressHandlers} style={{ ...styles, opacity: pressed ? 0.75 : 1 }} />
```
Standard pressed opacity is 0.75 (0.6 for icon-only / secondary rows). Note hooks can't run in a `.map()`, so a pressable rendered in a list needs its own small component (see `LikedThumb` in tinder.tsx). This bug had silently broken: the decide.tsx cuisine cards + `BigCard`, `Chip`, `GhostButton`, `Card`, `DailyCard`, `ResultCard`'s action row, `RestaurantDetailSheet`'s action buttons, the History/Profile rows, the Login/Signup Google buttons and restaurant/[id]'s `GhostAction` — all swept and fixed. `RedButton` was always fine (it already used a plain array).

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
