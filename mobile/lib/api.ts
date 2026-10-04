import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'

// The ONE place the API origin is resolved. EXPO_PUBLIC_* vars are inlined at
// BUILD time, so this must stay a static `process.env.X` member expression for
// the bundler to substitute it — don't destructure or index into process.env.
// The localhost fallback is for `expo start` only; production builds get the
// real value from eas.json -> build.<profile>.env.
// Trailing slashes are stripped so the relative /api/photos/... proxy paths
// returned by the server concatenate cleanly in photoUrls().
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'
).replace(/\/+$/, '')

const baseURL = API_BASE_URL

export const TOKEN_KEY = 'jou3an_token'

export const api = axios.create({ baseURL })

// Attach the JWT (from SecureStore) to every request.
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear the stored token and bounce to login — silently.
// Skips the auth endpoints themselves (a 401 there is just bad credentials,
// handled locally by the login/signup screens and the mount-time authMe check).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const url: string = error?.config?.url ?? ''
    if (status === 401 && !url.includes('/api/auth/')) {
      try {
        await clearToken()
      } catch {
        /* ignore */
      }
      try {
        router.replace('/(auth)/login')
      } catch {
        /* navigation not ready — ignore */
      }
    }
    return Promise.reject(error)
  },
)

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

// Imported rather than redeclared: lib/budget.ts owns the labels and the
// band<->null mapping, and a second spelling of the same union would drift.
import type { BudgetChoice } from './budget'

export type LocationArea =
  | 'JLT'
  | 'DIFC'
  | 'DOWNTOWN'
  | 'BUSINESS_BAY'
  | 'MARINA'
  | 'OTHER'

/**
 * A saved budget band. NULL on the user means "No budget" — a real answer from
 * the quiz, not a missing one. See lib/budget.ts for the shared vocabulary and
 * the labels; `BudgetChoice` there is this type plus the explicit 'ANY'.
 *
 * ⚠️ It is a LEAN, not a ceiling: the server scores price fit with it and
 * filters nothing.
 */
export type BudgetRange = 'LOW' | 'MID' | 'HIGH'
export type AccountTier = 'FREE' | 'PRO'

/** How far from a user's favourites the engine may roam — the quiz's step 4. */
export type Adventurousness = 'SAFE' | 'BALANCED' | 'ADVENTUROUS'

/**
 * The dietary needs the taste quiz collects.
 *
 * ⚠️ Only the first three actually filter anything. `no-pork` is stored and
 * displayed but enforced nowhere — nothing in the catalogue marks pork and
 * Dubai is overwhelmingly halal, so the server declines to guess. Never write
 * UI copy that promises it is applied.
 */
export type DietaryNeed = 'vegetarian' | 'vegan' | 'no-pork' | 'gluten-free'

export interface User {
  id: string
  email: string
  name: string | null
  phoneNumber: string | null
  googleId: string | null
  locationArea: LocationArea
  /**
   * Cuisines the user says they love. ⚠️ The quiz no longer ASKS this (it is
   * skip / budget / adventurousness) — it is settable from Profile and still
   * read by the engine as +2 per cuisine.
   */
  cuisinePreferences: string[]
  /** Cuisines the quiz's "rather skip" step collected — a -2 lean, not a ban. */
  dislikedCuisines: string[]
  /** Null = "No budget". Never assume a band is present. */
  budgetRange: BudgetRange | null
  dietary: string[]
  adventurousness: Adventurousness
  /** Null = the quiz was never completed (it is skippable). */
  tasteQuizCompletedAt: string | null
  accountTier: AccountTier
  stripeCustomerId: string | null
  createdAt: string
  updatedAt: string
}

