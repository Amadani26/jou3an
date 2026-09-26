/**
 * Filesystem side of the import pipeline.
 *
 * `server/imports/` is GITIGNORED: candidate, approved and prune-candidate
 * files are working documents for a curation session, and `rejected.json` /
 * `venue-overrides.json` are a local memory of what a human has already decided.
 * None of it belongs in the repo.
 */
import fs from 'node:fs'
import path from 'node:path'

/** Resolved from this file so it works regardless of the caller's cwd. */
export const IMPORTS_DIR = path.resolve(__dirname, '../../imports')

export const REJECTED_PATH = path.join(IMPORTS_DIR, 'rejected.json')

/** One row in a candidates / approved file. */
export interface Candidate {
  name: string
  placeId: string
  rating: number | null
  ratingCount: number | null
  priceLevel: string | null
  address: string | null
  primaryType: string | null
}

export interface RejectedFile {
  /** Place ids a human has explicitly declined, newest last. */
  placeIds: string[]
  /** Why each was dropped, for when someone wonders months later. */
  notes?: Record<string, string>
}

export function ensureImportsDir(): void {
  fs.mkdirSync(IMPORTS_DIR, { recursive: true })
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback
    const raw = fs.readFileSync(file, 'utf8').trim()
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (err) {
    throw new Error(
      `Could not parse ${path.basename(file)}: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export function writeJson(file: string, data: unknown): void {
  ensureImportsDir()
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

/**
 * Accepts either a bare array of candidates or `{ candidates: [...] }`, so a
 * hand-edited approved file works whichever shape the curator kept.
 */
export function readCandidates(file: string): Candidate[] {
  const raw = readJson<unknown>(file, [])
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { candidates?: unknown }).candidates)
      ? (raw as { candidates: unknown[] }).candidates
      : null

  if (!arr) {
    throw new Error(
      `${path.basename(file)} is neither an array nor { candidates: [...] }`,
    )
  }

  return arr.flatMap((r) => {
    const row = r as Partial<Candidate>
    // A row without a placeId cannot be imported or rejected — drop it loudly
    // rather than silently creating a restaurant with no Google pin.
    if (!row || typeof row.placeId !== 'string' || !row.placeId.trim()) return []
    return [
      {
        name: String(row.name ?? '').trim() || '(unnamed)',
        placeId: row.placeId.trim(),
        rating: typeof row.rating === 'number' ? row.rating : null,
        ratingCount: typeof row.ratingCount === 'number' ? row.ratingCount : null,
        priceLevel: typeof row.priceLevel === 'string' ? row.priceLevel : null,
        address: typeof row.address === 'string' ? row.address : null,
        primaryType: typeof row.primaryType === 'string' ? row.primaryType : null,
      },
    ]
  })
}

export function readRejected(): RejectedFile {
  const data = readJson<RejectedFile>(REJECTED_PATH, { placeIds: [], notes: {} })
  return {
    placeIds: Array.isArray(data.placeIds) ? data.placeIds.filter(Boolean) : [],
    notes: data.notes && typeof data.notes === 'object' ? data.notes : {},
  }
}

/** Adds ids to the rejected list, de-duplicated. Returns how many were new. */
export function addRejected(
  placeIds: string[],
  notes: Record<string, string> = {},
): number {
  const current = readRejected()
  const known = new Set(current.placeIds)
  const fresh = placeIds.filter((id) => id && !known.has(id))

  if (!fresh.length) return 0

  writeJson(REJECTED_PATH, {
    placeIds: [...current.placeIds, ...fresh],
    notes: { ...current.notes, ...notes },
  })
  return fresh.length
}

/** Removes one id from the rejected list. Returns true if it was there. */
export function removeRejected(placeId: string): boolean {
  const current = readRejected()
  if (!current.placeIds.includes(placeId)) return false

  const notes = { ...current.notes }
  delete notes[placeId]
  writeJson(REJECTED_PATH, {
    placeIds: current.placeIds.filter((id) => id !== placeId),
    notes,
  })
  return true
}

/* ------------------------------------------------------------------ */
/* Venue-type overrides                                                */
/* ------------------------------------------------------------------ */

export const VENUE_OVERRIDES_PATH = path.join(IMPORTS_DIR, 'venue-overrides.json')

export interface VenueOverridesFile {
  /** placeId -> the venue type a human set by hand. */
  types: Record<string, 'RESTAURANT' | 'CAFE'>
  /** Why, for when someone wonders months later. */
  notes?: Record<string, string>
}

/**
 * Venue types a human has set by hand with `npm run setvenue`.
 *
 * Same idea as `rejected.json`: a local memory of a human decision, so the
 * bulk classifier stops arguing with it. Google calls plenty of brunch places
 * `cafe`, and re-proposing the same correction every run is how a curation tool
 * becomes noise a person stops reading.
 */
export function readVenueOverrides(): VenueOverridesFile {
  const data = readJson<VenueOverridesFile>(VENUE_OVERRIDES_PATH, { types: {}, notes: {} })
  const types = data.types && typeof data.types === 'object' ? data.types : {}
  return {
    types: Object.fromEntries(
      Object.entries(types).filter(
        ([, v]) => v === 'RESTAURANT' || v === 'CAFE',
      ) as [string, 'RESTAURANT' | 'CAFE'][],
    ),
    notes: data.notes && typeof data.notes === 'object' ? data.notes : {},
  }
}

/** Records one hand-set venue type. A row with no placeId cannot be recorded. */
export function setVenueOverride(
  placeId: string,
  type: 'RESTAURANT' | 'CAFE',
  note?: string,
): void {
  const current = readVenueOverrides()
  writeJson(VENUE_OVERRIDES_PATH, {
    types: { ...current.types, [placeId]: type },
    notes: { ...current.notes, ...(note ? { [placeId]: note } : {}) },
  })
}

/* ------------------------------------------------------------------ */
/* CLI helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * y/N prompt on stdin. Anything but an explicit y/yes is a NO, and a
 * non-interactive stdin (a pipe, CI) answers no rather than guessing — these
 * scripts mutate the catalogue, so silence must never mean consent.
 */
export async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.log(`${question} [y/N] — stdin is not a TTY, assuming NO.`)
    return false
  }

  const readline = await import('node:readline/promises')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase()
    return answer === 'y' || answer === 'yes'
  } finally {
    rl.close()
  }
}

/** True for `--flag`, `--flag true`, `--flag=true`. */
export const flag = (v: string | true | undefined) => v === true || v === 'true'

/** Minimal `--flag value` / `--flag=value` parser — no dependency needed. */
export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue

    const eq = arg.indexOf('=')
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1)
      continue
    }

    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[arg.slice(2)] = next
      i++
    } else {
      out[arg.slice(2)] = true
    }
  }
  return out
}

/** Pads and truncates for the console tables. */
export const col = (s: string, n: number) => s.padEnd(n).slice(0, n)

/** Polite pause between API calls so a run never looks like a scrape. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
