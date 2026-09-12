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

export function useWaitlistCount(): number {
  const [count, setCount] = useState(current)

  useEffect(() => {
    listeners.add(setCount)
    void load()
    return () => {
      listeners.delete(setCount)
    }
  }, [])

  return count
}
