/**
 * Build-time fallback snapshot — REAL restaurants, never dishes.
 *
 * Fetches /api/public/showcase from the production API and writes it to
 * src/generated/showcase-fallback.json, which the page renders instantly
 * (prerender included) and whenever the live API is unreachable. Live data
 * replaces it the moment it loads.
 *
 * Runs at the start of every `npm run build`. If the API cannot be
 * reached (offline build, API down), the PREVIOUS committed snapshot is
 * kept and the build continues — the snapshot is a floor, not a gate.
 * The server already excludes bars/lounges and invented data, so the
 * snapshot inherits those rules; ratings inside it are only ever shown
 * with the "· Google" attribution by the components.
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const API =
  process.env.VITE_API_URL?.replace(/\/$/, '') ||
  'https://server-production-0599.up.railway.app'

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/generated/showcase-fallback.json',
)

const valid = (d) =>
  d &&
  Array.isArray(d.picks) &&
  d.picks.length === 3 &&
  Array.isArray(d.wall) &&
  d.wall.length >= 6 &&
  d.picks.every((p) => typeof p.name === 'string' && p.name.length > 0)

try {
  const res = await fetch(`${API}/api/public/showcase`, {
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!valid(data)) throw new Error('payload failed validation')
  // Strip the volatile field so an unchanged catalogue diffs clean.
  delete data.generatedAt
  writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n')
  console.log(
    `[snapshot] showcase-fallback.json refreshed from ${API} ` +
      `(${data.picks.length} picks, ${data.wall.length} wall)`,
  )
} catch (err) {
  try {
    readFileSync(OUT)
    console.warn(
      `[snapshot] could not refresh (${err.message}) — keeping the committed snapshot`,
    )
  } catch {
    console.error(
      `[snapshot] no snapshot available and the API is unreachable (${err.message})`,
    )
    process.exit(1)
  }
}
