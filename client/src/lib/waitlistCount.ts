import { useEffect, useState } from 'react'
import { WAITLIST_BASE_COUNT, fetchWaitlistCount } from './supabase'

/**
 * One shared count for every place it's rendered (hero CTA, waitlist form,
 * demo CTA) — a module-level store so N mounted counters mean ONE request,
 * and a successful signup refreshes all of them at once.
 */
let current = WAITLIST_BASE_COUNT
let inFlight: Promise<number> | null = null
const listeners = new Set<(n: number) => void>()

function publish(n: number) {
  current = n
  listeners.forEach((fn) => fn(n))
}

function load(): Promise<number> {
  if (!inFlight) {
    inFlight = fetchWaitlistCount()
      .then((n) => {
        publish(n)
        return n
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

/** Re-read the count after a signup lands. */
export function refreshWaitlistCount() {
  // Optimistic bump so the number moves the instant the user joins, then the
  // authoritative value from the RPC overwrites it.
  publish(current + 1)
  void load()
}

/**
 * Run the first fetch when the browser is idle, not during mount.
 *
 * The count arrives from Supabase, whose SDK is a lazily-imported chunk. Firing
 * it at mount pulls that chunk in while the hero is still painting, which is
 * exactly the competition the dynamic import exists to avoid. The counter shows
 * the baseline until the real number lands, which is what it already did on any
 * failure — so the deferred state is a state the UI was always built for.
 */
function loadWhenIdle() {
  if (typeof window === 'undefined') return
  const ric = window.requestIdleCallback
  if (typeof ric === 'function') ric(() => void load(), { timeout: 2500 })
  else window.setTimeout(() => void load(), 1200)
}

export function useWaitlistCount(): number {
  const [count, setCount] = useState(current)

  useEffect(() => {
    listeners.add(setCount)
    loadWhenIdle()
    return () => {
      listeners.delete(setCount)
    }
  }, [])

  return count
}
