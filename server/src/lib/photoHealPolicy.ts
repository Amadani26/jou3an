/**
 * Self-healing photo proxy — the POLICY half, pure and unit-tested.
 *
 * Places photo resource names EXPIRE (the whole Sep 2026 batch came back
 * "The photo resource in the request is invalid"), so the proxy treats a
 * Google 400/403/404 on a stored name as "stale cache" and refreshes that
 * restaurant's names via a photos-only Place Details call. This module owns
 * every decision about WHEN that refresh may run; the I/O (Prisma, Google)
 * lives in `services/photoHeal.ts` and is injected here as a callback.
 *
 * The gate exists to keep a mass expiry from stampeding Google: if the whole
 * catalogue's names die at once (which is exactly how they die), thousands of
 * image requests would otherwise each fire a Place Details call. Instead:
 *   - at most `maxConcurrent` heals run at once; requests for a place with no
 *     slot are answered with the placeholder immediately (`at-capacity`) and
 *     the place heals on a later request,
 *   - concurrent requests for the SAME place join one in-flight heal (all six
 *     photos of one card fail together — that must be ONE Details call),
 *   - a finished heal is remembered for `okTtlMs` / `failTtlMs`, so requests
 *     still carrying the old URLs are answered from the remap without
 *     touching Google (or the DB) again.
 */

/** "places/{placeId}/photos/{photoId}" → the placeId, or null when malformed. */
export function placeIdFromPhotoName(name: string): string | null {
  const m = /^places\/([A-Za-z0-9_-]+)\/photos\/[A-Za-z0-9_-]+$/.exec(name)
  return m ? m[1] : null
}

/**
 * Index-aligned old→fresh mapping, so slide 4 of a slideshow heals to the new
 * slide 4 rather than every slot collapsing onto the same photo. When Google
 * now lists fewer photos than we had, trailing old names clamp to the last
 * fresh one.
 */
export function buildPhotoRemap(
  oldRefs: string[],
  freshRefs: string[],
): Map<string, string> {
  const remap = new Map<string, string>()
  if (!freshRefs.length) return remap
  oldRefs.forEach((old, i) => {
    remap.set(old, freshRefs[Math.min(i, freshRefs.length - 1)])
  })
  return remap
}

/** What one heal produced. `null` from the runner means "not our place" — refuse. */
export interface HealOutcome {
  oldRefs: string[]
  freshRefs: string[]
}

export type HealRunner = (placeId: string) => Promise<HealOutcome | null>

export type HealDisposition =
  | 'cached' // answered from a remembered heal, no work done
  | 'joined' // waited on a heal another request had already started
  | 'healed' // this request ran the heal and it produced fresh names
  | 'failed' // this request ran the heal and it produced nothing (or threw)
  | 'at-capacity' // all heal slots busy — placeholder now, heal later
  | 'invalid' // the name does not parse to a placeId

export interface HealResolution {
  /** Fresh photo name to retry with, or null → serve the placeholder. */
  fresh: string | null
  disposition: HealDisposition
}

interface HealEntry {
  at: number
  ok: boolean
  remap: Map<string, string>
  /** First fresh name — the fallback for an old name the remap never saw. */
  fallback: string | null
}

export interface HealGateOptions {
  maxConcurrent: number
  /** How long a successful heal answers old-URL requests without re-checking. */
  okTtlMs: number
  /** Cooldown after a failed heal before Google is asked about that place again. */
  failTtlMs: number
  now?: () => number
}

export class HealGate {
  private readonly cache = new Map<string, HealEntry>()
  private readonly inFlight = new Map<string, Promise<void>>()
  private active = 0

  constructor(private readonly opts: HealGateOptions) {}

  private now(): number {
    return this.opts.now?.() ?? Date.now()
  }

  private liveEntry(placeId: string): HealEntry | null {
    const entry = this.cache.get(placeId)
    if (!entry) return null
    const ttl = entry.ok ? this.opts.okTtlMs : this.opts.failTtlMs
    if (this.now() - entry.at >= ttl) {
      this.cache.delete(placeId)
      return null
    }
    return entry
  }

  private freshFor(entry: HealEntry, photoName: string): string | null {
    if (!entry.ok) return null
    return entry.remap.get(photoName) ?? entry.fallback
  }

  /**
   * Resolve a photo name Google just rejected into a fresh one (or null →
   * placeholder). `runHeal` is only invoked when policy allows a real heal.
   */
  async resolve(photoName: string, runHeal: HealRunner): Promise<HealResolution> {
    const placeId = placeIdFromPhotoName(photoName)
    if (!placeId) return { fresh: null, disposition: 'invalid' }

    const cached = this.liveEntry(placeId)
    if (cached) return { fresh: this.freshFor(cached, photoName), disposition: 'cached' }

    const pending = this.inFlight.get(placeId)
    if (pending) {
      await pending.catch(() => {})
      const entry = this.liveEntry(placeId)
      return {
        fresh: entry ? this.freshFor(entry, photoName) : null,
        disposition: 'joined',
      }
    }

    if (this.active >= this.opts.maxConcurrent) {
      return { fresh: null, disposition: 'at-capacity' }
    }

    this.active++
    let entry: HealEntry = { at: 0, ok: false, remap: new Map(), fallback: null }
    const run = (async () => {
      try {
        const outcome = await runHeal(placeId)
        if (outcome && outcome.freshRefs.length) {
          entry = {
            at: 0,
            ok: true,
            remap: buildPhotoRemap(outcome.oldRefs, outcome.freshRefs),
            fallback: outcome.freshRefs[0],
          }
        }
      } catch {
        // A throw is a failed heal; the entry stays `ok: false` and the fail
        // TTL keeps the next attempts off Google for a while.
      } finally {
        entry.at = this.now()
        this.cache.set(placeId, entry)
        this.inFlight.delete(placeId)
        this.active--
      }
    })()
    this.inFlight.set(placeId, run)
    await run

    return {
      fresh: this.freshFor(entry, photoName),
      disposition: entry.ok ? 'healed' : 'failed',
    }
  }
}
