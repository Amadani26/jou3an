import { useCallback, useEffect, useState } from 'react'
import { ScrollView, View, Text, Pressable, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import ProcessingState from '../components/ProcessingState'
import ResultCard from '../components/ResultCard'
import GhostButton from '../components/GhostButton'
import SelectionReward from '../components/SelectionReward'
import RestaurantDetailSheet from '../components/RestaurantDetailSheet'
import {
  getDecision,
  tinderSuggest,
  saveDecisionSelection,
  displayArea,
  deliveryUrl,
  photoUrls,
  type Restaurant,
} from '../lib/api'

export default function ResultsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    prompt?: string
    chips?: string
    mode?: string
    likedIds?: string
    title?: string
    lat?: string
    lng?: string
    // Structured filters from the Decide flow — what engine v2 ranks off.
    cuisines?: string
    format?: string
    vibe?: string
    areaName?: string
  }>()

  // Present only when the Decide flow captured a "Nearby" position.
  const lat = Number(params.lat)
  const lng = Number(params.lng)
  const coords =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null

  const prompt = params.prompt ?? ''
  let chips: string[] = []
  try {
    chips = params.chips ? (JSON.parse(params.chips) as string[]) : []
  } catch {
    chips = []
  }

  // "Food Tinder" origin: fetch via tinderSuggest(likedIds) instead of a prompt query.
  const isTinder = params.mode === 'tinder'
  let likedIds: string[] = []
  try {
    likedIds = params.likedIds ? (JSON.parse(params.likedIds) as string[]) : []
  } catch {
    likedIds = []
  }

  // Structured filters. Router params are strings, so the array arrives
  // JSON-encoded; anything malformed degrades to "no cuisine preference"
  // rather than breaking the screen.
  let cuisines: string[] = []
  try {
    cuisines = params.cuisines ? (JSON.parse(params.cuisines) as string[]) : []
  } catch {
    cuisines = []
  }
  const format =
    params.format === 'Delivery' || params.format === 'Dine In' ? params.format : undefined
  const vibe =
    params.vibe === 'Casual' || params.vibe === 'Fancy' ? params.vibe : undefined

  const effectivePrompt = prompt || chips.join(' ') || 'surprise me'
  const displayQuery =
    params.title || prompt || chips.join(', ') || 'Your pick'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [results, setResults] = useState<Restaurant[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  /**
   * The decision, once made. Set the instant a card is tapped — the selection
   * is already on its way to the server by then, so this is a record of what
   * happened, not a pending intent.
   */
  const [chosen, setChosen] = useState<Restaurant | null>(null)
  /** The reward: a FULL-SCREEN celebration of the pick, with the actions on it. */
  const [rewardVisible, setRewardVisible] = useState(false)
  // Long-press opens the read-only preview sheet (view, never select).
  const [preview, setPreview] = useState<Restaurant | null>(null)
  /**
   * 0 on first load, so opening the same brief twice in one day returns the
   * same 3. Each Refresh increments it, which changes the engine's seed and
   * forces a genuine re-roll rather than a re-render of the same answer.
   */
  const [refreshNonce, setRefreshNonce] = useState(0)

  /**
   * PATCHes the session, retrying ONCE after a short pause.
   *
   * Never awaited by the UI and never throws: this screen is the source of
   * truth for History, so a single dropped request is worth one quiet retry —
   * but a hungry user must not wait on the network to see their decision
   * land. Two attempts is the honest ceiling; a queue for a genuinely offline
   * device would be a different feature.
   */
  const record = useCallback(
    (id: string, action: 'SELECT' | 'DIRECTIONS' | 'CALL' | 'ORDER'): Promise<void> => {
      if (!sessionId) return Promise.resolve()
      const attempt = () => saveDecisionSelection(sessionId, id, action)
      return attempt().catch(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              attempt()
                .catch(() => {
                  /* gave it two honest tries — stay silent, never crash a decision */
                })
                .then(resolve, resolve)
            }, 900)
          }),
      )
    },
    [sessionId],
  )

  /**
   * THE DECISION. Tapping a card IS the selection — no second confirm tap.
   *
   * Order matters: the SELECT goes out FIRST (fire-and-forget, retry-once), so
   * a user who kills the app mid-celebration is still recorded as having
   * chosen. The full-screen reward then plays the celebration itself as its
   * entrance, which is why there is no separate interstitial to time out.
   */
  const select = (r: Restaurant) => {
    // Guard against a double-tap selecting twice, or re-selecting after the
    // decision is made — one session, one decision.
    if (chosen) return
    setChosen(r)
    void record(r.id, 'SELECT')
    setRewardVisible(true)
  }

  /** Dismissing the reward ends the flow — the decision is final. */
  const closeReward = () => {
    setRewardVisible(false)
    router.replace('/(tabs)')
  }

  const run = useCallback(async (nonce: number) => {
    setLoading(true)
    setError(false)
    setChosen(null)
    setRewardVisible(false)
    const started = Date.now()
    try {
      const res = isTinder
        ? await tinderSuggest(likedIds)
        : await getDecision(effectivePrompt, chips, coords, {
            cuisines,
            format,
            vibe,
            areaName: params.areaName,
            refreshNonce: nonce,
          })
      const elapsed = Date.now() - started
      if (elapsed < 1200) {
        await new Promise((r) => setTimeout(r, 1200 - elapsed))
      }
      setResults(res.results)
      setSessionId(res.sessionId)
    } catch {
      const elapsed = Date.now() - started
      if (elapsed < 1200) {
        await new Promise((r) => setTimeout(r, 1200 - elapsed))
      }
      setError(true)
      setResults([])
      setSessionId(null)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePrompt])

  useEffect(() => {
    run(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Refresh: bump the nonce so the engine re-rolls, then re-run with it. */
  const refresh = useCallback(() => {
    setRefreshNonce((n) => {
      const next = n + 1
      run(next)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run])

  /**
   * An action tap always implies the decision, wherever it comes from.
   *
   * From the reward screen the SELECT is already saved, so this only upgrades
   * `actionTaken` (SELECT -> DIRECTIONS) — leaving for Maps and coming back
   * changes nothing, which is the whole point of the new flow. From a
   * long-press preview nothing has been recorded yet: the SELECT is sent FIRST
   * so an action can never exist in History without the choice it implies, and
   * so the taste profile still learns (the server only trains on SELECT).
   */
  const recordAction = (r: Restaurant, action: 'DIRECTIONS' | 'CALL' | 'ORDER') => {
    if (chosen?.id === r.id) {
      void record(r.id, action)
      return
    }
    // Sequential, not parallel: both writes hit the same session row, and a
    // SELECT landing last would erase the action label.
    void record(r.id, 'SELECT').then(() => record(r.id, action))
  }

  const openDirections = (r: Restaurant) => {
    recordAction(r, 'DIRECTIONS')
    Linking.openURL(
      `https://maps.google.com/?q=${encodeURIComponent(
        `${r.name} ${displayArea(r)} Dubai`,
      )}`,
    )
  }
  const call = (r: Restaurant) => {
    recordAction(r, 'CALL')
    if (r.phone) Linking.openURL(`tel:${r.phone}`)
    else
      Linking.openURL(
        `https://maps.google.com/?q=${encodeURIComponent(
          `${r.name} ${displayArea(r)} Dubai`,
        )}`,
      )
  }
  const order = (r: Restaurant) => {
    recordAction(r, 'ORDER')
    const url = deliveryUrl(r)
    if (url) Linking.openURL(url)
    else
      Linking.openURL(
        `https://maps.google.com/?q=${encodeURIComponent(
          `${r.name} ${displayArea(r)} Dubai`,
        )}`,
      )
  }

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: '#080808' }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 14,
          paddingBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{ minHeight: 40, minWidth: 40, justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={20} color="#504B47" />
          </Pressable>
          <Text
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 2,
              color: '#504B47',
            }}
          >
            DECIDED FOR YOU
          </Text>
        </View>

        <Text
          style={{
            fontFamily: 'DMSans_800ExtraBold',
            fontSize: 22,
            color: '#F2EDE8',
            letterSpacing: -1,
            marginTop: 6,
          }}
          numberOfLines={1}
        >
          {displayQuery}
        </Text>

        {chips.length > 0 ? (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}
          >
            {chips.map((c) => (
              <View
                key={c}
                style={{
                  backgroundColor: '#141414',
                  borderWidth: 1,
                  borderColor: '#242424',
                  borderRadius: 100,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#8A847E' }}
                >
                  {c}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={{ paddingVertical: 80 }}>
          <ProcessingState />
        </View>
      ) : error ? (
        <View style={{ paddingHorizontal: 20, paddingVertical: 40, alignItems: 'center', gap: 12 }}>
          <Ionicons name="cloud-offline-outline" size={40} color="#242424" />
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#504B47' }}>
            Couldn&apos;t reach the kitchen. Try again.
          </Text>
          {/* Retry re-runs the SAME roll — a failed request should return the
              brief the user asked for, not silently re-roll it. */}
          <GhostButton label="Retry" onPress={() => run(refreshNonce)} />
        </View>
      ) : (
        <>
          {results.map((r, i) => (
            <Animated.View
              key={r.id}
              entering={FadeInDown.delay(i * 150).duration(400)}
            >
              <ResultCard
                rank={i + 1}
                name={r.name}
                cuisine={r.cuisineType}
                priceRange={`AED ${r.priceMin}–${r.priceMax}`}
                area={displayArea(r)}
                distanceKm={r.distanceKm}
                reason={r.reason}
                imageUrl={photoUrls(r)[0]}
                onSelect={() => select(r)}
                onLongPress={() => setPreview(r)}
              />
            </Animated.View>
          ))}

          {/* Interaction hint (shown before a selection is made) */}
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 12,
              color: '#444',
              textAlign: 'center',
              marginTop: 4,
            }}
          >
            Tap to select · Hold for details
          </Text>

          <View style={{ alignItems: 'center', marginTop: 10, gap: 8, paddingHorizontal: 20 }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#504B47' }}>
              Not what you&apos;re looking for?
            </Text>
            <GhostButton label="Refresh" onPress={refresh} />
          </View>
        </>
      )}
    </ScrollView>

    {/* THE REWARD — a FULL-SCREEN celebration of the pick, with the actions on
        it. Dismissing (X or swipe down) goes Home: the decision is final. */}
    <SelectionReward
      visible={rewardVisible}
      restaurant={chosen}
      onClose={closeReward}
      onDirections={() => chosen && openDirections(chosen)}
      onCall={() => chosen && call(chosen)}
      onOrder={() => chosen && order(chosen)}
    />

    {/* PREVIEW — long-press on a card: the HALF-SCREEN sheet. Sheet for
        looking, whole screen for choosing — that contrast is what tells the two
        apart, so this one never gets a celebration. Dismissing returns to the 3
        cards, and nothing is recorded unless an action is actually tapped. */}
    <RestaurantDetailSheet
      visible={preview != null}
      onClose={() => setPreview(null)}
      showClose
      name={preview?.name ?? ''}
      cuisine={preview?.cuisineType ?? ''}
      priceRange={preview ? `AED ${preview.priceMin}–${preview.priceMax}` : ''}
      area={preview ? displayArea(preview) : ''}
      tags={preview?.tags}
      googleRating={preview?.googleRating}
      distanceKm={preview?.distanceKm}
      calories={preview?.averageCalories}
      images={photoUrls(preview)}
      onDirections={() => preview && openDirections(preview)}
      onCall={() => preview && call(preview)}
      onOrder={() => preview && order(preview)}
    />
    </>
  )
}
