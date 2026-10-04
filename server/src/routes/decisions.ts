import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { decideRestaurants } from '../services/decisionEngine'
import { optionalAuth, requireAuth } from '../middleware/auth'
import { photoProxyPath, withPhotoUrlsAll } from '../lib/photos'
import { SERVEABLE_WHERE, isServeable } from '../lib/venueType'
import {
  applyTasteEvent,
  applyTasteEvents,
  getEffectiveTasteWeights,
  type TasteEvent,
} from '../services/tasteProfile'
import { decide, type Decision3, type EngineInput } from '../services/engine'
import { getPickRates, getRecentSelections, logDecision } from '../services/engine/log'
import { toEngineContext } from '../services/engine/request'
import {
  distanceKm as kmBetween,
  hasCoords,
  roundKm,
  withinRadius,
  type Coords,
} from '../lib/geo'

const router = Router()

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Ceiling on the accumulated "already shown" list.
 *
 * Three per Refresh, so this is ~100 taps on one brief — far past the point
 * where the engine starts cycling. It exists to bound the request body, not to
 * shape behaviour.
 */
const MAX_EXCLUDE_IDS = 300

const querySchema = z.object({
  // Still required, but now for DISPLAY and history only — the engine reads the
  // structured fields below. Older clients send only this.
  prompt: z.string().min(1, 'prompt is required'),
  moodChips: z.array(z.string()).default([]),
  userId: z.string().optional(),
  // Present only when the user picked "Nearby" or an area in the Decide flow.
  lat: z.number().optional(),
  lng: z.number().optional(),

  // --- DecisionEngine v2 structured filters -------------------------
  // All optional: a build that predates them still gets a valid decision,
  // just a less constrained one.
  cuisines: z.array(z.string()).default([]),
  format: z.enum(['Delivery', 'Dine In']).optional(),
  vibe: z.enum(['Casual', 'Fancy']).optional(),
  /** Display label for a picked area ("JBR"); coords are what actually filter. */
  areaName: z.string().optional(),
  /**
   * Increments on each Refresh tap. 0 (the default) keeps a first load
   * deterministic for the whole Dubai day; any other value re-rolls.
   */
  refreshNonce: z.number().int().min(0).default(0),
  /**
   * Budget for THIS query, from the Decide flow's budget pill. Outranks the
   * user's saved band; 'ANY' is the explicit "no budget" the pill can send.
   * Omitted by older clients, who get the saved band as before.
   */
  budget: z.enum(['LOW', 'MID', 'HIGH', 'ANY']).optional(),
  /**
   * Restaurants already shown for THIS brief, accumulated by the Refresh
   * button. The engine removes them from the pool before selection, so Refresh
   * means "something I haven't seen" rather than "roll again and maybe repeat".
   *
   * Capped: a client that keeps refreshing forever must not grow its request
   * without bound, and past the cap the brief is exhausted anyway — the engine
   * answers that case by cycling. Ignored by the v1 matcher.
   */
  excludeIds: z.array(z.string()).max(MAX_EXCLUDE_IDS).default([]),
})

/** Engine v2 is opt-in per environment while it runs alongside the matcher. */
const engineV2Enabled = () => process.env.ENGINE_V2 === 'true'

/**
 * Radius tiers for a located query, widest-last. The product rule is ALWAYS
 * exactly 3 results, so a tier is only used when it can supply at least 3
 * candidates; otherwise we widen, and ultimately fall back to all of Dubai.
 */
const RADIUS_TIERS = [
  { km: 5, tier: 'NEARBY' as const },
  { km: 10, tier: 'WIDER' as const },
]

type RadiusTier = 'NEARBY' | 'WIDER' | 'CITY'

