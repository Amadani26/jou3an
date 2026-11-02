import { Router, type Request, type Response } from 'express'
import { Readable } from 'node:stream'
import prisma from '../lib/prisma'
import { decide } from '../services/engine'
import { toEngineContext } from '../services/engine/request'
import type { EngineInput, Pick } from '../services/engine/types'
import { isServeable } from '../lib/venueType'
import { isBarLike } from '../lib/barLike'
import { DEMO_AREAS, decideForArea, demoArea } from '../lib/demoAreas'
import { isOpenNow, nextOpeningLabel } from '../lib/hours'
import { displayArea } from '../lib/areaName'
import {
  getPlacePhotos,
  isValidPhotoName,
  photoMediaUrl,
  type PlacePhoto,
} from '../services/googlePlaces'
import { DailyCap, IpRateLimiter, dubaiDay } from '../lib/publicRate'

/**
 * PUBLIC, READ-ONLY endpoints for the marketing site (jou3an.me).
 *
 * The landing page now shows REAL restaurants (the zero-risk rule for venue
 * identities was deliberately reversed — owner's decision, 2026-11-02), and
 * these routes are how it gets them without touching anything that belongs
 * to the app:
 *
 *   - NO DB WRITES, ever: no DecisionSession, no DecisionLog, no taste
 *     events. A marketing visit teaches the engine nothing and shows up in
 *     no analytics. The engine runs as its PURE decide() on an anonymous,
 *     empty-profile input.
 *   - NO INVENTED DATA: real Google ratings (or nothing), real price ranges
 *     (omitted when null), and the engine's own anonymous reason lines —
 *     an empty taste profile cannot produce personal-history phrasing.
 *   - PHOTOS are never stored: the photo endpoint fetches a FRESH photo
 *     name per request (Place Photos doc: "You cannot cache a photo name.
 *     Also, the name can expire." / "Ensure you always get the name from a
 *     response to a request to Place Details (New)…") and streams ~400px
 *     media through this server so the key stays here. authorAttributions
 *     ride on the demo payload because the same doc requires them wherever
 *     the image is shown.
 *   - RATE-PROTECTED: per-IP sliding windows on everything, and a hard
 *     daily cap of 900 photo media fetches — under the 1,000/day
 *     GetPhotoMediaRequest quota set in Google Cloud, so the quota is the
 *     backstop, not the first line.
 */

const router = Router()

/* ---- protection ---- */
const ROUTER_LIMIT = new IpRateLimiter(60, 60_000) // any public route
const PHOTO_LIMIT = new IpRateLimiter(15, 60_000) // the billable one
/** 900/day: the Google quota is 1,000 — the cap trips first, on purpose. */
const PHOTO_DAILY_CAP = new DailyCap(900)
/** ~$7 per 1,000 media requests — the only billable call on these routes. */

