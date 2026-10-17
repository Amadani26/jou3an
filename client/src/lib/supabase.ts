import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The landing page talks to Supabase DIRECTLY — it must work standalone on
 * Vercel with the Express server offline. The anon key is safe to ship: RLS
 * grants the anon role INSERT on `waitlist_signups` and nothing else, and the
 * count comes back through a SECURITY DEFINER RPC, so rows are never readable.
 * See `client/supabase/waitlist.sql` for the schema + policies.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Vercel PREVIEW deployments never write to the real waitlist: the form plays
 * its success state against a mock instead, so a reviewer poking the branch
 * cannot insert rows. The count stays read-only (the RPC reads nothing back
 * that anon could not already see) and falls back to the baseline as always.
 * Production and local builds are unchanged ('' and 'production' both pass).
 */
const IS_PREVIEW = import.meta.env.VITE_VERCEL_ENV === 'preview'

/** Baseline so the counter reads as a real community from day one. */
export const WAITLIST_BASE_COUNT = 731

/** False when the env vars are missing — every caller degrades gracefully. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * The SDK is LOADED ON DEMAND, not imported at module scope.
 *
 * @supabase/supabase-js drags in auth-js, realtime-js and storage-js — 95 KB of
 * the initial bundle was unused per Lighthouse — for what this page actually
 * does: one INSERT and one RPC. As a static import it sat in the entry chunk
 * and competed with the hero for bandwidth. As a dynamic import it is a
 * separate chunk fetched when someone is about to use the waitlist, or when
 * the browser goes idle.
 *
 * The import is memoised (one chunk, one client, however many callers) and a
 * failed fetch resolves to null rather than rejecting — a dead network must
 * leave the form reporting a friendly error, not throw past it.
 */
let clientPromise: Promise<SupabaseClient | null> | null = null

function getClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
      )
      .catch((err) => {
        console.error('[waitlist] supabase sdk failed to load', err)
        // Null it so a later attempt (the user pressing submit) can retry
        // instead of being stuck with a permanently rejected promise.
        clientPromise = null
        return null
      })
  }
  return clientPromise
}

/** Warm the chunk ahead of the first interaction, off the critical path. */
export function preloadSupabase(): void {
  void getClient()
}

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
  if (IS_PREVIEW) {
    // Mocked write: same latency shape, same success path, zero rows.
    await new Promise((r) => setTimeout(r, 450))
    return 'joined'
  }
  const supabase = await getClient()
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
  const supabase = await getClient()
  if (!supabase) return WAITLIST_BASE_COUNT

  const { data, error } = await supabase.rpc('waitlist_count')
  if (error || data == null) return WAITLIST_BASE_COUNT

  const n = Number(data)
  return Number.isFinite(n) && n > 0 ? n : WAITLIST_BASE_COUNT
}
