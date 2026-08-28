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
Restaurant carries Google Places data (migration `add_google_places_fields`, filled by `npm run sync:places`): `googlePlaceId String? @unique`, `photoRefs String[]` (Places photo resource names, max 6), `lat Float?`, `lng Float?`, `googleRating Float?`, `googleSyncedAt DateTime?`. `photoRefs` is served to clients only as `/api/photos/...` proxy paths. RATINGS: `googleRating` (Google's 0–5 score) is what the app DISPLAYS everywhere — one decimal + a gold #FFB547 Ionicons `star` and the caption "on Google". The whole rating row is hidden when it's null (never fall back to the 0–10 number). The seeded `ratingScore` (0–10) is retained for ranking in `decisionEngine.ts` and is never rendered.
User has an optional `phoneNumber String?` (migration `add_user_phone_number`) — captured at signup, returned by `sanitize()` on all auth responses.
Key enums: LocationArea (JLT, DIFC, DOWNTOWN, BUSINESS_BAY, MARINA, OTHER), BudgetRange (LOW, MID, HIGH), AccountTier (FREE, PRO), DecisionAction (DIRECTIONS, CALL, ORDER, SELECT) — used by the `DecisionSession.actionTaken` field (SELECT = user tapped a result card to pick it; migration `add_select_decision_action`)
Database URL: Supabase connection string in server/.env (two URLs: DATABASE_URL = transaction pooler on :6543 with `pgbouncer=true`; DIRECT_URL = session pooler on :5432 for migrations)

## API Routes (server/)
```
POST   /api/decisions/query            — main decision engine call (optional auth; associates user if logged in). Accepts optional `lat`/`lng`: when present it prefers restaurants within 5km, widens to 10km, then falls back to all of Dubai — whichever tier first yields >=3 candidates, so the "always exactly 3" rule is never broken. Responds with `radiusKm` (5 | 10 | null) and `radiusTier` ('NEARBY' | 'WIDER' | 'CITY'), and every result carries `distanceKm` whenever coords were supplied (even on the city-wide fallback).
POST   /api/decisions/tinder-suggest   — Food Tinder: { likedIds } → 3 picks + sessionId (placeholder: from liked list or random active; AI in Phase 4)
GET    /api/decisions/history          — auth required: user's picks (selectedResultId not null), joined w/ restaurant, newest first, max 50
PATCH  /api/decisions/:id/select       — record user selection + action
GET    /api/restaurants/nearby         — active restaurants for Food Tinder. With `lat`/`lng`: filtered to `radius` KILOMETRES (default 5), sorted nearest-first, each carrying `distanceKm` (1dp). Without coords: all active, unfiltered. ⚠️ `radius` is KM, not metres.
GET    /api/restaurants/:id            — single restaurant
GET    /api/daily/today                — today's Daily Top 3 (restaurants populated)
GET    /api/places/search-area?q=      — Dubai-restricted Places Text Search for the Decide flow's area picker. Returns at most 5 `{ name, area, lat, lng }` — nothing else from Google's payload is forwarded, and its error bodies never are. Rejects q < 2 chars (400). In-memory Map cache, 10min TTL keyed on the normalized query (500-entry cap, oldest evicted) so typing doesn't re-bill Text Search. Results are restricted to a Dubai bounding box via `locationRestriction.rectangle`.
GET    /api/photos/places/:placeId/photos/:photoId — Google Places photo proxy: streams the image server-side with maxWidthPx=800, `Cache-Control: public, max-age=86400`, CORP cross-origin. Keeps GOOGLE_PLACES_API_KEY off the client entirely. Express 5 wildcard route (the photo resource name contains slashes); refs are validated against `^places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+$` before any outbound call.
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
📸 Every endpoint that returns a restaurant (`decisions/query`, `decisions/tinder-suggest`, `decisions/history`, `restaurants/nearby`, `restaurants/:id`, `daily/today`) now includes `photoUrls: string[]` and `googleRating` — relative `/api/photos/...` proxy paths built from the stored `photoRefs` by `server/src/lib/photos.ts` (`withPhotoUrls` / `withPhotoUrlsAll`). Raw Google URLs and the API key are never sent to clients.
Note: the mobile History screen uses `GET /api/decisions/history` (implemented). `GET /api/users/me/history` is still NOT implemented, but nothing depends on it anymore (the old `getUserHistory()` wrapper in mobile/lib/api.ts is now unused).

## Mobile App Screens (mobile/)
Tab screens (app/(tabs)/):
- index.tsx — Home: INFORMATIONAL and fully scrollable — it deliberately does NOT try to fit above the fold; sections are separated by ~36–44px. Top to bottom: (1) hero — 56px red ج logo mark + a 30px DMSans_800ExtraBold headline "Hungry? We decide for you." (`decide` in red italic), sitting under a 440px 3-stop LinearGradient red bloom (0.17 → 0.06 → transparent) that gives the top of the page depth; (2) how-it-works as a VERTICAL TIMELINE (`StepRow`) — no boxes: each step is a row with a 28px #E63946 number on a 46px rail and the copy beside it (title 16/700 white, sub-line 13 #8A847E, never truncated), and a 1px #242424 line that `flex`es down the rail between numbers so the three read as a flow. Steps: 01 "Tell us your vibe", 02 "Get exactly 3 picks", 03 "Eat"; (3) the bouncing full-width "Decide for me →" CTA (unchanged Reanimated spring loop); (4) Daily Top 3 — eyebrow + pulsing dot + date row, then the theme label promoted to a 22px DMSans_800ExtraBold section title, then the full-size DailyCards (skeletons while loading, static FALLBACK_PICKS on failure). NOTE: an earlier revision squeezed everything above the fold with a `compact` DailyCard variant; that prop was removed when the page became scrollable — don't reintroduce cramming here.
- decide.tsx — Decide: a 4-step guided filter wizard → Location, which now has THREE cards: "Nearby" (expo-location GPS permission — captures lat/lng and forwards them to the decision query), "Anywhere in Dubai" (sends no coords), and "Pick an area" (search-outline icon) which expands an INLINE search in place of the cards — autofocused TextInput (#141414 / 1px #242424 / radius 16), 350ms debounce onto `GET /api/places/search-area`, tappable `AreaRow`s (name + muted area + chevron), a "‹ Location options" back control, and the header back arrow closing the search before the step. States: empty input shows nothing, no matches shows "No places found in Dubai.", a failed request shows a retry hint. Picking a result stores its lat/lng and sets the choice to `Near {name}`, so downstream it behaves exactly like "Nearby" (same 5→10→city ladder, same distance display) and the prompt reads e.g. "Near JBR, Lebanese, Dine In, Casual". `LocationChoice` is `'Nearby' | 'Anywhere in Dubai' | \`Near ${string}\``. Stale debounced responses are dropped via a `cancelled` flag so a slow early keystroke can't overwrite a newer result → Cuisine (2-column MULTI-select card grid) → Format (Delivery/Dine In) → Vibe (Casual/Fancy). The Cuisine step, top to bottom, is: a full-width 64pt "No preference" card (help-circle-outline icon, "Show me anything") → a non-scrolling 4×2 grid of cuisine cards → a full-width 64pt "Surprise me" card (shuffle icon, red title, #E6394666 border) → a red `RedButton` "Continue →". Grid cards are bg #141414, 1px #242424, radius 16, ~65–94 tall, Ionicons outline icon #8A847E above a DMSans_700Bold 16 #F2EDE8 name + DMSans_400Regular 11 #8A847E descriptor (both ellipsized); selected → border #E63946, bg #1a0d0d, icon+name red. Tapping a grid card TOGGLES it (state is `cuisines: string[]`, any number selectable at once) — it does NOT advance; only "Continue →" does, and it stays dimmed/disabled while nothing is picked. "No preference" and "Surprise me" both advance immediately and clear all selections (mutually exclusive with picked cuisines; neither adds a cuisine to the prompt) — the old "Skip cuisine →" text link was removed as redundant with "No preference". All selected cuisines are joined into the prompt string ("Anywhere in Dubai, Lebanese, Japanese, Dine In, Casual"). Rows are flexGrow:1/flexBasis:0 clamped by min/maxHeight (64/94) so the whole step fits without scrolling; each card is the row's flex child. `CuisineCard` takes `wide` (full-width 64pt row layout) and `surprise` (red accent) as separate props, so "No preference" reuses the wide layout with normal styling. Slides between steps (Reanimated SlideInLeft/Right), 4-dot progress + back arrow. On finish, builds a prompt string ("Anywhere in Dubai, Lebanese, Dine In, Casual") and pushes to results.tsx. "Nearby" requests location permission (denied → silent "Anywhere" fallback) and its coordinates drive real server-side radius filtering — see the Geo-filtering entry under What's Built.
- tinder.tsx — Food Tinder (tab "Swipe", flame icon): fetches GET /api/restaurants/nearby (passes lat/lng from expo-location getLastKnownPosition if permission already granted, else all active). One large swipe card at a time — react-native-gesture-handler Gesture.Pan (rotate ±15°, snap back under threshold, fly off past it), green edge/"INTERESTED" on right-swipe (saved to likedIds) / red edge/"PASS" on left. Tap OR long-press (400ms) opens RestaurantDetailSheet. Bottom "Suggest 3" button (→ "Suggest 3 (Based on your taste)" after 10+ swipes) pushes to results.tsx in tinder mode. Card photo is an auto-playing SLIDESHOW of the restaurant's real Places photos (`CardSlideshow` in tinder.tsx): cycles all photoUrls (up to 6) every 2.5s with a 400ms Reanimated opacity cross-fade, under an Instagram-stories-style segmented progress bar (one bar per photo, active one fills linearly, white at 0.22/0.85 opacity). Mounted with `key={current.id}` so a new card remounts it — that resets to photo 1 and disposes the timer in one step. Dragging the card pauses the timer (pan `.onStart`/`.onFinalize` → `dragging` state) and banks the elapsed time so resuming doesn't restart the photo. Restaurants with no photos keep the branded gradient + fork icon and show no indicator. NOTE: the slides carry zIndex to order the cross-fade, so they live inside their own absolute-fill wrapper — without it they paint above the card's bottom scrim and info overlay.
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
DailyCard.tsx — daily pick card: full-width real Places photo header (height 160, top corners radius 24 to match card) with the rank overlaid bottom-left over a dark gradient, then name, cuisine · area, price below. Image = `getPlaceholderImage(rank - 1)`.
placeholderImages.ts (lib/) — 10 curated Unsplash food photo URLs (w=800&q=80) + `getPlaceholderImage(index)` (deterministic, wraps). Static preview imagery until Google Places photos land in Phase 4. Used by DailyCard + ResultCard; the multi-image swipe carousel lives in RestaurantDetailSheet.
ResultCard.tsx — COMPACT decision result card (bg #111111, radius 16, no border, subtle shadow, ~200px tall so 3 fit on screen): placeholder food image header (height 120, top corners radius 16, `getPlaceholderImage(rank-1)`) with the rank (34px red #E63946) overlaid bottom-left over a dark gradient; then name (16/700, 1 line), meta line (cuisine 12 · AED price 12 amber #F4A261 · pin+area 12), and a compact 3-col action row (Directions/Reserve/Order — icon 18 #666, label 9 #555 uppercase). Tag pills were REMOVED from the card (shown in the confirm overlay instead). Tapping the body fires `onSelect` (parent opens the SelectionConfirmCard); long-press (400ms, Medium haptic) fires `onLongPress` (parent opens RestaurantDetailSheet); the action row fires onDirections/onCall/onOrder directly. Props: `rank, name, cuisine, priceRange, area, onSelect, onLongPress, onDirections, onCall, onOrder`.
SelectionConfirmCard.tsx — full-screen selection confirmation (RN Modal). The tapped result "expands" into a centered card (Reanimated spring scale 0.9→1 + rise + fade) over an rgba(0,0,0,0.85) backdrop. Content: dismiss X (top-right), a "You're going to" (#666/13) + restaurant name (white/24/700) header, a paging image carousel (`getPlaceholderImage`), meta line, rating, tag pills, calories, then a single large red "This is it →" RedButton. Props: `visible, restaurant, rank, flashVisible, onClose, onConfirm`. When `flashVisible` it renders a full-screen "Enjoy your meal" flash (DMSans_800ExtraBold — mobile has no Syne) over everything; the parent owns the await-save → flash → `router.replace('/(tabs)')` sequence.
RestaurantDetailSheet.tsx — takes `googleRating?: number | null` (NOT ratingScore); reusable bottom-sheet overlay (RN Modal, not a screen): dark backdrop, Reanimated spring slide-up, drag-handle + swipe-down / backdrop-tap to dismiss (react-native-gesture-handler Pan). Top: a full-width paging image carousel (FlatList horizontal + pagingEnabled, ~200px slots, dot pagination) — renders real Images when the `images?: string[]` prop is passed, otherwise 3 dark placeholder slots with a camera icon (wired for future Google Places photo URLs — no restructuring needed later). Below: name, cuisine, price, area, tag chips, rating (number + filled dot), estimated calories, optional description, and the 3 action buttons pinned at the bottom. Exported for reuse (Food Tinder, History). Note: mobile has no Syne font (web-only) so the name uses DMSans_800ExtraBold; the Restaurant model has no description field yet, so description is optional/omitted.

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
✅ Database seeded: 10 Dubai restaurants (all Places-verified) + 1 DailyPick for today (theme "What Dubai Is Eating Right Now", first 3 restaurants) via `server/prisma/seed.ts` (`cd server && npm run seed`). All restaurants `isActive: true`, ratings 7.9–8.9. NOTE: 'halal' tag removed from all seed data (Dubai default — not a differentiator); mobile also has a `HIDDEN_TAGS = ['halal']` constant in `lib/api.ts` with `visibleTags()` applied wherever tags render (RestaurantDetailSheet chips, `deriveReasoning`) so it never shows even from old data.
✅ Phase M5: Core discovery features (see the Mobile App Screens/Components sections above for detail):
  - Active Decision Flow — the Decide tab is now a 4-step tap-card filter sequence (Location via GPS/expo-location → Cuisine optional multi-select → Delivery/Dine In → Casual/Fancy); Home's old search box was replaced with a "Decide for me →" CTA into that flow. Builds a prompt string and leads to results.tsx, which has a Refresh button (re-runs the same query/mode and replaces all 3 cards).
  - RestaurantDetailSheet — reusable bottom-sheet overlay (RN Modal + Reanimated spring + gesture-handler swipe-to-dismiss). Triggered by long-press (400ms) on ResultCard, and by tap OR long-press on a Food Tinder card, and by tapping a History row.
  - Food Tinder tab (`mobile/app/(tabs)/tinder.tsx`, labelled "Swipe"): swipe right = interested / left = pass on one large card at a time (Gesture.Pan, ±15° rotation, fly-off past threshold, green/red edge tint); "Suggest 3" button (→ "Suggest 3 (Based on your taste)" after 10+ swipes) sends right-swiped IDs and shows 3 picks in results.tsx.
  - History tab (`mobile/app/(tabs)/history.tsx`): authenticated users see past picks (restaurant, action taken as a coloured tag, human date); logged-out and empty states handled; tap a row opens RestaurantDetailSheet.
  - New backend endpoints: `POST /api/decisions/tinder-suggest`, `GET /api/restaurants/nearby`, `GET /api/decisions/history` (all in the API Routes list above).

✅ Google Places integration (backend + mobile):
  - Schema fields + `npm run sync:places` + the `/api/photos` proxy + `photoUrls` on every restaurant endpoint + real photos in ResultCard, DailyCard, SelectionConfirmCard carousel, RestaurantDetailSheet carousel and the Tinder card (all fall back to `getPlaceholderImage` when `photoRefs` is empty). All 10 seeded restaurants synced with 6 photos each. Two matches need a human sanity check: "Sushi Counter" resolved to **SushiArt DIFC** (a different brand) and "Operation Falafel" resolved to the **JBR** branch though it's seeded as JLT — fix by correcting the name/area in the DB or setting `googlePlaceId` by hand, then re-running the sync.
  - New files: `server/src/services/googlePlaces.ts` (Text Search / Place Details / photo URL + owner-photo ranking), `server/src/lib/photos.ts` (`withPhotoUrls`), `server/src/routes/photos.ts` (proxy), `server/src/scripts/syncGooglePlaces.ts` (`npm run sync:places`).
  - Mobile: `photoUrls(restaurant)` in `mobile/lib/api.ts` turns the server's relative proxy paths into absolute URLs using EXPO_PUBLIC_API_URL. `ResultCard`/`DailyCard` take an optional `imageUrl` prop; `SelectionConfirmCard`'s Carousel takes `photos: string[]`; `RestaurantDetailSheet` gets `images`; the Tinder card renders `currentPhoto`. The Tinder bottom scrim was deepened (320px, 3 stops) because real photos are often bright and were washing out the white title.

✅ Geo-filtering (real distance, haversine — no PostGIS):
  - `server/src/lib/geo.ts` — `distanceKm(a,b)` haversine, `roundKm`, `hasCoords` (generic type guard so narrowing keeps the row's type), `withinRadius(rows, origin, km)` which annotates + filters + sorts nearest-first. Rows with null lat/lng are excluded — an unknown distance can't be claimed as nearby.
  - `/api/restaurants/nearby` filters + sorts; `/api/decisions/query` uses the 5km → 10km → city tier ladder described in the routes list.
  - Mobile: the Decide flow captures coords when the user picks "Nearby" (`getLastKnownPositionAsync`, falling back to `getCurrentPositionAsync`; permission denial or any error degrades silently to a city-wide search) and passes them through the results route params into `getDecision(prompt, chips, coords)`. "Anywhere in Dubai" sends none. `prettyDistance()` in lib/api.ts renders "1.2 km"; shown on ResultCard, the Tinder card meta line and RestaurantDetailSheet, and simply omitted when absent.
  - ⚠️ UNIT: the server reads `radius` as KILOMETRES. `getNearbyRestaurants` previously defaulted to `5000` (metres), which would have disabled filtering entirely — it is now `radiusKm = 5`.
  - Testing: the iOS simulator defaults to San Francisco, so everything filters out. Use `xcrun simctl location booted set 25.2048,55.2708` (Downtown) — or Features → Location → Custom Location. Al Quoz (25.14, 55.23) exercises the 10km widening; somewhere remote like 24.8,56.12 exercises the city fallback.

## What's Not Built Yet
❌ Phase 4: AI decision engine (needs ANTHROPIC_API_KEY in server/.env; replace decisionEngine.ts placeholder)
❌ Google OAuth credentials (needs Google Cloud Console setup — code path exists, degrades gracefully)
❌ Stripe payment integration (Pro subscription)
🅿️ Explore tab — PARKED: placeholder only, to be built after core features are complete. (NOTE: no `explore.tsx` file exists in `app/(tabs)/` yet — the current tabs are Home, Decide, Swipe/Tinder, History, Profile. Create the placeholder tab when work resumes.)
👉 NEXT PHASE (in order): TestFlight build (mobile) → Vercel deployment (web landing page) → Phase 4 AI activation (Railway backend + geo-filtering are DONE)
✅ Railway deployment (backend) — LIVE. Config in `server/railway.json`; see "Railway Deployment Setup" below
❌ TestFlight / App Store submission — config READY and the prod API URL is baked in (`mobile/eas.json`); blocked only on a real app icon + the interactive EAS steps
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
- GOOGLE_PLACES_API_KEY (Places API (New) — Text Search, Place Details, Photo media). SERVER-ONLY: never expose it to the client; photos are served through the /api/photos proxy. server/.env is gitignored (`.gitignore` line 6).
- GOOGLE_CLIENT_ID (not yet set up)
- GOOGLE_CLIENT_SECRET (not yet set up)
- SESSION_SECRET
- ADMIN_EMAIL (email of the admin user for /api/admin/* routes)

mobile/.env required keys:
- EXPO_PUBLIC_API_URL (http://localhost:3001 for dev, Railway URL for prod; use LAN IP on a physical device). For BUILDS this comes from `mobile/eas.json` `build.<profile>.env`, not from a .env file — see "TestFlight Build Prep".
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
- GOOGLE_PLACES_API_KEY
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- SESSION_SECRET
- PORT=3001
- CLIENT_URL (production Vercel URL of the landing page — added to the CORS allowlist; falls back to http://localhost:5173 if unset)

## Railway Deployment Setup (backend)
⚠️ The Railway service's **Root Directory is `server/`**, so every command runs INSIDE `server/` — it is NOT the monorepo root. Therefore **no `--workspace=server` / `-w server` flags anywhere** in the Railway build or start commands: from that root there are no npm workspaces at all and npm fails with `No workspaces found: --workspace=server`. Run the plain scripts instead.

`server/railway.json` (the source of truth — it overrides anything typed into the Railway dashboard):
```json
{
  "build":  { "builder": "NIXPACKS", "buildCommand": "npm run build" },
  "deploy": {
    "preDeployCommand": "npx prisma migrate deploy",
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE"
  }
}
```
- **Build**: `npm run build` → `prisma generate && tsc` (server/package.json). Prisma Client MUST be generated before `tsc`, and again on every deploy because Nixpacks builds in a fresh container where `node_modules/.prisma` doesn't exist yet.
- **Migrations**: run via Railway's **`deploy.preDeployCommand`** (`npx prisma migrate deploy`) — chosen over prepending to `start` so that a failed migration fails the deploy and keeps the previous version live, and so it runs exactly once per deploy instead of on every container restart/replica.
- **Start**: `npm start` → `node dist/index.js` — the compiled JS. Never `ts-node` in production (ts-node/ts-node-dev are devDependencies and add startup cost).
- Nixpacks runs `npm install` (there is no `package-lock.json` inside `server/`, so `npm ci` would fail — don't set one as the install command).
- `server/package.json` declares `"engines": { "node": ">=20" }`.
- Seeding is **not** automatic — run it once by hand after the first deploy: `railway run npm run seed` (or `npm run seed` locally against the same Supabase DB).
- The server binds `Number(process.env.PORT) || 3001`; Railway injects `PORT`, so the explicit `PORT=3001` variable is optional.

## TestFlight Build Prep (mobile)
**Production API URL: `https://server-production-0599.up.railway.app`** (Railway, live).
- **`mobile/eas.json` `build.<profile>.env.EXPO_PUBLIC_API_URL` is the source of truth for builds.** `development` → `http://localhost:3001`; `preview` and `production` → the Railway URL.
- `mobile/.env.production` exists only for LOCAL production-mode parity (`npx expo export`). It is **gitignored** (root `.gitignore` line 4 matches `.env.production` at any depth), so it is never uploaded to the EAS build workers — never rely on it for a real build. Keep its value in sync with eas.json by hand.
- **ONE origin, one fallback.** `mobile/lib/api.ts` exports `API_BASE_URL` — the only place the origin is resolved. `login.tsx` / `signup.tsx` import it for the Google-OAuth `Linking.openURL` instead of re-deriving `process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'` with their own fallback (they used to; three copies meant three ways to ship localhost). The single remaining `localhost:3001` fallback is the `expo start` default.
- `EXPO_PUBLIC_*` is inlined at BUILD time, so it must stay a static `process.env.EXPO_PUBLIC_API_URL` member expression — never destructure or index into `process.env`, or the substitution silently doesn't happen.
- Photo proxy: the server returns relative `/api/photos/...` paths and `photoUrls()` concatenates them onto `API_BASE_URL`, so they follow the same value automatically. Trailing slashes are stripped so `https://host/` can't produce `https://host//api/photos/...`.

**Verify the URL is actually baked into a bundle** — this is what catches an API-unreachable TestFlight build BEFORE uploading:
```bash
cd mobile && rm -rf dist
EXPO_PUBLIC_API_URL=https://server-production-0599.up.railway.app npx expo export --platform ios --clear
B=$(ls dist/_expo/static/js/ios/*.hbc)
strings "$B" | grep -c "server-production-0599.up.railway.app"   # expect 1
strings "$B" | grep -c "localhost:3001"                          # expect 0
```
⚠️ **`--clear` is mandatory here.** Metro's transform cache does NOT invalidate when only the env value changes, so without it `expo export` happily re-emits the previous bundle and the grep reports whatever the last run baked in — a false pass. Confirm the `.hbc` filename hash changes between runs. (Verified: with a cleared cache and no env source the bundle contains `localhost:3001` and zero occurrences of the domain — exactly the failing build; with the env var set it is 1 / 0.) EAS Build itself always runs in a fresh container, so this caveat is local-only.

**Smoke test the production backend** (`scripts/smoke-prod.sh`, URL read from `mobile/eas.json` or passed as `$1`):
```bash
./scripts/smoke-prod.sh                    # uses eas.json production env
./scripts/smoke-prod.sh http://localhost:3001
```
Checks `/health`, `/api/daily/today`, that the daily payload has **exactly 3** results, and that the first `photoUrls` path returns a real `image/*` through the proxy. Exits 2 if the URL is still the `YOUR-RAILWAY-DOMAIN` placeholder. ✅ All four checks pass against the live Railway backend.

**`mobile/app.json` store readiness** — `name` Jou3an, `slug` jou3an, `version` 1.0.0, `ios.bundleIdentifier` `com.jou3an.app` (kept — already unique and matches the Android package; changing it after App Store Connect registration is painful), plus newly added `ios.buildNumber` "1", `android.versionCode` 1, and `ios.config.usesNonExemptEncryption: false` (skips the export-compliance question on every TestFlight upload).
🚨 **BLOCKER — placeholder art.** `assets/icon.png` and `assets/splash-icon.png` are still the stock Expo template images (blue "A" chevron / grey target grid), both 1024×1024. TestFlight will accept them, but the app ships unbranded. Replace with real Jou3an artwork (red #E8272A ج mark on #080808) before submitting. `assets/android-icon-*.png` are placeholders too.

**EAS build profiles** (`mobile/eas.json`): `cli.appVersionSource: "local"` (versions come from app.json) and `production` uses `"autoIncrement": true` — each production build bumps `ios.buildNumber` in `app.json`, which avoids the duplicate-build-number rejection but means **builds modify app.json**; commit the bump.
⚠️ At the BUILD-PROFILE level `autoIncrement` must be a **boolean** — `"autoIncrement": "buildNumber"` fails validation with `eas.json is not valid. - "build.production.autoIncrement" must be a boolean`. The `"version"` / `"buildNumber"` string form is only valid nested under a platform key (`production.ios.autoIncrement`). On iOS `true` already means "bump buildNumber".
Validate eas.json offline, without a linked EAS project, using the CLI's own schema:
```bash
cd mobile && node -e 'const{EasJsonAccessor,EasJsonUtils}=require(require("child_process").execSync("npm root -g").toString().trim()+"/eas-cli/node_modules/@expo/eas-json");(async()=>{const a=EasJsonAccessor.fromProjectPath(process.cwd());const n=await EasJsonUtils.getBuildProfileNamesAsync(a);for(const p of n)await EasJsonUtils.getBuildProfileAsync(a,"ios",p);console.log("eas.json OK:",n.join(", "))})().catch(e=>{console.error(e.message);process.exit(1)})'
```
(`eas config --non-interactive` cannot do this before `eas init` — it errors on the missing project id first.)

**Interactive steps — run these yourself, in order** (`eas-cli` 22.4.0 is already installed globally):
```bash
cd mobile
eas login                                          # Expo account
eas init                                           # writes extra.eas.projectId + owner into app.json — commit it
eas build --platform ios --profile production      # prompts for Apple ID; lets EAS manage certs/provisioning
eas submit --platform ios --profile production     # pick the build; prompts Apple ID + app-specific password
```
Requires a **paid** Apple Developer account. On first `eas submit` the app record must exist in App Store Connect (EAS offers to create it); after upload it appears in TestFlight in ~10–15 min, and Apple emails when processing finishes. Fill `submit.production.ios` in eas.json with `appleId` / `ascAppId` / `appleTeamId` only if you want to skip the prompts on later runs.

## Dev Commands
From /jou3an root: `npm run dev` (starts client on :5173 + server on :3001 via concurrently)
From /jou3an/mobile: `npx expo start` (then press i for iOS simulator)
Server only: `cd server && npm run dev`
Client only: `npm run dev -w client`
Database migrations: `cd server && npx prisma migrate dev`
Database seed: `cd server && npm run seed`
Google Places sync: `cd server && npm run sync:places` (Text Search "{name} {area} Dubai" → Place Details; stores up to 6 photoRefs, lat/lng, googleRating, googleSyncedAt; prints a matched/pinned/unmatched table and flags places matched under a different Google name). Safe to re-run — it overwrites the Places fields only.
📌 PINNING: a restaurant that already has a `googlePlaceId` skips Text Search entirely and fetches details for that id (status `pinned` in the table). This is how a specific branch is locked when search picks the wrong one. Clear the column to let search decide again. Two rows are pinned in `seed.ts`: Ravi Restaurant (Satwa, `ChIJN81uvipDXz4RH_4cyTocRMI` — search lands on Al Nahda) and Sushi Art (DIFC, `ChIJj5caDJJCXz4RuHx7vNMaj_c`).
⚠️ Prisma migrations: NEVER pass DIRECT_URL (or DATABASE_URL) as `--shadow-database-url` to `prisma migrate diff --from-migrations` — Prisma RESETS the shadow database, which drops every table in it. Use `prisma migrate dev` interactively, or a genuinely separate throwaway database. The migration history was baselined on 2026-08-26 (`migrate resolve --applied` for the first three migrations), so `prisma migrate deploy` now works normally.
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
Railway backend is LIVE at `https://server-production-0599.up.railway.app` (all 4 smoke checks pass) and the mobile TestFlight config is DONE — the prod API URL is baked into `mobile/eas.json` and verified inlined into an actual iOS bundle.
ONE blocker remains for a shippable TestFlight build: **replace the stock Expo placeholder `mobile/assets/icon.png` and `splash-icon.png`** (and `android-icon-*.png`) with real Jou3an artwork.
Rebuild + resubmit: `cd mobile && eas build --platform ios --profile production --clear-cache` then `eas submit --platform ios --profile production`. `eas login` is already done (accounts: amadani26, amadani26s-team); `eas init` still needs running once to write `extra.eas.projectId` into app.json.
After that: Vercel (client/ landing page) → Phase 4 AI activation (swap the `decisionEngine.ts` placeholder once ANTHROPIC_API_KEY is set).
Note: the seeded DailyPick is dated 2026-08-25; `/api/daily/today` falls back to the most recent live pick, so the app always has data, but re-seed for a fresh date.
Parked: the Explore tab (placeholder not yet created). Optional non-blocking polish: mobile Profile/Pro live data.

---
After every prompt that adds a feature or completes a phase, update this CLAUDE.md file:
- Move the item from "What's Not Built Yet" to "What's Built"
- Add any new components, routes, or env vars that were created
- Update "Next Session Starting Point" to reflect current progress
Keep this file accurate — it is the single source of truth for the codebase state.
