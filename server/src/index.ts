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

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Security headers
app.use(helmet())

// CORS — allow the Vite dev client and the production Vercel URL
const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL || 'http://localhost:5173',
]
app.use(
  cors({
    origin: allowedOrigins,
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
app.use('/api/users', usersRouter)
app.use('/api/admin', adminRouter)

app.get('/', (_req, res) => {
  res.json({ name: 'Jou3an API', status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`🚀 Jou3an server listening on http://localhost:${PORT}`)
})

export default app
