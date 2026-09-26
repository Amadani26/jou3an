import { Router } from 'express'
import prisma from '../lib/prisma'
import { withPhotoUrlsAll } from '../lib/photos'
import { SERVEABLE_WHERE } from '../lib/venueType'

const router = Router()

/**
 * GET /api/daily/today
 *
 * The Daily Top 3 is a decision surface, so all three results must be servable
 * (active, venueType RESTAURANT). A pick is matched WHOLE or not at all — the
 * product rule is exactly 3, so serving two of a stale pick's three is not an
 * option. If today's pick has since had a row pruned or reclassified, the
 * fallback finds the most recent pick that is still fully servable.
 */
router.get('/today', async (_req, res) => {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const include = { result1: true, result2: true, result3: true } as const
  const allServeable = {
    result1: { is: SERVEABLE_WHERE },
    result2: { is: SERVEABLE_WHERE },
    result3: { is: SERVEABLE_WHERE },
  } as const

  let pick = await prisma.dailyPick.findFirst({
    where: { date: today, isLive: true, ...allServeable },
    include,
  })

  // Fallback to the most recent live pick that is still fully servable.
  if (!pick) {
    pick = await prisma.dailyPick.findFirst({
      where: { isLive: true, ...allServeable },
      orderBy: { date: 'desc' },
      include,
    })
  }

  if (!pick) {
    res.status(404).json({ error: 'No daily pick available' })
    return
  }

  res.json({
    id: pick.id,
    date: pick.date,
    themeLabel: pick.themeLabel,
    isLive: pick.isLive,
    results: withPhotoUrlsAll([pick.result1, pick.result2, pick.result3]),
  })
})

export default router
