import { Router } from 'express'
import prisma from '../lib/prisma'
import { withPhotoUrlsAll } from '../lib/photos'

const router = Router()

// GET /api/daily/today
router.get('/today', async (_req, res) => {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const include = { result1: true, result2: true, result3: true } as const

  let pick = await prisma.dailyPick.findFirst({
    where: { date: today, isLive: true },
    include,
  })

  // Fallback to the most recent live pick
  if (!pick) {
    pick = await prisma.dailyPick.findFirst({
      where: { isLive: true },
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