router.use((req, res, next) => {
  if (!ROUTER_LIMIT.allow(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }
  next()
})

/* ---- tiny TTL cache: "short server cache", per the brief ---- */
const TTL_MS = 120_000
const cache = new Map<string, { at: number; data: unknown }>()
const cached = <T>(key: string): T | null => {
  const hit = cache.get(key)
  if (!hit || Date.now() - hit.at > TTL_MS) return null
  return hit.data as T
}
const store = (key: string, data: unknown) => cache.set(key, { at: Date.now(), data })

/* ---- the anonymous engine run ---- */

async function anonymousDecision(coords?: { lat: number; lng: number }) {
  // Marketing-surface rule: no bars, lounges, pubs or clubs as picks —
  // "Jou3an decides restaurants". The APP's own pools are untouched.
  const candidates = (await prisma.restaurant.findMany()).filter((r) => !isBarLike(r))
  const input: EngineInput = {
    candidates,
    taste: {}, // empty profile: no personal-history reason line can fire
    context: toEngineContext(
      {
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        // Hour-of-day nonce: the picks rotate through the day without a
        // per-request reshuffle (and stay stable under the response cache).
        refreshNonce: new Date().getUTCHours(),
      },
      null,
      new Date(),
    ),
    userId: null,
    recentSelections: [],
    pickRates: {},
  }
  return decide(input)
}

/**
 * The engine's context line can print a price for rows whose price is NULL
 * ("AED null–null a head" — the honest-prices migration made the columns
 * nullable after that line was written). Public rule is NO invented or
 * broken data, so such a line falls back to the plain cuisine label.
 */
const safeReason = (reason: string, cuisine: string) =>
  /null/.test(reason) ? cuisine : reason

function publicPick(p: Pick) {
  const r = p.restaurant
  return {
    id: r.id,
    placeId: r.googlePlaceId,
    name: r.name,
    cuisine: r.cuisineType,
    area: displayArea(r),
    priceMin: r.priceMin,
    priceMax: r.priceMax,
    rating: r.googleRating,
    ratingCount: r.googleRatingCount,
    // Real highlight tags (the closed 15-slug vocabulary), capped like the
    // app's own chips; the hero's detail beat renders them.
    tags: (r.tags ?? []).slice(0, 3),
    reason: safeReason(p.reason, r.cuisineType),
  }
}

/**
 * GET /api/public/showcase — the hero's three picks (also the phone
 * screen's rows; the first is Decide→Act's restaurant) and a spread of
 * real names for the problem wall. City-wide anonymous engine run.
 */
router.get('/showcase', async (_req, res) => {
  try {
    const hit = cached<object>('showcase')
    if (hit) {
      res.json(hit)
      return
    }
    const decision = await anonymousDecision()
    const picks = decision.picks.map(publicPick)

    // The wall: well-rated servable rows across many cuisines — names and
    // real facts only; the client renders them as colour-field cards.
    const rows = await prisma.restaurant.findMany({
      where: { isActive: true, venueType: 'RESTAURANT', googleRating: { not: null } },
      orderBy: { googleRating: 'desc' },
      take: 120,
    })
    const seenCuisine = new Set<string>()
    const wall: ReturnType<typeof publicPick>[] = []
    for (const r of rows) {
      if (isBarLike(r)) continue
      const key = r.cuisineType.toLowerCase()
      if (seenCuisine.has(key)) continue
      seenCuisine.add(key)
      wall.push({
        id: r.id,
        placeId: r.googlePlaceId,
        name: r.name,
        cuisine: r.cuisineType,
        area: displayArea(r),
        priceMin: r.priceMin,
        priceMax: r.priceMax,
        rating: r.googleRating,
        ratingCount: r.googleRatingCount,
        tags: (r.tags ?? []).slice(0, 3),
        reason: r.cuisineType,
      })
      if (wall.length >= 14) break
    }

    const payload = { picks, wall, generatedAt: new Date().toISOString() }
    store('showcase', payload)
    // Explicit, short: without it browsers heuristically cache the JSON far
    // longer, and a dead API would keep "answering" from disk cache.
    res.setHeader('Cache-Control', 'public, max-age=120')
    res.json(payload)
  } catch {
    res.status(500).json({ error: 'Unavailable' })
  }
})

/**
 * GET /api/public/demo?area=JLT — three real picks near the chosen area,
 * with the engine's anonymous reason lines and (when Google lists photos)
 * the attribution the photo endpoint's image must be displayed with.
 * ⚠️ Photo NAMES are deliberately absent — they may not be cached, and
 * this response is. /demo-photo fetches a fresh name per image request.
 */
router.get('/demo', async (req, res) => {
  try {
    const key_ = String(req.query.area ?? 'MARINA').toUpperCase()
    const spot = demoArea(key_)
    if (!spot) {
      res.status(400).json({ error: 'Unknown area' })
      return
    }
    const key = `demo:${spot.key}`
    const hit = cached<object>(key)
    if (hit) {
      res.json(hit)
      return
    }

    // HARD area filter — three places IN the tapped area, never widened.
    // The only relaxation decideForArea permits is the hours gate, within
    // the same area; a closed pick carries its next opening time so the
    // card can say "Opens at 12:00" instead of hiding it.
    const now = new Date()
    const candidates = await prisma.restaurant.findMany()
    const decision = decideForArea(candidates, spot, now, now.getUTCHours())
    const results = await Promise.all(
      decision.picks.map(async (p) => {
        const base = {
          ...publicPick(p),
          opensAt: isOpenNow(p.restaurant, now) ? null : nextOpeningLabel(p.restaurant, now),
          hasPhoto: false as boolean,
          photoAuthor: null as { name: string; uri: string | null } | null,
        }
        if (!p.restaurant.googlePlaceId) return base
        try {
          // Free call (Essentials IDs-Only field mask). Only the attribution
          // and a has-photos flag are kept; the photo NAME is discarded.
          const details = await getPlacePhotos(p.restaurant.googlePlaceId)
          const photo: PlacePhoto | undefined = details.photos?.[0]
          if (!photo) return base
          const author = photo.authorAttributions?.[0]
          return {
            ...base,
            hasPhoto: true,
            photoAuthor: author?.displayName
              ? { name: author.displayName, uri: author.uri ?? null }
              : null,
          }
        } catch {
          return base
        }
      }),
    )

    const payload = {
      area: spot.key,
      label: spot.label,
      areas: DEMO_AREAS.map((a) => ({ key: a.key, label: a.label })),
      results,
      generatedAt: new Date().toISOString(),
    }
    store(key, payload)
    res.setHeader('Cache-Control', 'public, max-age=120')
    res.json(payload)
  } catch {
    res.status(500).json({ error: 'Unavailable' })
  }
})

/**
 * GET /api/public/demo-photo/:placeId — ONE ~400px photo for a demo card.
 *
 * Per request: fresh photo name via the free photos-only Place Details
 * (never stored anywhere, per Google's no-caching rule), then the media
 * bytes streamed through here (Place Details Photos SKU, $7/1k) with a
 * short PRIVATE cache header. Gated three ways: per-IP limit, the 900/day
 * cap, and a DB check that the place is one of OUR servable restaurants —
 * this route must never be usable to bill arbitrary place IDs.
 */
router.get('/demo-photo/:placeId', async (req: Request, res: Response) => {
  const ip = req.ip ?? 'unknown'
  if (!PHOTO_LIMIT.allow(ip)) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }
  const placeId = String(req.params.placeId ?? '')
  if (!/^[A-Za-z0-9_-]{10,}$/.test(placeId)) {
    res.status(400).json({ error: 'Invalid place' })
    return
  }
  try {
    const r = await prisma.restaurant.findUnique({
      where: { googlePlaceId: placeId },
      select: { isActive: true, venueType: true },
    })
    if (!r || !isServeable(r)) {
      res.status(404).json({ error: 'Unknown place' })
      return
    }
    if (!PHOTO_DAILY_CAP.take()) {
      console.log(`[public-photo] daily cap reached (${dubaiDay()})`)
      res.status(429).json({ error: 'Daily photo budget spent' })
      return
    }

    const details = await getPlacePhotos(placeId)
    const name = details.photos?.[0]?.name
    if (!name || !isValidPhotoName(name)) {
      res.status(404).json({ error: 'No photo' })
      return
    }
    const upstream = await fetch(photoMediaUrl(name, 400))
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: 'Unable to load photo' })
      return
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg')
    // Private + short: the visitor's browser may hold it for the visit, but
    // nothing shared caches it and we store nothing.
    res.setHeader('Cache-Control', 'private, max-age=600')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    const length = upstream.headers.get('content-length')
    if (length) res.setHeader('Content-Length', length)
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res)
  } catch {
    res.status(502).json({ error: 'Unable to load photo' })
  }
})

export default router
