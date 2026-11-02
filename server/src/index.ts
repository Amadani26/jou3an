import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import session from 'express-session'
import passport from './lib/passport'
import healthRouter from './routes/health'
import authRouter from './routes/auth'
import adminRouter from './routes/admin'
import decisionsRouter from './routes/decisions'
import restaurantsRouter from './routes/restaurants'
import dailyRouter from './routes/daily'
import usersRouter from './routes/users'
import photosRouter from './routes/photos'
import placesRouter from './routes/places'
import publicRouter from './routes/public'

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Behind Railway's proxy: without this, req.ip is the proxy for everyone and
// the public routes' per-IP rate limits would throttle all visitors as one.
app.set('trust proxy', 1)

// Security headers
app.use(helmet())

// CORS — the Vite dev client, the production site(s), and this project's
// Vercel preview deployments.
//   CORS_ORIGINS: comma-separated exact origins, e.g.
//   "https://jou3an.me,https://www.jou3an.me"
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.CLIENT_URL || 'http://localhost:5173',
  ...(process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
]
/** jou3an-git-<branch>-aqari.vercel.app, jou3an-<hash>-aqari.vercel.app */
const VERCEL_PREVIEW_RE = /^https:\/\/jou3an-[a-z0-9-]+-aqari\.vercel\.app$/
app.use(
  cors({
    origin: (origin, cb) =>
      cb(
        null,
        !origin || allowedOrigins.includes(origin) || VERCEL_PREVIEW_RE.test(origin),
      ),
    credentials: true,
  }),
)

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'changeme',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
)

// Passport
app.use(passport.initialize())
app.use(passport.session())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/decisions', decisionsRouter)
app.use('/api/restaurants', restaurantsRouter)
app.use('/api/daily', dailyRouter)
app.use('/api/photos', photosRouter)
app.use('/api/places', placesRouter)
app.use('/api/public', publicRouter)
app.use('/api/users', usersRouter)
app.use('/api/admin', adminRouter)

app.get('/', (_req, res) => {
  res.json({ name: 'Jou3an API', status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`🚀 Jou3an server listening on http://localhost:${PORT}`)
})

export default app
