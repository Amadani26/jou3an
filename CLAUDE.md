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
Colors: red **#FE0000** (web), gold #FFB547, green #2DCE89
⚠️ RED SPLIT — read this before touching a red hex. `client/src/index.css` `--red` is the single source of truth for the WEB red and is now **#FE0000**. History: #E8272A → #FF3133 (sampled from the logo PNGs) → **#FE0000** (current). Every hardcoded red in `client/` follows it — the old `rgba(255,49,51,…)` literals were swept to `rgba(254,0,0,…)`. ⚠️ **The brand PNGs were NOT regenerated**: `client/public/brand/jou3an-logo.png`'s "3" and `jou3an-icon-*.png` are still **#FF3133**, so the artwork red is one shade off the CSS token. They never meet edge-to-edge (the wordmark sits on #080808 in the nav/footer/splash) and the delta is imperceptible at the sizes used — but re-export the art at #FE0000 to close the gap. **`mobile/` was deliberately NOT swept** — it still hardcodes #E8272A / #E63946 inline across many files. Unify it when the app icon artwork is done.
Background: #080808 (base), #0F0F0F, #141414, #1A1A1A, #222222
Border: #242424 (default), #1C1C1C (soft)
Text: #F2EDE8 (primary), #8A847E (secondary), #504B47 (muted)
Fonts: Syne 800 (display/headlines, web), DM Sans (body), Instrument Serif italic (accent, web)
  - Mobile note: only DM Sans is loaded (weights 400/500/600/700/800). Syne/Instrument Serif are web-only; mobile uses DM Sans 800 for display and `fontStyle: 'italic'` for accents.
Border radius: 10px (sm), 16px (md), 24px (lg), 32px (xl)
Animation: cubic-bezier(0.16,1,0.3,1) ease-out throughout

### Brand Assets (`client/public/brand/`)
The official artwork. Served from `/brand/...` — they are static `public/` files, so the paths are absolute and never hashed by Vite.
- `jou3an-logo.png` — transparent wordmark, **973×186**, WHITE letters + a #FF3133 "3" (the artwork red, NOT the current #FE0000 CSS token — see RED SPLIT above). ⚠️ **White text: it must never sit on a light background.** Rendered via `client/src/components/Logo.tsx`, which takes a `height` and derives the width from the 973/186 ratio, sets explicit `width`/`height` attributes (no CLS in the fixed nav), and carries `alt="Jou3an"`. Every use is far under half the intrinsic size, so it stays crisp on retina: nav 24px (mobile) / 28px (md+), footer 34px, boot splash 210×40.
- `jou3an-icon-512.png` / `-180` / `-32` — the standalone red "3", transparent. 32 = favicon, 180 = apple-touch-icon, 512 + 180 = `site.webmanifest` icons. All `purpose: "any"` — **not maskable**: the glyph fills ~80% of the canvas width, so Android's maskable safe zone would clip it.
- `jou3an-logo-black.jpeg` — wordmark on solid black, **1080×1350** (note the extension is `.jpeg`, not `.jpg`). Used as `og:image` / `twitter:image`. The wordmark is vertically centred (content box 892×107 at y≈632), so X's 1.91:1 centre crop keeps it intact.
Deleted with this change: the old placeholder `public/favicon.svg`, `public/icons.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/manifest.json`, and `client/scripts/generate-icons.mjs` (the script existed only to render those placeholder "white ج on a red square" icons). `sharp` is still a devDependency but no longer has a consumer.

