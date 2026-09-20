/**
 * DecisionEngine v2 — persistence side-car.
 *
 * Deliberately separate from `decide()`, which is pure. Everything that touches
 * Postgres lives here: writing the audit row, and reading the two pieces of
 * user history the engine needs injected (recent selections + pick rates).
 */
import type { Prisma } from '@prisma/client'
import prisma from '../../lib/prisma'
import type { Decision3, EngineInput, RecentSelection } from './types'
import { DAMPING_DAYS } from './select'

/**
 * Fire-and-forget audit write.
 *
 * Never throws: a telemetry failure must not cost the user their decision. The
 * caller can await it, but nothing downstream should depend on it succeeding.
 */
export async function logDecision(
  input: EngineInput,
  decision: Decision3,
  sessionId?: string | null,
): Promise<void> {
  try {
    await prisma.decisionLog.create({
      data: {
        userId: input.userId ?? null,
        sessionId: sessionId ?? null,
        inputSummary: {
          formatFilter: input.context.formatFilter,
          vibe: input.context.vibe,
          budget: input.context.budget,
          lat: input.context.lat ?? null,
          lng: input.context.lng ?? null,
          dateISO: input.context.date.toISOString(),
          refreshNonce: String(input.context.refreshNonce ?? ''),
          seed: decision.seed,
          candidateCount: input.candidates.length,
          scoredCount: decision.breakdown.length,
          relaxed: decision.relaxed,
          wildcardUsed: decision.wildcardUsed,
        } as Prisma.InputJsonValue,
        breakdown: decision.breakdown as unknown as Prisma.InputJsonValue,
        chosenIds: decision.picks.map((p) => p.restaurant.id),
        radiusTier: decision.radiusTier,
      },
    })
  } catch (err) {
    console.error('[DecisionEngine] failed to write DecisionLog:', err)
  }
}

/**
 * The user's selections inside the damping window.
 *
 * Only SELECT counts as "I went here" — DIRECTIONS/CALL/ORDER are intents that
 * often go nowhere, and damping on them would punish restaurants the user
 * merely considered.
 */
export async function getRecentSelections(
  userId: string | null | undefined,
  now: Date = new Date(),
): Promise<RecentSelection[]> {
  if (!userId) return []

  const since = new Date(now.getTime() - DAMPING_DAYS * 24 * 60 * 60 * 1000)

  const sessions = await prisma.decisionSession.findMany({
    where: {
      userId,
      selectedResultId: { not: null },
      actionTaken: 'SELECT',
      createdAt: { gte: since },
    },
    select: { selectedResultId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return sessions.map((s) => ({
    restaurantId: s.selectedResultId as string,
    selectedAt: s.createdAt,
  }))
}

/**
 * Historical pick rate per restaurant, over the user's WHOLE history — the
 * denominator has to be lifetime, not the damping window, or a single pick in a
 * quiet week would read as a 100% favourite and exempt itself from damping.
 */
export async function getPickRates(
  userId: string | null | undefined,
): Promise<Record<string, number>> {
  if (!userId) return {}

  const sessions = await prisma.decisionSession.findMany({
    where: { userId, selectedResultId: { not: null }, actionTaken: 'SELECT' },
    select: { selectedResultId: true },
  })

  if (!sessions.length) return {}

  const counts = new Map<string, number>()
  for (const s of sessions) {
    const id = s.selectedResultId as string
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  const total = sessions.length
  const rates: Record<string, number> = {}
  for (const [id, n] of counts) rates[id] = n / total
  return rates
}
