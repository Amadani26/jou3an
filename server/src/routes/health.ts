import { Router } from 'express'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'jou3an-server' })
})

export default router