// POST /api/decisions/query — works anonymously; associates the logged-in user when a token is present
router.post('/query', optionalAuth, async (req, res) => {
  const parsed = querySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }
  const {
    prompt,
    moodChips,
    userId,
    lat,
    lng,
    cuisines,
    format,
    vibe,
    refreshNonce,
    budget,
    excludeIds,
  } = parsed.data

  // Prefer the authenticated user; fall back to a body userId that exists (FK safety)
  let validUserId: string | null = req.userId ?? null
  if (!validUserId && userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) validUserId = user.id
  }

  const origin: Coords | null =
    typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null

  // Distance is attached whenever we know where the user is, even on the
  // city-wide fallback — it's useful context either way. Computed over ALL
  // restaurants so it is available regardless of which path picked the 3.
  const allRestaurants = await prisma.restaurant.findMany()
  const distances = origin
    ? new Map(
        allRestaurants
          .filter(hasCoords)
          .map((r) => [r.id, roundKm(kmBetween(origin, { lat: r.lat, lng: r.lng }))]),
      )
    : null

  let results: (typeof allRestaurants[number] & { distanceKm?: number; reason?: string })[]
  let radiusKm: number | null = null
  let radiusTier: RadiusTier = 'CITY'
  let engineUsed: 'v1' | 'v2' = 'v1'
  // True when the Refresh exclusions had to be abandoned to field three picks:
  // the brief is spent and these are the top picks again. v1 never cycles —
  // it has no notion of what the user has already been shown.
  let cycled = false
  // Captured on the v2 path so the audit row can be written once the session
  // exists (DecisionLog.sessionId is the join back to what the user saw).
  let auditInput: EngineInput | null = null
  let auditDecision: Decision3 | null = null

  if (engineV2Enabled()) {
    // ---------------- DecisionEngine v2 ----------------
    engineUsed = 'v2'

    // Effective weights = swipe/select-learned PLUS the onboarding quiz's own
    // contribution, summed and clamped. The quiz seeds the profile; it does not
    // replace it — see effectiveTasteWeights().
    const [profileWeights, recentSelections, pickRates, prefs] = await Promise.all([
      getEffectiveTasteWeights(validUserId),
      getRecentSelections(validUserId),
      getPickRates(validUserId),
      validUserId
        ? prisma.user.findUnique({
            where: { id: validUserId },
            // Exactly the three columns the taste quiz feeds into the engine.
            select: { budgetRange: true, dietary: true, adventurousness: true },
          })
        : null,
    ])

    const engineInput: EngineInput = {
      // The engine applies its own hard gate (isActive + venueType) in Stage 1,
      // so handing it the whole catalogue is safe — and keeps the one
      // definition of "servable" in ../lib/venueType.ts.
      candidates: allRestaurants,
      // The profile as it stands. ⚠️ Requested cuisines are NOT folded in here
      // any more (`boostedTasteWeights`, deleted): they are a hard Stage-1
      // filter, so taste now ranks only WITHIN what the user asked for.
      tasteWeights: profileWeights,
      context: toEngineContext(
        { format, vibe, lat, lng, refreshNonce, cuisines, budget, excludeIds },
        prefs,
        new Date(),
      ),
      userId: validUserId,
      recentSelections,
      pickRates,
    }

    const decision = decide(engineInput)

    radiusKm = decision.radiusKm
    radiusTier = decision.radiusTier
    cycled = decision.cycled
    results = decision.picks.map((p) => ({
      ...p.restaurant,
      ...(p.distanceKm !== null ? { distanceKm: p.distanceKm } : {}),
      reason: p.reason,
    }))

    auditInput = engineInput
    auditDecision = decision
  } else {
    // ---------------- Legacy keyword matcher ----------------
    // Same gate as the engine: de-listed rows and parked cafes are never served.
    const restaurants = allRestaurants.filter(isServeable)

    // Prefer nearby, but widen rather than ever return fewer than 3.
    let pool = restaurants
    if (origin) {
      for (const { km, tier } of RADIUS_TIERS) {
        const within = withinRadius(restaurants, origin, km)
        if (within.length >= 3) {
          pool = within
          radiusKm = km
          radiusTier = tier
          break
        }
      }
    }

    const picked = decideRestaurants(prompt, moodChips, pool)
    results = picked.map((r) =>
      distances?.has(r.id) ? { ...r, distanceKm: distances.get(r.id) } : r,
    )
  }

  // v1 attaches distance from the map; v2 already carries its own (identical)
  // value, so only fill the gap where it is missing.
  results = results.map((r) =>
    r.distanceKm === undefined && distances?.has(r.id)
      ? { ...r, distanceKm: distances.get(r.id) }
      : r,
  )

  const session = await prisma.decisionSession.create({
    data: {
      userId: validUserId,
      promptText: prompt,
      moodChipsUsed: moodChips,
      resultIds: results.map((r) => r.id),
    },
  })

  // Audit the invocation now that the session id exists. logDecision swallows
  // its own errors, so this can never cost the user their decision.
  if (auditInput && auditDecision) {
    await logDecision(auditInput, auditDecision, session.id)
  }

  res.json({
    results: withPhotoUrlsAll(results),
    sessionId: session.id,
    // Which radius tier actually produced these picks.
    radiusKm,
    radiusTier,
    // Which engine answered — lets the client (and a curl) tell the paths
    // apart while v2 is behind a flag.
    engine: engineUsed,
    // The brief ran out of unseen restaurants and came back to the top.
    cycled,
  })
})

