import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import ProcessingState from '../components/ProcessingState'
import ResultCard from '../components/ResultCard'
import GhostButton from '../components/GhostButton'
import SelectionReward from '../components/SelectionReward'
import RestaurantDetailSheet from '../components/RestaurantDetailSheet'
import { openCallFor, openDirectionsFor, openOrderFor } from '../lib/actions'
import { accumulateShown, dismissDetail, openDetail } from '../lib/resultsFlow'
import {
  callablePhone,
  getDecision,
  tinderSuggest,
  saveDecisionSelection,
  displayArea,
  photoUrls,
  type Restaurant,
  type Swipe,
} from '../lib/api'

export default function ResultsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    prompt?: string
    chips?: string
    mode?: string
    likedIds?: string
    /** The full swipe log (JSON) — right AND left, so passes train the profile. */
    swipes?: string
    title?: string
    lat?: string
    lng?: string
    // Structured filters from the Decide flow — what engine v2 ranks off.
    cuisines?: string
    format?: string
    vibe?: string
    areaName?: string
    /** The budget band in force when the brief was built; 'ANY' = no budget. */
    budget?: string
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
  // Right AND left, in order. Malformed degrades to "no log", which is exactly
  // how an older build behaved — the likes alone still pick the three.
  let swipes: Swipe[] = []
  try {
    swipes = params.swipes ? (JSON.parse(params.swipes) as Swipe[]) : []
  } catch {
    swipes = []
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
  /**
   * Sent as a per-query budget so the Decide flow's pill takes effect on THIS
   * decision. Anything unrecognised is dropped rather than guessed at, which
   * leaves the server reading the user's saved band — the old behaviour.
   */
  const budget = (['LOW', 'MID', 'HIGH', 'ANY'] as const).find(
    (b) => b === params.budget,
  )

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
   * Every restaurant this screen has shown for this brief.
   *
   * ⚠️ Scoped to the SCREEN, which is what resets it: a new brief pushes a new
   * results screen with an empty set, and leaving pops this one. There is
   * deliberately nothing to clear by hand — a set that outlived the brief it
   * belongs to would start excluding restaurants from a question nobody asked.
   *
   * Capped at the server's own ceiling, newest kept, so a long refresh session
   * cannot grow a request body until it is rejected.
   */
  const shownIds = useRef<string[]>([])
  /**
   * Set once, when the brief first runs out of restaurants the user has not
   * seen. A quiet line is honest; repeating it every lap would be nagging.
   */
  const [cycled, setCycled] = useState(false)
  const cycleAnnounced = useRef(false)

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
    // Double-tap guard lives in openDetail: it refuses while a detail is open.
    const next = openDetail(
      { results, shownIds: shownIds.current, cycled, chosen, detailVisible: rewardVisible },
      r,
    )
    if (next.detailVisible && !rewardVisible) void record(r.id, 'SELECT')
    setChosen(next.chosen)
    setRewardVisible(next.detailVisible)
  }

  /**
   * Dismissing the detail goes back to the THREE RESULTS — one level, not two.
   *
   * ⚠️ It used to `router.replace('/(tabs)')`, i.e. a single dismissal crossed
   * two levels of the hierarchy and dumped the user on Home. The decision is
   * still recorded the instant a card is tapped, so backing out of the detail
   * costs nothing — it just stops being a one-way door.
   *
   * ⚠️ NOTHING ELSE IS RESET. The reward is a Modal rendered inside this
   * screen, so closing it cannot unmount the screen: `results`, their order,
   * `shownIds` and `cycled` are all still here, and no fetch is triggered.
   * `dismissDetail` is what that promise is tested against.
   */
  const closeReward = () => {
    const next = dismissDetail({
      results,
      shownIds: shownIds.current,
      cycled,
      chosen,
      detailVisible: rewardVisible,
    })
    setChosen(next.chosen)
    setRewardVisible(next.detailVisible)
  }

  /**
   * "Done" is the explicit FINISH, and the one exit that still goes Home.
   *
   * ⚠️ Deliberately different from the X and the swipe: those are "up one
   * level", this is "I am finished deciding". A celebration with no visible way
   * to leave reads as unfinished, which is why the button exists at all — but
   * it must not be the only way out, which is what made dismissal feel like a
   * trapdoor.
   */
  const finishFromReward = () => {
    setRewardVisible(false)
    router.replace('/(tabs)')
  }

  const run = useCallback(async (nonce: number) => {
    setLoading(true)
    setError(false)
    setChosen(null)
    setRewardVisible(false)
    // The notice belongs to one result set, not to the screen.
    setCycled(false)
    const started = Date.now()
    try {
      const res = isTinder
        ? await tinderSuggest(likedIds, swipes)
        : await getDecision(effectivePrompt, chips, coords, {
            cuisines,
            format,
            vibe,
            budget,
            areaName: params.areaName,
            refreshNonce: nonce,
            // What has already been seen. Empty on first load.
            excludeIds: shownIds.current,
          })
      const elapsed = Date.now() - started
      if (elapsed < 1200) {
        await new Promise((r) => setTimeout(r, 1200 - elapsed))
      }
      setResults(res.results)
      setSessionId(res.sessionId)

      // Append, or restart the set when the brief has cycled — see
      // accumulateShown, which is where that rule is tested.
      shownIds.current = accumulateShown(
        shownIds.current,
        res.results,
        res.cycled === true,
      )
      if (res.cycled && !cycleAnnounced.current) {
        cycleAnnounced.current = true
        setCycled(true)
      }
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

  // All three record FIRST, then open — see recordAction. The URLs themselves
  // live in lib/actions so every screen's buttons do the same thing.
  const openDirections = (r: Restaurant) => {
    recordAction(r, 'DIRECTIONS')
    void openDirectionsFor(r)
  }
  const call = (r: Restaurant) => {
    recordAction(r, 'CALL')
    void openCallFor(r)
  }
  const order = (r: Restaurant) => {
    recordAction(r, 'ORDER')
    void openOrderFor(r)
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
          {/* ⚠️ A CLOSE, not a back arrow — and it goes Home, not back one
              screen. Arriving here from the Decide wizard, `back()` returned to
              the Vibe step, and from Food Tinder to the deck; neither is a way
              OUT, so the screen had no exit that did not involve making a
              decision first. This one always lands on the tabs. The wizard is
              still reachable by the OS swipe-back gesture for anyone who wants
              to tweak the brief. */}
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ minHeight: 40, minWidth: 40, justifyContent: 'center' }}
          >
            <Ionicons name="close" size={22} color="#504B47" />
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
          {/* The brief is exhausted and these are the top three again. Quiet,
              and said once: the user can see they are repeats, and a screen
              that pretends otherwise is the thing that loses their trust. */}
          {cycled ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 20,
                marginBottom: 12,
              }}
            >
              <Ionicons name="refresh-outline" size={13} color="#504B47" />
              <Text
                style={{
                  fontFamily: 'DMSans_400Regular',
                  fontSize: 12,
                  color: '#504B47',
                }}
              >
                Back to our top picks
              </Text>
            </View>
          ) : null}

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
        it. ⚠️ X / swipe-down / Android back go UP ONE LEVEL to these three
        cards; only "Done" finishes and goes Home. It is a Modal rendered inside
        this screen, so coming back costs no fetch — the results are still
        mounted exactly as they were. */}
    <SelectionReward
      visible={rewardVisible}
      restaurant={chosen}
      onClose={closeReward}
      onFinish={finishFromReward}
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
      description={preview?.description}
      phone={callablePhone(preview)}
      images={photoUrls(preview)}
      onDirections={() => preview && openDirections(preview)}
      onCall={() => preview && call(preview)}
      onOrder={() => preview && order(preview)}
    />
    </>
  )
}
