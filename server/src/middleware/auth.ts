import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'changeme'

/** Sign a 7-day access token for a user id. */
export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

/**
 * Requires a valid `Authorization: Bearer <token>`.
 * On success attaches the full user to `req.user` and the id to `req.userId`.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readBearer(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      res.status(401).json({ error: 'User no longer exists' })
      return
    }
    req.user = user
    req.userId = user.id
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Requires the authenticated user to be the configured admin.
 * Must run after `requireAuth` (relies on `req.user`).
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const adminEmail = process.env.ADMIN_EMAIL
  const email = req.user?.email
  if (!adminEmail || !email || email.toLowerCase() !== adminEmail.toLowerCase()) {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}

/**
 * Attaches the user to the request if a valid token is present, but never
 * rejects — used for endpoints that work anonymously (e.g. the decision flow).
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readBearer(req)
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
      const user = await prisma.user.findUnique({ where: { id: payload.userId } })
      if (user) {
        req.user = user
        req.userId = user.id
      }
    } catch {
      /* ignore — treat as anonymous */
    }
  }
  next()
}
