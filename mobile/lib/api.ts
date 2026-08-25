import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'

const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'

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

export type LocationArea =
  | 'JLT'
  | 'DIFC'
  | 'DOWNTOWN'
  | 'BUSINESS_BAY'
  | 'MARINA'
  | 'OTHER'

export type BudgetRange = 'LOW' | 'MID' | 'HIGH'
export type AccountTier = 'FREE' | 'PRO'

export interface User {
  id: string
  email: string
  name: string | null
  phoneNumber: string | null
  googleId: string | null
  locationArea: LocationArea
  cuisinePreferences: string[]
  budgetRange: BudgetRange
  dietary: string[]
  accountTier: AccountTier
  stripeCustomerId: string | null
  createdAt: string
  updatedAt: string
}

export interface Restaurant {
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
): Promise<DecisionResponse> {
  return postDecisionQuery({
    prompt,
    moodChips,
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
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

/** Nearby (Food Tinder) — passes lat/lng when a location is available. */
export async function getNearbyRestaurants(
  coords?: { lat: number; lng: number },
  /** KILOMETRES (the server reads km, not metres). */
  radiusKm = 5,
): Promise<Restaurant[]> {
  const params = coords ? { lat: coords.lat, lng: coords.lng, radius: radiusKm } : undefined
  const { data } = await api.get<Restaurant[]>('/api/restaurants/nearby', { params })
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

/** Send the right-swiped restaurant IDs, get back 3 recommendations + a sessionId. */
export async function tinderSuggest(likedIds: string[]): Promise<DecisionResponse> {
  const { data } = await api.post<DecisionResponse>('/api/decisions/tinder-suggest', {
    likedIds,
  })
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
  area: LocationArea
  priceRange: string
  actionTaken: 'DIRECTIONS' | 'CALL' | 'ORDER' | 'SELECT' | null
  createdAt: string
  tags: string[]
  /** Seeded 0–10 score — ranking only, never displayed. Use googleRating. */
  ratingScore: number
  /** Google's 0–5 rating; null until the restaurant has been Places-synced. */
  googleRating?: number | null
  calories: number | null
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

export const prettyArea = (area: LocationArea) => AREA_LABELS[area] ?? 'Dubai'

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
