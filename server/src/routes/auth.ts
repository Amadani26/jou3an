import { Router } from 'express'
import type { RequestHandler } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
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
  phoneNumber: z.string().trim().min(1).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

/**
 * Machine-readable reasons a signup can be refused.
 *
 * ⚠️ The CODE is the contract, not the message. The app shows a different thing
 * for each — a duplicate email offers a link to Sign In, a validation failure
 * points at the field — and matching on prose would break the moment the
 * wording is edited. Every refusal below carries one.
 */
export const SIGNUP_ERRORS = {
  INVALID: 'INVALID_INPUT',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
} as const

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      code: SIGNUP_ERRORS.INVALID,
      // The first field message, so the client has something specific to show
      // without having to understand zod's shape.
      error: parsed.error.issues[0]?.message ?? 'Invalid request',
      details: parsed.error.flatten(),
    })
    return
  }
  const { name, email, phoneNumber, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    res.status(409).json({
      code: SIGNUP_ERRORS.EMAIL_TAKEN,
      error: 'An account with this email already exists',
    })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  let user: User
  try {
    user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phoneNumber: phoneNumber ?? null,
        passwordHash,
        cuisinePreferences: [],
        dietary: [],
      },
    })
  } catch (err) {
    // The check above loses a race between two signups with the same email —
    // the unique index is what actually decides it. Report the SAME code, so
    // the loser of the race sees "already registered" rather than a 500 that
    // tells them nothing and sends them back to try again.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      res.status(409).json({
        code: SIGNUP_ERRORS.EMAIL_TAKEN,
        error: 'An account with this email already exists',
      })
      return
    }
    throw err
  }

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