## Database Schema (Prisma)
Models: User, Restaurant, DecisionSession, DailyPick, **UserTasteProfile**, **DecisionLog** (the last two added by DecisionEngine v2, migration `decision_engine_v2`)
Restaurant carries Google Places data (migration `add_google_places_fields`, filled by `npm run sync:places`): `googlePlaceId String? @unique`, `photoRefs String[]` (Places photo resource names, max 6), `lat Float?`, `lng Float?`, `googleRating Float?`, `googleSyncedAt DateTime?`. `photoRefs` is served to clients only as `/api/photos/...` proxy paths. RATINGS: `googleRating` (Google's 0–5 score) is what the app DISPLAYS everywhere — one decimal + a gold #FFB547 Ionicons `star` and the caption "on Google". The whole rating row is hidden when it's null (never fall back to the 0–10 number). The seeded `ratingScore` (0–10) is retained for ranking in `decisionEngine.ts` and is never rendered.
User has an optional `phoneNumber String?` (migration `add_user_phone_number`) — captured at signup, returned by `sanitize()` on all auth responses.
Restaurant also carries `openingHours Json?` (same migration) — Google's `regularOpeningHours.periods` stored VERBATIM: `[{ open: {day,hour,minute}, close?: {…} }]`, `day` 0=Sunday..6=Saturday in the place's local time. A period with **no `close` means open 24/7**. ⚠️ Never read this column inline — always go through `isOpenNow()` in `server/src/lib/hours.ts`.
**UserTasteProfile**: `userId` (unique, FK, cascade delete), `weights Json` (flat map of lowercased cuisine/tag -> float), `updatedAt`. **DecisionLog**: `userId?`, `sessionId?`, `inputSummary Json`, `breakdown Json`, `chosenIds String[]`, `radiusTier`, `createdAt`, indexed on `(userId, createdAt)`.
Key enums: LocationArea (JLT, DIFC, DOWNTOWN, BUSINESS_BAY, MARINA, OTHER), BudgetRange (LOW, MID, HIGH), AccountTier (FREE, PRO), DecisionAction (DIRECTIONS, CALL, ORDER, SELECT) — used by the `DecisionSession.actionTaken` field (SELECT = user tapped a result card to pick it; migration `add_select_decision_action`)
Database URL: Supabase connection string in server/.env (two URLs: DATABASE_URL = transaction pooler on :6543 with `pgbouncer=true`; DIRECT_URL = session pooler on :5432 for migrations)

## API Routes (server/)
```
POST   /api/decisions/query            — main decision engine call (optional auth; associates user if logged in). **Runs DecisionEngine v2 when `ENGINE_V2=true`, else the legacy keyword matcher — identical response shape either way, plus `engine: 'v1'|'v2'` and, on v2, a `reason` string per result.** Accepts the v2 structured filters `{ cuisines: string[], format: 'Delivery'|'Dine In', vibe: 'Casual'|'Fancy', areaName?, refreshNonce }` — all optional, so an older build sending only `prompt` still works. Accepts optional `lat`/`lng`: when present it prefers restaurants within 5km, widens to 10km, then falls back to all of Dubai — whichever tier first yields >=3 candidates, so the "always exactly 3" rule is never broken. Responds with `radiusKm` (5 | 10 | null) and `radiusTier` ('NEARBY' | 'WIDER' | 'CITY'), and every result carries `distanceKm` whenever coords were supplied (even on the city-wide fallback).
POST   /api/decisions/tinder-suggest   — Food Tinder: { likedIds?, swipes? } → 3 picks + sessionId. `swipes` ([{restaurantId, direction:'LEFT'|'RIGHT'}]) is the DecisionEngine v2 addition; `likedIds` still works unchanged for older app builds and right-swipes from `swipes` are merged into it. Signed-in callers have every swipe fed to their taste profile (LEFT included).
GET    /api/decisions/history          — auth required: user's picks (selectedResultId not null), joined w/ restaurant, newest first, max 50
PATCH  /api/decisions/:id/select       — record user selection + action. When `actionTaken === 'SELECT'` and the SESSION has a userId, applies a SELECT (+3) taste event for that restaurant's cuisine. Takes no auth (the mobile client fires it in the background), so the learner is the session's own userId — never the request's.
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
✅ Landing page → **WAITLIST LAUNCH PAGE** (`client/src/pages/Landing.tsx`, only route is "/"). All App Store / Google Play download buttons are GONE — there is exactly ONE call to action on the page, the `WaitlistCTA` "Join the Waitlist" button, rendered in the hero and again at the end of the app-preview section; both smooth-scroll to `#waitlist` (via `client/src/lib/scroll.ts`, which also focuses the email input after the scroll settles). Nav's CTA uses the same helper. **8 sections, in order**: (1) Hero — headline/orbs (both orbs now parallax), WaitlistCTA in place of the two download buttons; (2) How It Works — a VERTICAL TIMELINE (`StepRow`, numbered rail + connecting 1px line, no boxes) matching the mobile Home screen, with the app's real flow: 01 "Tell it your vibe", 02 "Swipe or let Jou3an decide", 03 "Get your 3"; (3) The 3 Rule; (4) **Interactive decision-engine demo** (`AppPreview.tsx` — a 4-step brief then exactly 3, no swipe deck; see below); (5) Waitlist — now a TWO-COLUMN `lg:grid-cols-[minmax(0,1fr)_auto]`: the heading + `WaitlistForm` on the left, the CSS `PhoneMockup` on the right. Below `lg` it collapses to one column and the phone stacks BELOW the form; (6) **What is Jou3an** (`WhatIsJou3an.tsx` — see below); (7) **FAQ** (`FAQ.tsx` — 6-question accordion); (8) Footer. The old "What are you in the mood for" mood-chip showcase was REMOVED entirely (the local `Chip` helper and `MOODS` array with it). Removed earlier and still gone: all other pages, AuthContext, PrivateRoute, BottomNav, InstallPrompt, Layout, MoodChips/DailyCard/ResultCard/ProcessingState/GoogleIcon, lib/{api,hooks,haptics}, and the react-query + axios deps. Design system, fonts, CSS variables, Tailwind config and PWA (manifest + service worker) kept as-is.
  - ⚠️ **Hero headline sizing**: the `h1` is `clamp(2rem, 10.5vw, 6.5rem)` with `lineHeight: 0.95`. The vw term MUST lead on phones — the previous `clamp(3.2rem, 9vw, 6.5rem)` let the 3.2rem floor win on every handset (9vw is only ~36px at a 402pt viewport), so "HUNGRY?" rendered wider than the padded viewport and was clipped at both edges by the page's `overflow-hidden`. Verified in real iPhone Safari on the simulator. Desktop is unchanged (the 6.5rem cap still binds above ~990px).
  - **Branding**: the nav and footer wordmarks are now the real `jou3an-logo.png` via `<Logo />` (the old `Jou3an` / `Jou<span>3</span>an` text treatments and the little red dot over the 3 are gone), as is the boot splash in `index.html`. The HERO was left as styled text on purpose — its headline is the tagline "Hungry? We decide", not the brand name, and the fixed nav already shows the wordmark ~56px above it, so an image there would double up. All three logo surfaces are dark (nav `rgba(8,8,8,0.72)` + blur, footer/splash `#080808`); even a white photo from the app-preview scrolling under the translucent nav composites to ≈#4D4D4D, keeping white-on-nav at ~8:1.
  - **`index.html` head**: favicon 32 / apple-touch-icon 180 / `rel="manifest"` → `/site.webmanifest`, a `<meta name="description">`, `rel="canonical"`, a real `<title>`, a `preload` for the wordmark (so the splash paints it without a blank beat), and the full Open Graph + Twitter card set — `og:url` `https://www.jou3an.me`, `og:image` / `twitter:image` → `/brand/jou3an-logo-black.jpeg` (absolute URL, with `og:image:width/height`), `twitter:card` `summary_large_image`.
  - `public/site.webmanifest` REPLACES `public/manifest.json`. `public/sw.js` was bumped to `CACHE_NAME = 'jou3an-v2'` with a new `APP_SHELL` — **mandatory**, because `cache.addAll()` rejects wholesale if any pre-cached URL 404s and the old shell listed files that no longer exist.
✅ Stale-deploy recovery (client/) — a cached index.html from an older deploy points at hashed bundles the server has dropped; they 404, the entry module never runs, and the page is a white screen. Two halves:
  - **`client/index.html` inline `<script>`** (near the top of `<head>`, section marked "Stale-deploy recovery"). ⚠️ It MUST stay inline and MUST stay ABOVE the bundle tags Vite injects — the failure it handles is the entry module not executing, so nothing inside the bundle can repair it, and a capture-phase listener only sees tags parsed after it registers. It catches `error` (capture phase — resource errors don't bubble) on same-origin `<script>` / `<link rel=stylesheet|modulepreload>`, plus Vite's `vite:preloadError`, and does ONE `location.reload()`. Third-party failures (the Google Fonts CDN) are filtered out by an origin check so a font blip never reloads the page. If a service worker controls the page it deletes all caches BEFORE reloading, otherwise the reload would be answered from the same stale cache.
  - **Loop guard**: `sessionStorage['jou3an:stale-reload']` holds a timestamp with a 10-minute cooldown, not a boolean. A reload-loop retries within seconds so the cooldown makes looping impossible, while a long-lived tab can still recover from a *later* deploy instead of being stuck for the whole session. If storage throws (private mode / blocked third-party storage) it declines to reload at all — without the guard it cannot prove it won't loop.
  - **The service worker was the real culprit** and was rewritten: `public/sw.js` v2 served navigations CACHE-FIRST, so a returning visitor got the cached index.html and a reload was answered from that same cache — an unfixable white screen. v3 makes navigations **network-first** (cache is the offline fallback only); hashed `/assets/` files stay cache-first, which is safe because their names are content-addressed. `CACHE_NAME` bumped to `jou3an-v3` to evict v2's stale HTML from existing visitors — ⚠️ **bump it on any change to APP_SHELL or the strategy**, since `activate` is what deletes old caches.
  - Verified end-to-end: served a doctored `dist/` whose index.html referenced a non-existent bundle, loaded it in iOS Safari, and watched the access log show `GET /` → `404 /assets/index-OLDHASH.js` → `GET /` (the automatic reload) → and then STOP, with no third request even though the server kept serving the broken HTML.
  - HTML cache headers: `client/index.html` carries no `http-equiv` / Cache-Control / Pragma / Expires meta tags (verified in the BUILT output), and there is no `vercel.json` / `_headers` / `netlify.toml` anywhere in the repo, so Vercel's defaults apply — `no-store`-ish revalidation on HTML and immutable long-lived caching on hashed `/assets/`. That is what we want; do not add a `vercel.json` that caches HTML.
✅ Waitlist capture (client → Supabase DIRECT, **not** through the Express server — the landing page must deploy standalone to Vercel and keep working with the API offline):
  - `client/supabase/waitlist.sql` — **run this once by hand in the Supabase dashboard** (SQL Editor). Creates `public.waitlist_signups` (`id` uuid pk, `email` text unique, `created_at` timestamptz, `source` text default `'landing'`) + a `lower(email)` unique index, enables RLS, `revoke all` then `grant insert` to anon, and one INSERT-only policy. No SELECT/UPDATE/DELETE policy exists, so anon can never read rows.
  - Counter: `public.waitlist_count()` — a `security definer` / `stable` SQL function returning `count(*) + 731`, execute granted to anon. This is the ONLY way the count reaches the client; the rows themselves stay unreadable.
  - `client/src/lib/supabase.ts` — the single Supabase client (`persistSession: false`), `WAITLIST_BASE_COUNT = 731`, `isValidEmail()`, `joinWaitlist(email, source)` and `fetchWaitlistCount()`. ⚠️ The insert deliberately has **no `.select()`** — anon holds INSERT only, so asking for the row back would fail. A `23505` unique violation is mapped to the friendly `'duplicate'` result. Missing env vars leave `supabase` as `null` and every caller degrades instead of throwing.
  - `client/src/lib/waitlistCount.ts` — module-level store + `useWaitlistCount()` hook, so N mounted counters cause ONE request and a successful signup (`refreshWaitlistCount()`, optimistic +1 then re-fetch) updates every counter at once.
  - `client/src/components/WaitlistCount.tsx` — small muted "{n} people already on the list" line. Rendered DIRECTLY under every Join-the-Waitlist button. Falls back to the static 731 whenever the RPC fails.
  - `client/src/components/WaitlistCTA.tsx` — the big red pill CTA + counter. `client/src/components/WaitlistForm.tsx` — email input + submit with inline validation and five states: idle / submitting / joined (green success card, replaces the form) / duplicate (gold "you're already on the list", form stays) / error.
  - New dep (the only one added): `@supabase/supabase-js`.
✅ Interactive app preview (`client/src/components/AppPreview.tsx`, section id `#preview`) — a working slice of the **DECISION ENGINE** inside a phone-shaped frame, with **zero backend calls**. ⚠️ It deliberately does NOT show Food Tinder any more: the demo used to be cuisine-pick → swipe deck → results, which blurred the two features and buried the thing the product actually is. Swiping is a separate tab in the app; the landing demo now mirrors the mobile **Decide** tab exactly — a four-step brief, then exactly 3.
  - Stages: `'location' | 'cuisine' | 'format' | 'vibe' | 'results'`. `STEPS` holds the four wizard stages (results is the payoff, not a step) and drives the 4-dot progress header, which also carries a back chevron on steps 2–4.
  - **location** — Nearby / Anywhere in Dubai / Pick an area; "Pick an area" swaps the rows for a 2-col grid of `DEMO_AREAS` (mirrors the app's inline area search, minus the network call). Produces the label used in the results prompt (`Nearby` / `Anywhere in Dubai` / `Near JLT`).
  - **cuisine** — "No preference" wide row, a 2-col multi-select icon grid, a red-accent "Surprise me" row, and a Continue button disabled until something is picked. Matches the mobile Cuisine step's layout and toggle semantics.
  - **format** / **vibe** — two `ChoiceStage` screens (Delivery/Dine In, Casual/Fancy) built from the shared `OptionRow`.
  - **results** — the brief played back as the same prompt string the mobile flow builds ("Near JLT, Pizza, Delivery, Casual"), then exactly 3 cards matching the mobile `ResultCard`, each with a red reasoning pill.
  - Data + engine live in `client/src/lib/demoData.ts`: `DEMO_CUISINES`, `DEMO_AREAS`, 8 `DEMO_RESTAURANTS` (3 Unsplash photos each), plus `decideThree(filters)` and `reasonFor(restaurant, filters)`. `decideThree` SCORES rather than filters (cuisine +5, area +3, vibe by price, delivery by distance, rating as tiebreak) and always returns 3 — "always exactly 3" is a product rule, so a brief that matches nothing must still produce three. `reasonFor` builds the pill from the brief, so the reasoning visibly reflects what was picked. The old `buildDeck` / `pickThree` swipe helpers and the per-restaurant static `reason` are gone.
  - Removed with the swipe deck: the pointer-drag handlers, the stories-style photo slideshow, and its CSS (`@keyframes progressFill`, `.progress-fill`, `.progress-paused`, `.demo-photo`) — all deleted from `client/src/index.css`.
✅ "What is Jou3an" section (`client/src/components/WhatIsJou3an.tsx`, section id `#what-is-jou3an`) — sits directly BELOW the waitlist/signup block, above the FAQ. Two beats, no emojis: the PROBLEM (10–15 minutes of tab-switching before every meal in a city with thousands of restaurants, and you end up where you went last week) set opposite the ANSWER (exactly 3 places in under 10 seconds — a decision, not a list), as a 2-col `md:grid-cols-2` of copy under a "You already know you're hungry." headline. Then a compact `sm:grid-cols-2` feature grid of 4 `FeatureTile`s — **describing only what the app already does**: Decision engine, Swipe to teach it, Daily Top 3, No menus/no scrolling. Tiles are bg #141414 / 1px #242424 / radius 24 with a 40px red-tinted lucide icon badge, and lift 3px + take a red border on hover (`.feature-tile`). Every block is wrapped in `Reveal`; the grid staggers at 90ms per tile.
✅ CSS iPhone mockup (`client/src/components/PhoneMockup.tsx`) — a device frame built entirely from CSS, no image library and no device PNG: a gradient "titanium" rail (`.phone-frame`, radius 56 + inset highlight + layered shadow incl. a red bloom), a `.phone-screen` locked to `aspect-ratio: 1206/2622` (iPhone 17 Pro), a `.phone-island` Dynamic Island and a `.phone-sheen` diagonal glass reflection. Tilted -3.5° and floating on a 7s `phoneFloat` keyframe. Width is `clamp(230px, 62vw, 300px)`. The screenshot it displays is REAL — captured from the booted iOS simulator with `xcrun simctl io booted screenshot` and committed to `client/public/brand/app-screens/home-daily-top-3.png` (the mobile Home screen with the live Daily Top 3). ⚠️ That folder is app screenshots only; the logo/icon artwork stays in `client/public/brand/`.
✅ Scroll animations (no animation library — `client/src/lib/reveal.ts` + `client/src/components/Reveal.tsx`):
  - `useReveal()` — one `IntersectionObserver` per element (threshold 0.12, `rootMargin '0px 0px -8% 0px'`), fires ONCE then `disconnect()`s. `<Reveal delay={ms}>` wraps a block and sets `transitionDelay`, which is how the feature grid and the timeline steps stagger. Motion itself is `.reveal` / `.reveal.is-visible` in index.css — opacity + `translate3d` only, so it stays on the compositor.
  - `useParallax(speed)` — sets `translate3d(0, scrollY * speed, 0)` from a **passive**, rAF-coalesced scroll listener (one style write per frame). Used on the hero: red orb `0.22`, gold orb `-0.14` (drifts against the scroll), hero copy `0.06`.
  - **prefers-reduced-motion is respected two ways**: `useReveal` initialises `shown` to `true` at mount (so content paints visible immediately, never stranded at opacity 0 — it is a lazy `useState` initialiser, NOT a `setState` in an effect) and `useParallax` bails before attaching anything; a `@media (prefers-reduced-motion: reduce)` block in index.css additionally flattens `.reveal`, `.phone-float`, `.fade-up`, `.pulse-dot`, `.bounce-dot`, `.shimmer`, `.progress-fill`, the button hover transforms and `scroll-behavior`.
✅ FAQ (`client/src/components/FAQ.tsx`, section id `#faq`) — 6-question accordion at the very end of the page (before the footer): What is Jou3an? / When does it launch? / Which cities? / Is it free? / Is this another delivery app? / What do waitlist members get?. One open at a time (first open by default), rotating +/× toggle, height animated with the `grid-template-rows: 0fr → 1fr` trick so nothing needs measuring. No emojis.
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

✅ **DecisionEngine v2** (`server/`) — **WIRED IN behind the `ENGINE_V2` env flag** (see the flag entry below). `services/decisionEngine.ts` (the keyword matcher) is still the path when the flag is off and stays until v2 has run live for a while.
  - **Taste profiles** (`src/services/tasteProfile.ts`) — `applyTasteEvent(userId, cuisine, event)` with SWIPE_RIGHT +1 / SWIPE_LEFT −0.25 / SELECT +3. Every update first multiplies ALL weights by `DECAY = 0.98` (so untouched cuisines drift back toward neutral), then applies the delta, then clamps to [−5, +10]. Weights decayed below 0.01 are pruned to keep the Json small. `applyEventToWeights()` is the pure core and is what the tests exercise; `applyTasteEvents()` is the batch form used by the swipe log (one read + one write instead of 2N queries). Cuisine keys are lowercased/trimmed.
  - **Opening hours** (`src/lib/hours.ts`) — `isOpenNow(restaurant, date)`. Converts the instant to **Asia/Dubai** wall-clock via `Intl` (not a hardcoded +04:00), then compares in absolute minutes-since-Sunday-00:00 so overnight periods (Fri 22:00 → Sat 02:00) and week-wrapping periods (Sat 23:00 → Sun 03:00) both work. ⚠️ **Unknown hours return `true`** — missing Places data is OUR gap, not evidence a place is shut, and treating it as closed would silently shrink the pool and fight the "always exactly 3" rule. Use `hasKnownHours()` when you need to distinguish. Populated by `npm run sync:places`, which now requests `regularOpeningHours` (Places **Advanced** SKU — costs more per call) and stores the periods verbatim. All 10 seeded restaurants have hours; 8 have 7 periods, 2 are 24/7 (single period, no close).
  - **The engine** (`src/services/engine/`) — `decide(input): Decision3` is a **PURE** function: no clock reads, no DB, no `Math.random`. `context.date` and `context.refreshNonce` are injected, which is what makes it testable and replayable from a DecisionLog row.
    - *Stage 1* `filter.ts` — isActive → isOpenNow → format → budget, then the 5 → 10 → city radius ladder. Because "always exactly 3" is a rule rather than a goal, this is a filter **plus a relaxation ladder**: constraints are dropped in the order `budget → format → hours → isActive` until 3 candidates survive, and whatever was dropped is reported in `relaxed[]`.
    - *Stage 2* `score.ts` — `0.4*quality + 0.4*taste + 0.2*context`, each normalised to [0,1] with **0.5 as neutral** so missing data never reads as "bad". Quality maps googleRating 3.0–5.0 across the full range (real ratings cluster there); taste is the cuisine weight (70%) blended with the mean tag weight (30%), normalised from [−5,10]; context averages vibe-fit and price-fit.
    - *Stage 3* `select.ts` — greedy top-3 under a cuisine-diversity constraint (preference, not a rule: it will repeat a cuisine rather than return 2), **ε = 0.15** wildcard on slot 3, and repeat-damping ×0.5 decaying linearly back to 1.0 over 7 days. Restaurants above a **40% historical pick rate** are EXEMPT from damping — a genuine regular should not be suppressed for being a regular. All randomness comes from `seededRandom(hash(userId, dubaiDateString, refreshNonce))`, so the same request twice returns the same 3 and Refresh (a new nonce) reshuffles. Final 3 are sorted **nearest-first** when coords exist.
    - *Stage 4* `reason.ts` — a one-line reason per pick, derived from whichever component contributed most above neutral, with distance appended when known.
    - `log.ts` holds everything that touches Postgres, deliberately OUTSIDE the pure core: `logDecision()` (never throws — telemetry must not cost a user their decision), `getRecentSelections()` and `getPickRates()`. Only `actionTaken === 'SELECT'` counts as "I went here"; DIRECTIONS/CALL/ORDER are intents that often go nowhere. Pick-rate denominators are LIFETIME, not the 7-day window, or one pick in a quiet week would look like a 100% favourite.
  - **Tests** — `npm test` (vitest). 81 tests: hours edge cases (overnight, week-wrap, 24/7, minute precision, unknown-hours bias, Dubai-vs-UTC day boundary), taste maths (decay, clamping, pruning, immutability), engine invariants (determinism, diversity, damping, never-fewer-than-3, the 0.4/0.4/0.2 weighting) and **5 golden scenarios** asserting PROPERTIES not exact restaurants — Marina burger lover, DIFC fancy date night, 02:00 late-night delivery, brand-new anonymous user, and a regular whose usual was picked yesterday.

✅ **Engine v2 wire-in** (`ENGINE_V2` flag):
  - **Flag**: `ENGINE_V2=true` in `server/.env` (LOCAL DEV ONLY — deliberately **NOT** set on Railway yet). Anything other than the exact string `true` falls back to the matcher. The response carries `engine: 'v1' | 'v2'` so a curl (or the app) can tell which path answered.
  - **Structured filters from mobile**: `app/(tabs)/decide.tsx` now pushes `cuisines` (JSON-encoded — router params are strings), `format`, `vibe` and `areaName` alongside the prompt. ⚠️ **The prompt string is now DISPLAY/history only** — nothing ranks off it on the v2 path. `results.tsx` parses them back (malformed JSON degrades to "no preference" rather than breaking the screen) and passes them via `getDecision(prompt, chips, coords, filters)`.
  - ⚠️ **Requested cuisines are a TASTE BOOST, not a Stage-1 filter** (`boostedTasteWeights` in `services/engine/request.ts`). Filtering would fight two things: the catalogue usually holds ONE restaurant per cuisine, so a hard filter would trip the relaxation ladder on nearly every request, and it collides with the cuisine-diversity constraint that exists so the 3 picks are not 3 versions of the same meal. The boost pins the requested cuisine to `WEIGHT_MAX` on a COPY — the stored profile is only ever moved by real swipes and selections.
  - ⚠️ Because of that boost, `EngineContext.requestedCuisines` exists **purely for reason wording**: without it the engine cannot tell "you asked for burgers" from "you keep choosing burgers", and a first-ever anonymous query rendered the false line *"You keep going back to American Burgers"*. It now says *"The American Burgers you asked for"*.
  - **Budget**: the Decide flow has no budget step, so the signed-in user's saved `budgetRange` stands in; anonymous callers get `ANY`.
  - **Refresh nonce**: `results.tsx` holds `refreshNonce` state — **0 on first load** (so re-opening the same brief the same day is deterministic), incremented by each Refresh tap. "Retry" on the error state deliberately reuses the CURRENT nonce — a failed request should return the brief that was asked for, not silently re-roll it.
  - ⚠️ **Refresh scales exploration, it does not just re-seed** (`explorationFor()` in `engine/select.ts`). With the fixed 0.02 noise the top 3 by score ARE the top 3 every time, so re-seeding alone only re-ORDERED the same three restaurants — which reads as broken. Each tap now ramps the score jitter (0.02 → 0.18) and the wildcard ε (0.15 → 0.45), reaching the ceiling after `MAX_EXPLORATION_REFRESHES = 4`. Nonce 0 keeps the tuned defaults so the best answer still leads.
  - ⚠️ `seedFor()` normalises an omitted nonce to **0, not `''`** — otherwise a client sending the default disagrees with one omitting the field.
  - **Reason lines** ride on each result as `reason` and render as a red pill in `mobile/components/ResultCard.tsx` (conditional — absent on v1 and on every other endpoint).
  - **Verified locally** against the live Supabase data with the flag on: exactly 3 every time, all picks open per `isOpenNow`, 3 distinct cuisines, nearest-first when coords exist, nonce 0 reproducible, nonces 1-5 genuinely re-rolling the SET, DecisionLog rows written with seed/nonce/relaxed/breakdown and joined to the session, old prompt-only clients still served, and `ENGINE_V2=false` falling back to v1 with no reason lines.

## What's Not Built Yet
❌ Phase 4: AI decision engine (needs ANTHROPIC_API_KEY in server/.env; replace decisionEngine.ts placeholder)
❌ Google OAuth credentials (needs Google Cloud Console setup — code path exists, degrades gracefully)
❌ Stripe payment integration (Pro subscription)
🅿️ Explore tab — PARKED: placeholder only, to be built after core features are complete. (NOTE: no `explore.tsx` file exists in `app/(tabs)/` yet — the current tabs are Home, Decide, Swipe/Tinder, History, Profile. Create the placeholder tab when work resumes.)
👉 NEXT PHASE (in order): TestFlight build (mobile) → Vercel deployment (web landing page) → Phase 4 AI activation (Railway backend + geo-filtering are DONE)
✅ Railway deployment (backend) — LIVE. Config in `server/railway.json`; see "Railway Deployment Setup" below
❌ TestFlight / App Store submission — config READY and the prod API URL is baked in (`mobile/eas.json`); blocked only on a real app icon + the interactive EAS steps
❌ Vercel deployment (web landing page) — code is READY; needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set in Vercel and `client/supabase/waitlist.sql` run once in the Supabase dashboard
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
- ENGINE_V2 ("true" turns on DecisionEngine v2 for /api/decisions/query). ⚠️ Set in local `server/.env` ONLY — intentionally absent on Railway so production still runs the keyword matcher.

mobile/.env required keys:
- EXPO_PUBLIC_API_URL (http://localhost:3001 for dev, Railway URL for prod; use LAN IP on a physical device). For BUILDS this comes from `mobile/eas.json` `build.<profile>.env`, not from a .env file — see "TestFlight Build Prep".
Mobile native deps of note: `expo-linear-gradient`, `expo-location` (Decide "Nearby" GPS permission — configured via the `expo-location` plugin in app.json with an iOS `locationWhenInUsePermission` string).

client/.env required keys (see `client/.env.example`):
- VITE_API_URL (http://localhost:3001 for dev) — no longer used by the landing page itself
- VITE_ADMIN_PASSWORD (client-side gate for the web /admin panel)
- VITE_SUPABASE_URL (Supabase project URL — waitlist capture + counter)
- VITE_SUPABASE_ANON_KEY (Supabase anon key. Public BY DESIGN: RLS grants anon INSERT on `waitlist_signups` and EXECUTE on `waitlist_count()`, nothing else. Both must also be set in the Vercel project's env vars — `client/.env` is gitignored.)

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
📐 `decision_engine_v2` (2026-09-20) was hand-written as purely ADDITIVE SQL (one nullable column + two tables) and applied with `prisma migrate deploy`. That is the pattern to copy: it sidesteps `migrate dev` and its shadow database entirely. 
⚠️ Prisma migrations: NEVER pass DIRECT_URL (or DATABASE_URL) as `--shadow-database-url` to `prisma migrate diff --from-migrations` — Prisma RESETS the shadow database, which drops every table in it. Use `prisma migrate dev` interactively, or a genuinely separate throwaway database. The migration history was baselined on 2026-08-26 (`migrate resolve --applied` for the first three migrations), so `prisma migrate deploy` now works normally.
Capture an app screenshot (for the landing page mockup): boot a sim, run the app, then `xcrun simctl io booted screenshot out.png`.
```bash
xcrun simctl boot "iPhone 17 Pro" && open -a Simulator
cd mobile && EXPO_PUBLIC_API_URL=https://server-production-0599.up.railway.app npx expo start --ios
xcrun simctl status_bar booted override --time "9:41" --wifiBars 3 --cellularBars 4 --batteryState charged --batteryLevel 100
xcrun simctl io booted screenshot shot.png      # 1206x2622 on iPhone 17 Pro
```
⚠️ Launch the app with `xcrun simctl launch booted com.jou3an.app`, NOT `simctl openurl` — a URL-scheme open raises an "Open in Jou3an?" confirm dialog that cannot be dismissed without macOS Accessibility permission, and it leaves a "◀ Safari" breadcrumb in the status bar that ruins the shot. Resize into the landing page with `sharp` (900px wide keeps 3x for the 300px CSS frame, ~158 kB).
⚠️ If the simulator app dies with **`Property 'MessageQueue' doesn't exist`**, the installed native binary predates the current React Native — rebuild it with `npx expo run:ios` (this runs `prebuild` and generates `mobile/ios/`, which is gitignored; it also rewrites the `ios`/`android` scripts in `mobile/package.json`, so `git checkout mobile/package.json` afterwards).
⚠️ **CocoaPods Maven downloads stall on this machine.** `pod install` shells out to `curl` for the React Native / Hermes prebuilt artifacts and those transfers freeze (0 B–1 MB, then no progress), while the identical URLs fetch in seconds from a normal shell. Workaround: download them by hand and drop them where CocoaPods expects, then re-run the build — it skips anything already present.
```bash
V=0.86.2; H=250829098.0.16; B=https://repo1.maven.org/maven2/com/facebook
for a in dependencies core; do for c in debug release; do
  curl -L "$B/react/react-native-artifacts/$V/react-native-artifacts-$V-reactnative-$a-$c.tar.gz" \
    -o "mobile/ios/Pods/ReactNative${a:0:1}*-artifacts/reactnative-$a-$V-$c.tar.gz"; done; done
for c in debug release; do
  curl -L "$B/hermes/hermes-ios/$H/hermes-ios-$H-hermes-ios-$c.tar.gz" \
    -o "mobile/ios/Pods/hermes-engine-artifacts/hermes-ios-$H-$c.tar.gz"; done
```
(Exact target dirs: `Pods/ReactNativeDependencies-artifacts/`, `Pods/ReactNativeCore-artifacts/`, `Pods/hermes-engine-artifacts/`. Delete any leftover `*.download` files first.)
Server tests: `cd server && npm test` (vitest, `npm run test:watch` to watch). 81 tests covering the hours helper, taste-profile maths and the whole engine — all pure, NO database required.
Type-check server: `cd server && npx tsc --noEmit`
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
The client/ **waitlist launch page is BUILT and BRANDED** (official logo in the nav / footer / splash, full favicon + webmanifest set, Open Graph + Twitter cards pointing at `https://www.jou3an.me`, and `--red` now **#FE0000**). It has: download buttons removed, one Join-the-Waitlist CTA + live counter, an interactive decision-engine demo, 3-step timeline, a CSS iPhone mockup beside the signup form showing a REAL simulator capture (`client/public/brand/app-screens/home-daily-top-3.png`, 900x1957, 158 kB — the Home screen with live Daily Top 3 off the Railway backend), a "What is Jou3an" problem/answer section + 4-tile feature grid, reveal-on-scroll + hero parallax, and the FAQ accordion. `npx tsc -b`, `npx oxlint` and `npm run build` are all clean. Manual steps remaining before it is live:
  1. Run `client/supabase/waitlist.sql` once in the Supabase dashboard (SQL Editor) — creates `waitlist_signups`, the insert-only RLS policy, and the `waitlist_count()` RPC.
  2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `client/.env` (locally) AND in the Vercel project, then deploy `client/`. Until they are set the form reports an error and the counter shows the static 731 — nothing crashes.
  3. Point **`www.jou3an.me`** at the Vercel deployment. The Open Graph tags hardcode that origin, so WhatsApp/X previews only resolve `og:image` once the domain is live. Re-scrape with X's Card Validator / Facebook's Sharing Debugger after the first deploy — both cache aggressively.
⚠️ Bundle weight: the landing JS is **516 kB raw / 151 kB gzip**, and ~215 kB of that is `@supabase/supabase-js` (it drags in auth-js + realtime-js + storage-js for what is one INSERT and one RPC). Not addressed — the cheap fix is a dynamic `import()` in `client/src/lib/supabase.ts` so it lands in a lazy chunk instead of the initial bundle.
♿ CONTRAST on the #FE0000 red (measured, WCAG 2.1): red text on the dark backgrounds passes AA — 4.97:1 on #080808, 4.76:1 on #0F0F0F, 4.57:1 on #141414 (and 4.32:1 on #1A1A1A, which only ever carries the red ICON badge, where the 3:1 non-text bar applies). **White on red is 4.03:1** — that is the ceiling for pure #FE0000 and it clears AA for large text / UI components but NOT the 4.5:1 normal-text bar. The big `WaitlistCTA` was therefore bumped to 19px/700 so it qualifies as large text; the smaller white-on-red labels (nav CTA 14px, form submit 16px) still sit at 4.03:1. Closing that gap means darkening the red, which is a brand decision — don't do it silently.
👉 **NEXT UP — decide whether to turn `ENGINE_V2=true` on Railway.** The wiring is done and verified locally; production is still on the keyword matcher by design. Before flipping it: re-run `npm test` in `server/`, sanity-check a few real briefs against prod data, and watch `DecisionLog` for `relaxed` entries (a constraint being dropped often means the catalogue is too thin for that brief). Only 10 restaurants are seeded, which is the real limiter on how good v2 can look — the diversity constraint and the wildcard both want a deeper catalogue.
After that: Phase 4 AI activation (swap the `decisionEngine.ts` placeholder once ANTHROPIC_API_KEY is set).
Note: the seeded DailyPick is dated 2026-08-25; `/api/daily/today` falls back to the most recent live pick, so the app always has data, but re-seed for a fresh date.
Parked: the Explore tab (placeholder not yet created). Optional non-blocking polish: mobile Profile/Pro live data.

---
After every prompt that adds a feature or completes a phase, update this CLAUDE.md file:
- Move the item from "What's Not Built Yet" to "What's Built"
- Add any new components, routes, or env vars that were created
- Update "Next Session Starting Point" to reflect current progress
Keep this file accurate — it is the single source of truth for the codebase state.