/**
 * DecisionEngine v2: the client may now send the FULL swipe log so we can learn
 * from passes as well as likes.
 *
 * `likedIds` stays supported and is still what picks the results — older app
 * builds send only that, and they must keep working. When `swipes` is present
 * its right-swipes are merged into the liked set, so a client can send either
 * shape (or both) and get the same behaviour.
 *
 * The current app sends the FULL log, so a LEFT swipe is now a real training
 * signal (-0.25) and not merely an absence. That is the half the profile was
 * missing: "not this" is information, and a user who passes on twelve burger
 * places has said something a list of their likes cannot express.
 */
const swipeSchema = z.object({
  restaurantId: z.string().min(1),
  direction: z.enum(['LEFT', 'RIGHT']),
})

const tinderSchema = z.object({
  likedIds: z.array(z.string()).default([]),
  swipes: z.array(swipeSchema).default([]),
})

// POST /api/decisions/tinder-suggest — 3 picks from the swiped-right list
// (falls back to random active restaurants when there aren't enough likes).
// Placeholder logic for now; Phase 4 will make this AI-driven.
router.post('/tinder-suggest', optionalAuth, async (req, res) => {
  const parsed = tinderSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }
  const { likedIds, swipes } = parsed.data

  /**
   * One entry per restaurant, keeping the LAST swipe on it.
   *
   * The deck loops once the pool is spent, so a long session genuinely re-shows
   * cards and the client sends every swipe including the repeats — it has to,
   * because that log is also what orders the next lap. Here they would be a
   * problem: five passes on the same place would stack to -1.25 on its cuisine
   * and bury it, and a pass followed later by a like would net out as neither.
   * The most recent swipe is the user's current opinion, so that is the one that
   * trains the profile; the earlier ones are superseded, not additional.
   */
  const dedupedSwipes = [...new Map(swipes.map((s) => [s.restaurantId, s])).values()]

  // Right-swipes from the log count as likes too, so a client that sends only
  // `swipes` behaves identically to one that sends only `likedIds`.
  const likedSet = new Set([
    ...likedIds,
    ...dedupedSwipes.filter((s) => s.direction === 'RIGHT').map((s) => s.restaurantId),
  ])
  const effectiveLikedIds = [...likedSet]

  const liked = effectiveLikedIds.length
    ? await prisma.restaurant.findMany({
        where: { id: { in: effectiveLikedIds }, ...SERVEABLE_WHERE },
      })
    : []

  // Top up with other servable restaurants if we don't have 3 likes yet.
  let pool = liked
  if (pool.length < 3) {
    const actives = await prisma.restaurant.findMany({ where: SERVEABLE_WHERE })
    const seen = new Set(pool.map((r) => r.id))
    pool = [...pool, ...actives.filter((r) => !seen.has(r.id))]
  }

  const results = shuffle(pool).slice(0, 3)

  // --- DecisionEngine v2: learn from the swipe log -------------------
  // Only for signed-in users (a profile needs a userId to hang off), and only
  // from `swipes`, which is the shape that carries direction. A bare `likedIds`
  // list from an older build teaches nothing about what was rejected, so it is
  // recorded as right-swipes only.
  if (req.userId) {
    const swipedIds = dedupedSwipes.length
      ? dedupedSwipes.map((s) => s.restaurantId)
      : effectiveLikedIds
    const cuisineById = new Map(
      (swipedIds.length
        ? await prisma.restaurant.findMany({
            where: { id: { in: swipedIds } },
            select: { id: true, cuisineType: true },
          })
        : []
      ).map((r) => [r.id, r.cuisineType]),
    )

    const events = (
      dedupedSwipes.length
        ? dedupedSwipes.map((s) => ({
            cuisine: cuisineById.get(s.restaurantId) ?? '',
            event: (s.direction === 'RIGHT' ? 'SWIPE_RIGHT' : 'SWIPE_LEFT') as TasteEvent,
          }))
        : effectiveLikedIds.map((id) => ({
            cuisine: cuisineById.get(id) ?? '',
            event: 'SWIPE_RIGHT' as TasteEvent,
          }))
    ).filter((e) => e.cuisine)

    // Never let a telemetry failure cost the user their suggestions.
    await applyTasteEvents(req.userId, events).catch((err) =>
      console.error('[tasteProfile] tinder-suggest update failed:', err),
    )
  }

  const session = await prisma.decisionSession.create({
    data: {
      userId: req.userId ?? null,
      promptText: 'Tinder suggestions',
      moodChipsUsed: [],
      resultIds: results.map((r) => r.id),
    },
  })

  res.json({ results: withPhotoUrlsAll(results), sessionId: session.id })
})