export interface Restaurant {
  /**
   * One-line "why this pick", from DecisionEngine v2. Absent on the v1 path and
   * on every other endpoint, so always render it conditionally.
   */
  reason?: string
  /**
   * Real Dubai neighbourhood from Google ("Al Satwa", "Mirdif", "Motor City").
   * Null until the row has been Places-synced — render via displayArea(), never
   * directly, so the deprecated `area` enum still covers the gap.
   */
  areaName?: string | null
  id: string
  name: string
  cuisineType: string
  area: LocationArea
  priceMin: number
  priceMax: number
  phone: string | null
  googleMapsUrl: string | null
  talabatUrl: string | null
  noonUrl: string | null
  deliverooUrl: string | null
  tags: string[]
  /** Seeded 0–10 score — ranking only, never displayed. Use googleRating. */
  ratingScore: number
  averageCalories: number | null
  /**
   * Two-sentence "vibe" line. Null on rows nothing has written one for, so
   * always render it conditionally — RestaurantDetailSheet and SelectionReward
   * are the ONLY two surfaces that show it; cards stay compact.
   */
  description?: string | null
  /** Relative /api/photos/... proxy paths from Google Places. Use photoUrls(). */
  photoUrls?: string[]
  /** Km from the user, to 1dp. Present only on located queries. */
  distanceKm?: number
  lat?: number | null
  lng?: number | null
  googleRating?: number | null
}

export interface DailyToday {
  id: string
  date: string
  themeLabel: string
  isLive: boolean
  results: Restaurant[]
}

export interface DecisionResponse {
  results: Restaurant[]
  sessionId: string
  /** Radius that produced these picks; null when the city-wide fallback ran. */
  radiusKm?: number | null
  /** NEARBY = 5km, WIDER = 10km, CITY = no radius (all of Dubai). */
  radiusTier?: 'NEARBY' | 'WIDER' | 'CITY'
  /** Which backend engine answered. Present while v2 sits behind ENGINE_V2. */
  engine?: 'v1' | 'v2'
  /**
   * True when the brief ran out of restaurants the user had not already been
   * shown, so `excludeIds` was dropped and these are the top picks again. The
   * UI says so quietly, once — pretending they are new would be a lie the user
   * can see through. Absent on the v1 path, which tracks nothing.
   */
  cycled?: boolean
}

/**
 * Structured filters from the Decide flow — what DecisionEngine v2 actually
 * reads. The prompt string is still sent alongside, but only for display and
 * history; nothing ranks off it any more.
 */
export interface DecisionFilters {
  cuisines?: string[]
  format?: 'Delivery' | 'Dine In'
  vibe?: 'Casual' | 'Fancy'
  /**
   * Budget for THIS query, from the Decide flow's pill. 'ANY' is explicit "no
   * budget". Outranks the user's saved band server-side, which is what lets a
   * signed-out user change it at all.
   */
  budget?: BudgetChoice
  /** Display label for a picked area; the coords are what actually filter. */
  areaName?: string
  /**
   * 0 on first load (so a same-day repeat is deterministic), incremented by
   * each Refresh tap to force a genuine re-roll.
   */
  refreshNonce?: number
  /**
   * Every restaurant already shown for THIS brief. The server removes them from
   * the pool before selection, so Refresh means "cards I haven't seen" rather
   * than "roll again, maybe the same". Reset when the brief changes; when the
   * brief is exhausted the server answers `cycled: true` instead of serving
   * fewer than 3.
   */
  excludeIds?: string[]
}

export interface DecisionSession {
  id: string
  promptText: string
  moodChipsUsed: string[]
  resultIds: string[]
  selectedResultId: string | null
  selectedResultName?: string | null
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: User
}

/* ------------------------------------------------------------------ */
/* Auth endpoints                                                      */
/* ------------------------------------------------------------------ */

