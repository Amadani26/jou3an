/**
 * Opening-hours evaluation for DecisionEngine v2.
 *
 * Source of truth is Google's `regularOpeningHours.periods`, stored verbatim on
 * `Restaurant.openingHours` by `npm run sync:places`.
 *
 * Two things make this less trivial than it looks:
 *
 *  1. The `day`/`hour`/`minute` in a period are the PLACE's local wall clock,
 *     which for us is always Asia/Dubai. The server may be anywhere (Railway
 *     runs UTC), so "now" has to be converted to Dubai wall-clock time before
 *     it can be compared. We do that with Intl rather than hardcoding +04:00 —
 *     Dubai has no DST today, but deriving it is free and cannot rot.
 *
 *  2. Periods routinely run past midnight ("open Fri 22:00, close Sat 02:00")
 *     and the last period of the week can wrap around Saturday into Sunday.
 *     Both are handled by working in absolute minutes-since-Sunday-00:00 and
 *     letting a close that lands before its open roll forward a week.
 */

export const DUBAI_TZ = 'Asia/Dubai'

const MINUTES_PER_DAY = 24 * 60
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY

/** One end of a Google opening period. `day` is 0=Sunday..6=Saturday. */
export interface HoursPoint {
  day: number
  hour: number
  minute?: number
}

export interface HoursPeriod {
  open: HoursPoint
  /** Absent means "open 24/7" in Google's encoding. */
  close?: HoursPoint | null
}

/** Minutes since Sunday 00:00 for a wall-clock point. */
const toWeekMinutes = (day: number, hour: number, minute = 0) =>
  day * MINUTES_PER_DAY + hour * 60 + minute

/**
 * `date` (an absolute instant) expressed as Dubai wall-clock minutes since
 * Sunday 00:00.
 */
export function dubaiWeekMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DUBAI_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''

  const WEEKDAYS: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  const day = WEEKDAYS[get('weekday')] ?? 0
  // Intl can render midnight as "24" in some ICU versions under hour12:false.
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))

  return toWeekMinutes(day, hour, minute)
}

/** A period is valid only if its `open` carries usable numbers. */
function isUsable(p: unknown): p is HoursPeriod {
  if (!p || typeof p !== 'object') return false
  const open = (p as HoursPeriod).open
  return (
    !!open &&
    Number.isFinite(open.day) &&
    Number.isFinite(open.hour) &&
    open.day >= 0 &&
    open.day <= 6
  )
}

/**
 * Parses whatever is on `Restaurant.openingHours` into usable periods.
 *
 * Accepts both the bare `periods` array and the whole `regularOpeningHours`
 * object, because it is far too easy for a future sync to store one when the
 * reader expects the other. Returns null when hours are unknown — which callers
 * must treat as "don't know", NOT as "closed".
 */
export function parsePeriods(raw: unknown): HoursPeriod[] | null {
  if (!raw) return null

  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && Array.isArray((raw as { periods?: unknown }).periods)
      ? ((raw as { periods: unknown[] }).periods)
      : null

  if (!arr) return null

  const periods = arr.filter(isUsable)
  return periods.length ? periods : null
}

/**
 * Is the restaurant open at `date`?
 *
 * Returns `true` when hours are UNKNOWN. A missing-hours row is a gap in our
 * Places data, not evidence the place is shut, and silently filtering those out
 * would quietly shrink the candidate pool — which collides with the "always
 * exactly 3" product rule. Callers that need certainty should check
 * `hasKnownHours()` alongside this.
 */
export function isOpenNow(
  restaurant: { openingHours?: unknown },
  date: Date = new Date(),
): boolean {
  const periods = parsePeriods(restaurant.openingHours)
  if (!periods) return true

  const now = dubaiWeekMinutes(date)

  for (const period of periods) {
    // No close => open 24/7 (Google's encoding for always-open places).
    if (!period.close) return true

    const open = toWeekMinutes(period.open.day, period.open.hour, period.open.minute ?? 0)
    let close = toWeekMinutes(
      period.close.day,
      period.close.hour,
      period.close.minute ?? 0,
    )

    // A close at or before its open means the period runs past midnight and, if
    // it started late in the week, wraps around Sunday.
    if (close <= open) close += MINUTES_PER_WEEK

    // `now` is checked twice: once as-is, and once shifted a week forward so a
    // period that wrapped past Saturday still covers early-Sunday instants.
    if ((now >= open && now < close) || (now + MINUTES_PER_WEEK < close && now + MINUTES_PER_WEEK >= open)) {
      return true
    }
  }

  return false
}

/** True when we actually have hours for this row (vs. assuming open). */
export function hasKnownHours(restaurant: { openingHours?: unknown }): boolean {
  return parsePeriods(restaurant.openingHours) !== null
}
