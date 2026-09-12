import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The landing page talks to Supabase DIRECTLY — it must work standalone on
 * Vercel with the Express server offline. The anon key is safe to ship: RLS
 * grants the anon role INSERT on `waitlist_signups` and nothing else, and the
 * count comes back through a SECURITY DEFINER RPC, so rows are never readable.
 * See `client/supabase/waitlist.sql` for the schema + policies.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Baseline so the counter reads as a real community from day one. */
export const WAITLIST_BASE_COUNT = 731

/** Null when the env vars are missing — every caller degrades gracefully. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

export type WaitlistResult = 'joined' | 'duplicate' | 'error'

/** Good-enough email shape check — the real validation is the DB + the inbox. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

/**
 * Insert an email into the waitlist.
 * No `.select()` — anon has INSERT only, so asking for the row back would 401.
 * A unique-violation (23505) means the email is already signed up.
 */
export async function joinWaitlist(
  email: string,
  source = 'landing',
): Promise<WaitlistResult> {
  if (!supabase) return 'error'

  const { error } = await supabase
    .from('waitlist_signups')
    .insert({ email: email.trim().toLowerCase(), source })

  if (!error) return 'joined'
  if (error.code === '23505') return 'duplicate'
  console.error('[waitlist] insert failed', error)
  return 'error'
}

/**
 * Live signup count via the `waitlist_count()` RPC (already includes the
 * baseline). Falls back to the static baseline on any failure.
 */
export async function fetchWaitlistCount(): Promise<number> {
  if (!supabase) return WAITLIST_BASE_COUNT

  const { data, error } = await supabase.rpc('waitlist_count')
  if (error || data == null) return WAITLIST_BASE_COUNT

  const n = Number(data)
  return Number.isFinite(n) && n > 0 ? n : WAITLIST_BASE_COUNT
}