export async function authSignup(body: {
  name: string
  email: string
  phoneNumber?: string
  password: string
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/signup', body)
  return data
}

/** Why a signup was refused — what the screen branches on. */
export type SignupFailure =
  /** This email already has an account; offer Sign In. */
  | { kind: 'duplicate'; message: string }
  /** The server rejected a field; `message` is its own wording. */
  | { kind: 'validation'; message: string }
  /** The request never arrived — no response at all. */
  | { kind: 'network'; message: string }
  | { kind: 'unknown'; message: string }

/**
 * Turns a thrown signup error into something the screen can actually say.
 *
 * ⚠️ Branches on the server's `code`, never on its prose — the message is
 * display copy and may be reworded at any time, while `SIGNUP_ERRORS` in
 * server/src/routes/auth.ts is the contract. The status is the fallback for an
 * older server that predates the codes.
 *
 * ⚠️ "No response" is a genuinely different failure from "rejected", and the
 * old screen collapsed both into "Unable to create your account. Please try
 * again." — which told someone with an existing account to keep retrying
 * something that could never work.
 */
export function signupFailureOf(err: unknown): SignupFailure {
  if (!axios.isAxiosError(err)) {
    return { kind: 'unknown', message: 'Something went wrong. Please try again.' }
  }

  if (!err.response) {
    return {
      kind: 'network',
      message: "Couldn't reach Jou3an. Check your connection and try again.",
    }
  }

  const { status, data } = err.response
  const body = (data ?? {}) as { code?: string; error?: string }

  if (body.code === 'EMAIL_TAKEN' || status === 409) {
    return { kind: 'duplicate', message: 'This email is already registered.' }
  }

  if (body.code === 'INVALID_INPUT' || status === 400) {
    return {
      kind: 'validation',
      // The server names the offending field; that beats anything generic.
      message: body.error ?? 'Please check your details and try again.',
    }
  }

  return {
    kind: 'unknown',
    message: body.error ?? 'Unable to create your account. Please try again.',
  }
}

export async function authLogin(body: {
  email: string
  password: string
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/api/auth/login', body)
  return data
}

export async function authMe(): Promise<User> {
  const { data } = await api.get<User>('/api/auth/me')
  return data
}

export async function authLogout(): Promise<void> {
  await api.post('/api/auth/logout')
}

/* ------------------------------------------------------------------ */
/* Data endpoints                                                      */
/* ------------------------------------------------------------------ */

export async function getDailyToday(): Promise<DailyToday> {
  const { data } = await api.get<DailyToday>('/api/daily/today')
  return data
}

/** Today's Daily Top 3 — the full pick object; `.results` holds the 3 restaurants. */
export async function getDailyPicks(): Promise<DailyToday> {
  return getDailyToday()
}

export async function postDecisionQuery(body: {
  prompt: string
  moodChips: string[]
  userId?: string
  lat?: number
  lng?: number
  cuisines?: string[]
  format?: 'Delivery' | 'Dine In'
  vibe?: 'Casual' | 'Fancy'
  areaName?: string
  refreshNonce?: number
  excludeIds?: string[]
}): Promise<DecisionResponse> {
  const { data } = await api.post<DecisionResponse>('/api/decisions/query', body)
  return data
}

/**
 * Decide flow entry point. Returns the 3 results plus the sessionId
 * (needed by saveDecisionSelection). The logged-in user is associated
 * automatically via the JWT request interceptor.
 */
export async function getDecision(
  prompt: string,
  moodChips: string[],
  coords?: { lat: number; lng: number } | null,
  filters?: DecisionFilters,
): Promise<DecisionResponse> {
  return postDecisionQuery({
    prompt,
    moodChips,
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    ...(filters?.cuisines?.length ? { cuisines: filters.cuisines } : {}),
    ...(filters?.format ? { format: filters.format } : {}),
    ...(filters?.vibe ? { vibe: filters.vibe } : {}),
    ...(filters?.budget ? { budget: filters.budget } : {}),
    ...(filters?.areaName ? { areaName: filters.areaName } : {}),
    ...(filters?.excludeIds?.length ? { excludeIds: filters.excludeIds } : {}),
    refreshNonce: filters?.refreshNonce ?? 0,
  })
}

/**
 * Record which of the 3 results the user acted on and how.
 * Fire-and-forget from the UI — callers should not await or block on it.
 */
export async function saveDecisionSelection(
  sessionId: string,
  selectedId: string,
  actionTaken: string,
): Promise<void> {
  await api.patch(`/api/decisions/${sessionId}/select`, {
    selectedResultId: selectedId,
    actionTaken,
  })
}

export async function getRestaurant(id: string): Promise<Restaurant> {
  const { data } = await api.get<Restaurant>(`/api/restaurants/${id}`)
  return data
}

/** Paging + exclusion options for the Food Tinder deck. All optional. */
export interface NearbyOptions {
  /** KILOMETRES (the server reads km, not metres). Ignored without coords. */
  radiusKm?: number
  /** Page size. Omit for "everything", which is what older builds ask for. */
  limit?: number
  /** Rows to skip — how the deck pages through the pool. */
  offset?: number
  /**
   * Ids to leave out, e.g. what this session already swiped. Capped server-side
   * (it travels in the query string), so treat it as a courtesy, not a
   * guarantee — `offset` is what actually paginates.
   */
  exclude?: string[]
  /**
   * Deals the pool in a deterministic shuffled order instead of id-ascending /
   * nearest-first.
   *
   * ⚠️ Must be the SAME value for every page of one session, or `offset` pages
   * through a pack that is re-dealt between requests — the same restaurant
   * twice, others never. One seed per app launch is the contract.
   */
  seed?: number
}

/**
 * Nearby (Food Tinder) — passes lat/lng when a location is available.
 *
 * Returns a bare array; a page SHORTER than `limit` means the pool is
 * exhausted, which is how the deck knows to start looping instead of ending.
 */
export async function getNearbyRestaurants(
  coords?: { lat: number; lng: number } | null,
  options: NearbyOptions = {},
): Promise<Restaurant[]> {
  const { radiusKm = 5, limit, offset, exclude, seed } = options
  const { data } = await api.get<Restaurant[]>('/api/restaurants/nearby', {
    params: {
      ...(coords ? { lat: coords.lat, lng: coords.lng, radius: radiusKm } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(offset ? { offset } : {}),
      ...(exclude?.length ? { exclude: exclude.join(',') } : {}),
      ...(seed !== undefined ? { seed } : {}),
    },
  })
  return data
}

/** One hit from the "Pick an area" search. */
export interface AreaSuggestion {
  name: string
  area: string
  lat: number
  lng: number
}

/**
 * Dubai-restricted place search for the Decide flow's area picker.
 * The Places key lives on the server — the app never calls Google directly.
 */
export async function searchAreas(q: string): Promise<AreaSuggestion[]> {
  const { data } = await api.get<{ results: AreaSuggestion[] }>(
    '/api/places/search-area',
    { params: { q } },
  )
  return data.results ?? []
}

/** One card judged, in the order it was judged. */
export interface Swipe {
  restaurantId: string
  direction: 'LEFT' | 'RIGHT'
}

/**
 * Send the swipe log, get back 3 recommendations + a sessionId.
 *
 * ⚠️ `swipes` is what makes a LEFT swipe mean anything. The likes alone say what
 * someone wants; the passes say what they keep refusing, which the profile has
 * no other way to learn (-0.25 per pass, server-side). `likedIds` is still sent
 * because it is what picks the three results, and because the endpoint has to
 * keep answering older builds that send only that.
 *
 * The server de-duplicates repeats — the deck loops, so a long session genuinely
 * re-shows cards — keeping the most recent judgement of each.
 */
export async function tinderSuggest(
  likedIds: string[],
  swipes: Swipe[] = [],
): Promise<DecisionResponse> {
  const { data } = await api.post<DecisionResponse>('/api/decisions/tinder-suggest', {
    likedIds,
    ...(swipes.length ? { swipes } : {}),
  })
  return data
}

/* ------------------------------------------------------------------ */
/* Taste quiz                                                          */
/* ------------------------------------------------------------------ */

/**
 * What the onboarding quiz submits. Every field is optional because every step
 * is skippable — answering two of four still applies those two.
 */
export interface TasteQuizAnswers {
  /** Not asked by the quiz any more; Profile can still set it. */
  lovedCuisines?: string[]
  /** The quiz's step 1 — cuisines to skip. A soft -2 each, never a filter. */
  dislikedCuisines?: string[]
  /** Not asked by the quiz any more; edited from Profile → Preferences. */
  dietary?: DietaryNeed[]
  /** ⚠️ NULL is a real answer ("No budget"); undefined leaves it unchanged. */
  budgetRange?: BudgetRange | null
  adventurousness?: Adventurousness
}

export interface TasteQuizResponse {
  user: User
  /** The cuisine weights the quiz actually seeded, for debugging. */
  quizWeights: Record<string, number>
  /** Which declared needs filter anything — see DietaryNeed. */
  dietary: { enforced: DietaryNeed[]; stored: DietaryNeed[] }
}

/**
 * Submit the quiz. The server stores the answers AND re-derives the engine
 * inputs from them, so this one call is the whole effect.
 */
export async function submitTasteQuiz(
  answers: TasteQuizAnswers,
): Promise<TasteQuizResponse> {
  const { data } = await api.post<TasteQuizResponse>('/api/users/me/taste-quiz', answers)
  return data
}

/**
 * One or more saved preferences, changed in place.
 *
 * Routed server-side through the SAME translation the quiz uses, so editing a
 * preference from Profile (or the Decide flow's budget pill) re-derives the
 * engine's inputs exactly as finishing the quiz would. It deliberately does NOT
 * stamp `tasteQuizCompletedAt` — changing one setting is not taking the quiz.
 *
 * Returns the updated user; hand it to `applyUser()` so the cached copy cannot
 * go stale behind the UI.
 */
export interface PreferencesPatch {
  cuisinePreferences?: string[]
  dislikedCuisines?: string[]
  dietary?: DietaryNeed[]
  /** ⚠️ NULL clears the band ("No budget"); undefined leaves it alone. */
  budgetRange?: BudgetRange | null
  adventurousness?: Adventurousness
}

export async function updatePreferences(patch: PreferencesPatch): Promise<User> {
  const { data } = await api.patch<User>('/api/users/me/preferences', patch)
  return data
}

export async function getUserHistory(): Promise<DecisionSession[]> {
  const { data } = await api.get<DecisionSession[]>('/api/users/me/history')
  return data
}

export interface HistoryItem {
  id: string
  restaurantId: string
  restaurantName: string
  cuisine: string
  /** @deprecated Coarse 5-value enum — use displayArea(). */
  area: LocationArea
  areaName?: string | null
  priceRange: string
  actionTaken: 'DIRECTIONS' | 'CALL' | 'ORDER' | 'SELECT' | null
  createdAt: string
  tags: string[]
  /** Seeded 0–10 score — ranking only, never displayed. Use googleRating. */
  ratingScore: number
  /** Google's 0–5 rating; null until the restaurant has been Places-synced. */
  googleRating?: number | null
  calories: number | null
  /** Two-sentence "vibe" line; null when nothing has written one. */
  description?: string | null
  /** Relative /api/photos/... proxy paths — pass through photoUrls(). */
  photoUrls?: string[]
}

/** The signed-in user's decision history (picks with a selection), newest first. */
export async function getDecisionHistory(): Promise<HistoryItem[]> {
  const { data } = await api.get<HistoryItem[]>('/api/decisions/history')
  return data
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

const AREA_LABELS: Record<LocationArea, string> = {
  JLT: 'JLT',
  DIFC: 'DIFC',
  DOWNTOWN: 'Downtown',
  BUSINESS_BAY: 'Business Bay',
  MARINA: 'Marina',
  OTHER: 'Dubai',
}

/**
 * @deprecated The `LocationArea` enum only knows five districts, so most of
 * Dubai collapses to OTHER. Use `displayArea()`, which prefers the real
 * neighbourhood name and only falls back to this.
 */
export const prettyArea = (area: LocationArea) => AREA_LABELS[area] ?? 'Dubai'

/**
 * What to show for a restaurant's area.
 *
 * Prefers `areaName` (the real neighbourhood Google gave us) and falls back to
 * the deprecated enum's label, so a row that has never been synced still reads
 * sensibly instead of going blank.
 *
 * ⚠️ DISPLAY AND SEARCH ONLY. Nothing filters on this string — the radius
 * ladder and the decision engine run entirely off lat/lng.
 */
export function displayArea(r: {
  areaName?: string | null
  area?: LocationArea | null
}): string {
  const name = r.areaName?.trim()
  if (name) return name
  return AREA_LABELS[r.area ?? 'OTHER'] ?? 'Dubai'
}

export const prettyTag = (tag: string) =>
  tag
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/** Tags that must never render anywhere in the app (e.g. lingering in old data). */
export const HIDDEN_TAGS = ['halal']

/** "1.2 km" — or null when we don't know how far away it is. */
export function prettyDistance(km?: number | null): string | null {
  return typeof km === 'number' ? `${km.toFixed(1)} km` : null
}

/** Strip hidden tags before displaying a restaurant's tag list. */
export const visibleTags = (tags: string[] = []) =>
  tags.filter((t) => !HIDDEN_TAGS.includes(t.toLowerCase()))

/**
 * Absolute URLs for a restaurant's Google Places photos.
 *
 * The server returns relative proxy paths ("/api/photos/places/…") so the
 * Places API key never reaches the app; this prefixes them with the API base.
 * Returns [] when the restaurant hasn't been synced yet — callers fall back to
 * `getPlaceholderImage`.
 */
export function photoUrls(
  restaurant?: { photoUrls?: string[] | null } | null,
): string[] {
  return (restaurant?.photoUrls ?? []).map((path) =>
    path.startsWith('http') ? path : `${baseURL}${path}`,
  )
}

/**
 * The single image to show for a restaurant, with a deterministic placeholder
 * fallback. `index` picks the placeholder when there are no real photos.
 */
export function primaryPhotoUrl(
  restaurant: { photoUrls?: string[] | null } | null | undefined,
  index: number,
  placeholder: (i: number) => string,
): string {
  return photoUrls(restaurant)[0] ?? placeholder(index)
}

/** Derive display scores from a restaurant's rating + rank (server has no scores). */
export function deriveScores(rank: number, rating: number) {
  const base = Math.round(rating * 20) // 0–100-ish
  const table: Record<number, [number, number, number, number]> = {
    1: [96, 88, 82, 90],
    2: [89, 92, 74, 84],
    3: [84, 79, 91, 71],
  }
  const [match, value, speed, popularity] = table[rank] ?? [
    base,
    base - 5,
    base - 10,
    base - 8,
  ]
  return {
    matchScore: match,
    valueScore: value,
    speedScore: speed,
    popularityScore: popularity,
  }
}

/** First 1–2 (visible) tags → a human reasoning string. */
export function deriveReasoning(tags: string[]) {
  const shown = visibleTags(tags)
  if (!shown.length) return 'Top match'
  return shown.slice(0, 2).map(prettyTag).join(' · ')
}

/** First available delivery URL (Order button). */
export function deliveryUrl(r: Restaurant): string | null {
  return r.talabatUrl || r.noonUrl || r.deliverooUrl || null
}

/* ------------------------------------------------------------------ */
/* SecureStore token helpers                                           */
/* ------------------------------------------------------------------ */

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}
