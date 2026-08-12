import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import bcrypt from 'bcryptjs'
import type { User as PrismaUser } from '@prisma/client'
import prisma from './prisma'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Passport's req.user is our Prisma User
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends PrismaUser {}
  }
}

/* ------------------------------------------------------------------ */
/* Local strategy — email + password                                   */
/* ------------------------------------------------------------------ */

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        })
        if (!user || !user.passwordHash) {
          return done(null, false, { message: 'Invalid email or password' })
        }
        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) {
          return done(null, false, { message: 'Invalid email or password' })
        }
        return done(null, user)
      } catch (err) {
        return done(err as Error)
      }
    },
  ),
)

/* ------------------------------------------------------------------ */
/* Google OAuth 2.0 strategy (only if configured)                      */
/* ------------------------------------------------------------------ */

const googleClientID = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

export const googleEnabled = Boolean(
  googleClientID &&
    googleClientSecret &&
    !googleClientID.startsWith('your_') &&
    !googleClientSecret.startsWith('your_'),
)

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientID as string,
        clientSecret: googleClientSecret as string,
        callbackURL: '/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase()

          // 1) Already linked by googleId
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          })

          // 2) Existing email account — link the Google id to it
          if (!user && email) {
            const existing = await prisma.user.findUnique({ where: { email } })
            if (existing) {
              user = await prisma.user.update({
                where: { id: existing.id },
                data: { googleId: profile.id },
              })
            }
          }

          // 3) Brand new user
          if (!user) {
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email: email ?? `${profile.id}@google.jou3an`,
                name: profile.displayName ?? null,
                cuisinePreferences: [],
                dietary: [],
              },
            })
          }

          return done(null, user)
        } catch (err) {
          return done(err as Error)
        }
      },
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Session serialization (by id)                                       */
/* ------------------------------------------------------------------ */

passport.serializeUser((user, done) => {
  done(null, (user as PrismaUser).id)
})

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } })
    done(null, user ?? false)
  } catch (err) {
    done(err as Error)
  }
})

export default passport