// GET /api/decisions/history — the signed-in user's picks (selection made),
// most recent first, joined with the selected restaurant. Max 50.
router.get('/history', requireAuth, async (req, res) => {
  const sessions = await prisma.decisionSession.findMany({
    where: { userId: req.userId, selectedResultId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // selectedResultId is a plain string (no FK relation) — join manually.
  const ids = [...new Set(sessions.map((s) => s.selectedResultId as string))]
  const restaurants = ids.length
    ? await prisma.restaurant.findMany({ where: { id: { in: ids } } })
    : []
  const byId = new Map(restaurants.map((r) => [r.id, r]))

  const history = sessions.flatMap((s) => {
    const r = byId.get(s.selectedResultId as string)
    if (!r) return [] // selected restaurant was deleted — skip
    return [
      {
        id: s.id,
        restaurantId: r.id,
        restaurantName: r.name,
        cuisine: r.cuisineType,
        // Deprecated coarse enum, kept for older app builds; `areaName` is the
        // real neighbourhood and what the app should render.
        area: r.area,
        areaName: r.areaName,
        priceRange: `AED ${r.priceMin}–${r.priceMax}`,
        actionTaken: s.actionTaken,
        createdAt: s.createdAt,
        // Extras so the mobile RestaurantDetailSheet can render on tap:
        tags: r.tags,
        // ratingScore stays for ranking/back-compat; googleRating (0–5) is
        // what the app actually displays.
        ratingScore: r.ratingScore,
        googleRating: r.googleRating,
        calories: r.averageCalories,
        // The two-sentence vibe line, for the detail sheet a history row opens.
        description: r.description,
        photoUrls: r.photoRefs.map(photoProxyPath),
      },
    ]
  })

  res.json(history)
})

const selectSchema = z.object({
  selectedResultId: z.string().min(1),
  actionTaken: z.enum(['DIRECTIONS', 'CALL', 'ORDER', 'SELECT']),
})

// PATCH /api/decisions/:sessionId/select
router.patch('/:sessionId/select', async (req, res) => {
  const parsed = selectSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }

  try {
    const session = await prisma.decisionSession.update({
      where: { id: req.params.sessionId },
      data: {
        selectedResultId: parsed.data.selectedResultId,
        actionTaken: parsed.data.actionTaken,
      },
    })

    // --- DecisionEngine v2: SELECT is the strongest taste signal ------
    // Only an actual SELECT counts. DIRECTIONS/CALL/ORDER are intents that
    // frequently go nowhere, and learning from them would overweight
    // restaurants the user merely considered.
    //
    // The learner is the session's OWN userId, not the request's. This endpoint
    // takes no auth (the mobile client fires it in the background, often without
    // a token) and the session already records who it belongs to. An
    // anonymously-created session has no one to learn for, which is correct —
    // attributing it to whoever happens to be holding a token would be wrong.
    const learnerId = session.userId
    if (learnerId && parsed.data.actionTaken === 'SELECT') {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: parsed.data.selectedResultId },
        select: { cuisineType: true },
      })
      if (restaurant) {
        await applyTasteEvent(learnerId, restaurant.cuisineType, 'SELECT').catch((err) =>
          console.error('[tasteProfile] select update failed:', err),
        )
      }
    }

    res.json({ session })
  } catch {
    res.status(404).json({ error: 'Decision session not found' })
  }
})

export default router
