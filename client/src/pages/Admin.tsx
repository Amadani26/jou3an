import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ChevronDown, Plus, X, Check, Lock } from 'lucide-react'
import {
  adminCreateRestaurant,
  adminGetRestaurants,
  adminSetDaily,
  adminUpdateRestaurant,
  getDailyToday,
  LOCATION_AREAS,
  prettyArea,
  type LocationArea,
  type Restaurant,
  type RestaurantInput,
} from '../lib/api'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined
const UNLOCK_KEY = 'jou3an_admin_ok'

/* ================================================================== */
/* Searchable restaurant select                                        */
/* ================================================================== */

function SearchSelect({
  restaurants,
  value,
  onChange,
  placeholder,
}: {
  restaurants: Restaurant[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const selected = restaurants.find((r) => r.id === value)
  const filtered = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.cuisineType.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field flex items-center justify-between text-left"
      >
        <span className={selected ? 'text-text-primary' : 'text-text-muted'}>
          {selected ? selected.name : placeholder ?? 'Select restaurant'}
        </span>
        <ChevronDown size={16} className="text-text-secondary shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 w-full rounded-2xl bg-bg-3 border border-border max-h-64 overflow-auto shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]">
            <div className="p-2 sticky top-0 bg-bg-3 border-b border-border-soft">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="field !py-2"
              />
            </div>
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onChange(r.id)
                  setOpen(false)
                  setQ('')
                }}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors hover:bg-bg-4"
              >
                <span className="text-text-primary truncate">{r.name}</span>
                <span className="text-text-muted text-xs shrink-0">
                  {r.cuisineType} · {prettyArea(r.area)}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-text-muted">No matches</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ================================================================== */
/* Add-restaurant modal                                                */
/* ================================================================== */

const EMPTY_FORM = {
  name: '',
  cuisineType: '',
  area: 'JLT' as LocationArea,
  priceMin: '40',
  priceMax: '90',
  ratingScore: '4.2',
  averageCalories: '',
  phone: '',
  googleMapsUrl: '',
  talabatUrl: '',
  noonUrl: '',
  deliverooUrl: '',
  tags: '',
  isActive: true,
  isFeatured: false,
}

function RestaurantModal({
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  onClose: () => void
  onSubmit: (body: RestaurantInput) => void
  submitting: boolean
  error: string | null
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: form.name.trim(),
      cuisineType: form.cuisineType.trim(),
      area: form.area,
      priceMin: Number(form.priceMin),
      priceMax: Number(form.priceMax),
      ratingScore: form.ratingScore ? Number(form.ratingScore) : undefined,
      averageCalories: form.averageCalories
        ? Number(form.averageCalories)
        : null,
      phone: form.phone.trim() || null,
      googleMapsUrl: form.googleMapsUrl.trim() || null,
      talabatUrl: form.talabatUrl.trim() || null,
      noonUrl: form.noonUrl.trim() || null,
      deliverooUrl: form.deliverooUrl.trim() || null,
      tags: form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      isActive: form.isActive,
      isFeatured: form.isFeatured,
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-start justify-center overflow-auto bg-black/60 md:p-4 md:py-10">
      <div
        className="w-full max-w-[560px] bg-bg-2 border border-border rounded-t-[28px] md:rounded-[24px] max-h-[90vh] overflow-y-auto sheet-up md:animate-none p-6"
        style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
      >
        {/* mobile drag handle */}
        <div className="md:hidden flex justify-center -mt-2 mb-3">
          <span className="w-10 h-1 rounded-full bg-bg-4" />
        </div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg text-text-primary">
            Add Restaurant
          </h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs text-text-secondary">
            Name
            <input
              className="field mt-1"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </label>
          <label className="text-xs text-text-secondary">
            Cuisine
            <input
              className="field mt-1"
              value={form.cuisineType}
              onChange={(e) => set('cuisineType', e.target.value)}
              required
            />
          </label>
          <label className="text-xs text-text-secondary">
            Area
            <select
              className="field mt-1"
              value={form.area}
              onChange={(e) => set('area', e.target.value)}
            >
              {LOCATION_AREAS.map((a) => (
                <option key={a} value={a}>
                  {prettyArea(a)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-text-secondary">
            Price min (AED)
            <input
              type="number"
              className="field mt-1"
              value={form.priceMin}
              onChange={(e) => set('priceMin', e.target.value)}
              required
            />
          </label>
          <label className="text-xs text-text-secondary">
            Price max (AED)
            <input
              type="number"
              className="field mt-1"
              value={form.priceMax}
              onChange={(e) => set('priceMax', e.target.value)}
              required
            />
          </label>
          <label className="text-xs text-text-secondary">
            Rating (0–5)
            <input
              type="number"
              step="0.1"
              className="field mt-1"
              value={form.ratingScore}
              onChange={(e) => set('ratingScore', e.target.value)}
            />
          </label>
          <label className="text-xs text-text-secondary">
            Avg calories
            <input
              type="number"
              className="field mt-1"
              value={form.averageCalories}
              onChange={(e) => set('averageCalories', e.target.value)}
            />
          </label>
          <label className="col-span-2 text-xs text-text-secondary">
            Tags (comma-separated)
            <input
              className="field mt-1"
              placeholder="halal, quick, high-protein"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
            />
          </label>
          <label className="text-xs text-text-secondary">
            Phone
            <input
              className="field mt-1"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </label>
          <label className="text-xs text-text-secondary">
            Google Maps URL
            <input
              className="field mt-1"
              value={form.googleMapsUrl}
              onChange={(e) => set('googleMapsUrl', e.target.value)}
            />
          </label>
          <label className="text-xs text-text-secondary">
            Talabat URL
            <input
              className="field mt-1"
              value={form.talabatUrl}
              onChange={(e) => set('talabatUrl', e.target.value)}
            />
          </label>
          <label className="text-xs text-text-secondary">
            Deliveroo URL
            <input
              className="field mt-1"
              value={form.deliverooUrl}
              onChange={(e) => set('deliverooUrl', e.target.value)}
            />
          </label>

          <div className="col-span-2 flex items-center gap-6 mt-1">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => set('isFeatured', e.target.checked)}
              />
              Featured
            </label>
          </div>

          {error && (
            <p className="col-span-2 text-sm text-red">{error}</p>
          )}

          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Create Restaurant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Admin panel                                                         */
/* ================================================================== */

function AdminPanel() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'daily' | 'restaurants'>('daily')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)

  const restaurantsQuery = useQuery({
    queryKey: ['admin', 'restaurants', page],
    queryFn: () => adminGetRestaurants(page),
  })
  const dailyQuery = useQuery({
    queryKey: ['daily', 'today'],
    queryFn: getDailyToday,
    retry: false,
  })

  const restaurants = restaurantsQuery.data?.restaurants ?? []
  const forbidden =
    (restaurantsQuery.error as { response?: { status?: number } } | null)
      ?.response?.status === 403

  // Daily form state
  const [themeLabel, setThemeLabel] = useState('')
  const [r1, setR1] = useState('')
  const [r2, setR2] = useState('')
  const [r3, setR3] = useState('')
  const [dailyMsg, setDailyMsg] = useState<string | null>(null)

  useEffect(() => {
    if (dailyQuery.data) {
      setThemeLabel(dailyQuery.data.themeLabel)
      setR1(dailyQuery.data.results[0]?.id ?? '')
      setR2(dailyQuery.data.results[1]?.id ?? '')
      setR3(dailyQuery.data.results[2]?.id ?? '')
    }
  }, [dailyQuery.data])

  const toggleActive = useMutation({
    mutationFn: (r: Restaurant) =>
      adminUpdateRestaurant(r.id, { isActive: !r.isActive }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin', 'restaurants'] }),
  })

  const createRestaurant = useMutation({
    mutationFn: (body: RestaurantInput) => adminCreateRestaurant(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'restaurants'] })
      setModalOpen(false)
    },
  })

  const setDaily = useMutation({
    mutationFn: () =>
      adminSetDaily({
        themeLabel,
        result1Id: r1,
        result2Id: r2,
        result3Id: r3,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily', 'today'] })
      setDailyMsg('Saved — today’s Top 3 is live.')
    },
    onError: () => setDailyMsg('Could not save. Check the fields and try again.'),
  })

  return (
    <div className="max-w-[960px] mx-auto px-5 md:px-8 pt-12 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-extrabold text-3xl text-text-primary">
          Admin
        </h1>
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-bg-2 border border-border">
          {(['daily', 'restaurants'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors',
                tab === t
                  ? 'bg-bg-4 text-text-primary'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {t === 'daily' ? 'Daily Picks' : 'Restaurants'}
            </button>
          ))}
        </div>
      </div>

      {forbidden && (
        <div className="mb-6 rounded-2xl border border-[rgba(232,39,42,0.35)] bg-[rgba(232,39,42,0.06)] p-4 text-sm text-red">
          The API rejected your account (403). Make sure you’re logged in with
          the email set as <code>ADMIN_EMAIL</code> on the server.
        </div>
      )}

      {/* -------- Daily Picks tab -------- */}
      {tab === 'daily' && (
        <div className="space-y-6">
          <div className="card !rounded-[24px] p-6">
            <h2 className="font-display font-bold text-lg text-text-primary mb-4">
              Set Today’s Top 3
            </h2>
            <div className="space-y-3">
              <label className="block text-xs text-text-secondary">
                Theme label
                <input
                  className="field mt-1"
                  value={themeLabel}
                  onChange={(e) => setThemeLabel(e.target.value)}
                  placeholder="What Dubai Is Eating Right Now"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-text-secondary mb-1">Pick #1</div>
                  <SearchSelect
                    restaurants={restaurants}
                    value={r1}
                    onChange={setR1}
                  />
                </div>
                <div>
                  <div className="text-xs text-text-secondary mb-1">Pick #2</div>
                  <SearchSelect
                    restaurants={restaurants}
                    value={r2}
                    onChange={setR2}
                  />
                </div>
                <div>
                  <div className="text-xs text-text-secondary mb-1">Pick #3</div>
                  <SearchSelect
                    restaurants={restaurants}
                    value={r3}
                    onChange={setR3}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => {
                    setDailyMsg(null)
                    setDaily.mutate()
                  }}
                  disabled={setDaily.isPending || !themeLabel || !r1 || !r2 || !r3}
                  className="btn-primary disabled:opacity-60"
                >
                  {setDaily.isPending ? 'Saving…' : "Set Today's Top 3"}
                </button>
                {dailyMsg && (
                  <span className="text-sm text-text-secondary">{dailyMsg}</span>
                )}
              </div>
            </div>
          </div>

          {/* Current active pick */}
          <div className="card !rounded-[24px] p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-3">
              Current Active Pick
            </div>
            {dailyQuery.data ? (
              <div>
                <div className="font-display font-bold text-text-primary mb-2">
                  {dailyQuery.data.themeLabel}
                </div>
                <ol className="space-y-1">
                  {dailyQuery.data.results.map((r, i) => (
                    <li key={r.id} className="text-sm text-text-secondary">
                      <span className="text-red font-semibold mr-2">{i + 1}.</span>
                      {r.name} · {r.cuisineType} · {prettyArea(r.area)}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="text-sm text-text-muted">No active pick yet.</div>
            )}
          </div>
        </div>
      )}

      {/* -------- Restaurants tab -------- */}
      {tab === 'restaurants' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-text-secondary">
              {restaurantsQuery.data?.total ?? 0} restaurants
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="btn-primary !py-2"
            >
              <Plus size={16} />
              Add Restaurant
            </button>
          </div>

          <div className="card !rounded-[24px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted border-b border-border-soft">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Cuisine</th>
                    <th className="px-4 py-3 font-medium">Area</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                    <th className="px-4 py-3 font-medium text-right">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border-soft last:border-0"
                    >
                      <td className="px-4 py-3 text-text-primary">{r.name}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.cuisineType}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {prettyArea(r.area)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        AED {r.priceMin}–{r.priceMax}
                      </td>
                      <td className="px-4 py-3 text-gold">
                        {r.ratingScore.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleActive.mutate(r)}
                          className={clsx(
                            'inline-flex items-center h-6 w-11 rounded-full transition-colors relative',
                            r.isActive ? 'bg-green' : 'bg-bg-4',
                          )}
                          aria-label="Toggle active"
                        >
                          <span
                            className={clsx(
                              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                              r.isActive ? 'left-[22px]' : 'left-0.5',
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {restaurants.length === 0 && !restaurantsQuery.isLoading && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-text-muted"
                      >
                        {forbidden ? 'Access denied.' : 'No restaurants.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {restaurantsQuery.data && restaurantsQuery.data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-ghost disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-sm text-text-secondary">
                Page {restaurantsQuery.data.page} of{' '}
                {restaurantsQuery.data.totalPages}
              </span>
              <button
                onClick={() =>
                  setPage((p) =>
                    Math.min(restaurantsQuery.data!.totalPages, p + 1),
                  )
                }
                disabled={page >= restaurantsQuery.data.totalPages}
                className="btn-ghost disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <RestaurantModal
          onClose={() => setModalOpen(false)}
          onSubmit={(body) => createRestaurant.mutate(body)}
          submitting={createRestaurant.isPending}
          error={
            createRestaurant.error
              ? 'Could not create restaurant. Check the fields.'
              : null
          }
        />
      )}
    </div>
  )
}

/* ================================================================== */
/* Password gate                                                       */
/* ================================================================== */

export default function Admin() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(UNLOCK_KEY) === '1',
  )
  const [pw, setPw] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (ADMIN_PASSWORD && pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(UNLOCK_KEY, '1')
      setUnlocked(true)
    } else {
      setError('Incorrect admin password.')
    }
  }

  if (unlocked) return <AdminPanel />

  return (
    <div className="min-h-[calc(100vh-62px)] flex items-center justify-center px-5 py-16">
      <div className="card w-full max-w-[380px] p-8 fade-up">
        <div className="w-11 h-11 rounded-2xl bg-[rgba(232,39,42,0.1)] flex items-center justify-center mb-4">
          <Lock size={18} className="text-red" />
        </div>
        <h1 className="font-display font-extrabold text-2xl text-text-primary">
          Admin access
        </h1>
        <p className="text-sm text-text-secondary mt-1 mb-6">
          Enter the admin password to continue.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            className="field"
            type="password"
            placeholder="Admin password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            required
          />
          <button type="submit" className="btn-primary w-full">
            <Check size={16} />
            Unlock
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red text-center">{error}</p>}
      </div>
    </div>
  )
}
