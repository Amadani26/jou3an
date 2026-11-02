/**
 * Rate protection for the PUBLIC marketing endpoints (src/routes/public.ts).
 *
 * In-memory on purpose: Railway runs one instance, the counters are a cost
 * valve rather than a security boundary (the hard backstop is the Google
 * Cloud quota — GetPhotoMediaRequest 1,000/day — and the $50 budget alert),
 * and losing a counter on redeploy only ever errs cheaper, not dearer.
 */

/** Sliding-window per-IP limiter. */
export class IpRateLimiter {
  private hits = new Map<string, number[]>()

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  allow(ip: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs
    const list = (this.hits.get(ip) ?? []).filter((t) => t > cutoff)
    if (list.length >= this.max) {
      this.hits.set(ip, list)
      return false
    }
    list.push(now)
    this.hits.set(ip, list)
    // Opportunistic prune so a scanner sweeping IPs can't grow the map forever.
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) {
        if (!v.some((t) => t > cutoff)) this.hits.delete(k)
      }
    }
    return true
  }
}

/** Today's date in Dubai — the cap day rolls at the audience's midnight. */
export function dubaiDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** A hard daily spend cap: `take()` is a one-way ticket, no refunds. */
export class DailyCap {
  private day = ''
  private used = 0

  constructor(private readonly cap: number) {}

  take(now = new Date()): boolean {
    const today = dubaiDay(now)
    if (today !== this.day) {
      this.day = today
      this.used = 0
    }
    if (this.used >= this.cap) return false
    this.used++
    return true
  }

  remaining(now = new Date()): number {
    return dubaiDay(now) === this.day ? Math.max(0, this.cap - this.used) : this.cap
  }
}
