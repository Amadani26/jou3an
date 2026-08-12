import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const TOKEN_KEY = 'jou3an_token'

export const api = axios.create({
  baseURL,
  withCredentials: true,
})

// Attach the auth token (if present) to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/* ------------------------------------------------------------------ */
/* Types (mirror the Prisma models)                                    */
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
export type DecisionAction = 'DIRECTIONS' | 'CALL' | 'ORDER'

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
  isActive: boolean
  isFeatured: boolean
  tags: string[]
  ratingScore: number
  averageCalories: number | null
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  email: string
  name: string | null
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

export interface DailyToday {
  id: string
  date: string
  themeLabel: string
  isLive: boolean
  results: Restaurant[]
}

export interface DecisionQueryInput {
  prompt: string
  moodChips?: string[]
  userId?: string
}

export interface DecisionResponse {
  results: Restaurant[]
  sessionId: string
}

export interface PreferencesInput {
  cuisinePreferences?: string[]
  budgetRange?: BudgetRange
  dietary?: string[]
  locationArea?: LocationArea
}

/* ------------------------------------------------------------------ */
/* Typed endpoint functions                                            */
/* ------------------------------------------------------------------ */

export async function postDecisionQuery(
  input: DecisionQueryInput,
): Promise<DecisionResponse> {
  const { data } = await api.post<DecisionResponse>('/api/decisions/query', {
    prompt: input.prompt,
    moodChips: input.moodChips ?? [],
    userId: input.userId,
  })
  return data
}

export async function patchDecisionSelect(
  sessionId: string,
  body: { selectedResultId: string; actionTaken: DecisionAction },
): Promise<{ session: unknown }> {
  const { data } = await api.patch(
    `/api/decisions/${sessionId}/select`,
    body,
  )
  return data
}

export async function getRestaurant(id: string): Promise<Restaurant> {
  const { data } = await api.get<Restaurant>(`/api/restaurants/${id}`)
  return data
}

export async function getDailyToday(): Promise<DailyToday> {
  const { data } = await api.get<DailyToday>('/api/daily/today')
  return data
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/api/users/me')
  return data
}

export async function updatePreferences(
  body: PreferencesInput,
): Promise<User> {
  const { data } = await api.patch<User>('/api/users/me/preferences', body)
  return data
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export interface AuthResponse {
  token: string
  user: User
}

export async function authSignup(body: {
  name: string
  email: string
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

export const GOOGLE_AUTH_URL = `${baseURL}/api/auth/google`

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface RestaurantInput {
  name: string
  cuisineType: string
  area: LocationArea
  priceMin: number
  priceMax: number
  phone?: string | null
  googleMapsUrl?: string | null
  talabatUrl?: string | null
  noonUrl?: string | null
  deliverooUrl?: string | null
  isActive?: boolean
  isFeatured?: boolean
  tags?: string[]
  ratingScore?: number
  averageCalories?: number | null
}

export interface PaginatedRestaurants {
  restaurants: Restaurant[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export async function adminGetRestaurants(
  page = 1,
): Promise<PaginatedRestaurants> {
  const { data } = await api.get<PaginatedRestaurants>(
    `/api/admin/restaurants?page=${page}`,
  )
  return data
}

export async function adminCreateRestaurant(
  body: RestaurantInput,
): Promise<Restaurant> {
  const { data } = await api.post<Restaurant>('/api/admin/restaurants', body)
  return data
}

export async function adminUpdateRestaurant(
  id: string,
  body: Partial<RestaurantInput>,
): Promise<Restaurant> {
  const { data } = await api.patch<Restaurant>(
    `/api/admin/restaurants/${id}`,
    body,
  )
  return data
}

export async function adminSetDaily(body: {
  themeLabel: string
  result1Id: string
  result2Id: string
  result3Id: string
}): Promise<DailyToday> {
  const { data } = await api.post<DailyToday>('/api/admin/daily', body)
  return data
}

export const LOCATION_AREAS: LocationArea[] = [
  'JLT',
  'DIFC',
  'DOWNTOWN',
  'BUSINESS_BAY',
  'MARINA',
  'OTHER',
]

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

export const AREA_LABELS: Record<LocationArea, string> = {
  JLT: 'JLT',
  DIFC: 'DIFC',
  DOWNTOWN: 'Downtown',
  BUSINESS_BAY: 'Business Bay',
  MARINA: 'Marina',
  OTHER: 'Dubai',
}

export const prettyArea = (area: LocationArea) => AREA_LABELS[area] ?? 'Dubai'
