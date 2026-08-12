import { Router } from 'express'
import type { RequestHandler } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { User } from '@prisma/client'
import prisma from '../lib/prisma'
import passport, { googleEnabled } from '../lib/passport'
import { signToken, requireAuth } from '../middleware/auth'

const router = Router()

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

/** Strip the password hash before sending a user to the client. */
function sanitize(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user
  return safe
}

/* ------------------------------------------------------------------ */
/* Signup                                                              */
/* ------------------------------------------------------------------ */

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }
  const { name, email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      cuisinePreferences: [],
      dietary: [],
    },
  })

  const token = signToken(user.id)
  res.status(201).json({ token, user: sanitize(user) })
})

/* ------------------------------------------------------------------ */
/* Login (passport-local)                                              */
/* ------------------------------------------------------------------ */

router.post('/login', (req, res, next) => {
  passport.authenticate(
    'local',
    { session: false },
    (err: unknown, user: User | false, info?: { message?: string }) => {
      if (err) return next(err)
      if (!user) {
        res.status(401).json({ error: info?.message || 'Invalid credentials' })
        return
      }
      const token = signToken(user.id)
      res.json({ token, user: sanitize(user) })
    },
  )(req, res, next)
})

/* ------------------------------------------------------------------ */
/* Google OAuth                                                        */
/* ------------------------------------------------------------------ */

const googleStart: RequestHandler = googleEnabled
  ? passport.authenticate('google', { scope: ['profile', 'email'], session: false })
  : (_req, res) => {
      res.redirect(`${CLIENT_URL}/login?error=google_not_configured`)
    }

router.get('/google', googleStart)

if (googleEnabled) {
  router.get(
    '/google/callback',
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${CLIENT_URL}/login?error=google_failed`,
    }),
    (req, res) => {
      const user = req.user as User
      const token = signToken(user.id)
      const isNewUser =
        !user.cuisinePreferences || user.cuisinePreferences.length === 0
      const path = isNewUser ? '/onboarding' : '/'
      res.redirect(`${CLIENT_URL}${path}?token=${token}`)
    },
  )
} else {
  router.get('/google/callback', (_req, res) => {
    res.redirect(`${CLIENT_URL}/login?error=google_not_configured`)
  })
}

/* ------------------------------------------------------------------ */
/* Logout                                                              */
/* ------------------------------------------------------------------ */

router.post('/logout', (req, res) => {
  // JWTs are stateless (the client discards its token); also clear any
  // passport session that may exist from the OAuth flow.
  if (req.session) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid')
      res.status(200).json({ ok: true })
    })
  } else {
    res.status(200).json({ ok: true })
  }
})

/* ------------------------------------------------------------------ */
/* Current user                                                        */
/* ------------------------------------------------------------------ */

router.get('/me', requireAuth, (req, res) => {
  res.json(sanitize(req.user as User))
})

export default router
