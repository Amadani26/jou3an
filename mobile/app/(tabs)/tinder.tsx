import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Linking,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  SlideInRight,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import RedButton from '../../components/RedButton'
import RestaurantDetailSheet from '../../components/RestaurantDetailSheet'
import AreaSearchSheet from '../../components/AreaSearchSheet'
import {
  getNearbyRestaurants,
  displayArea,
  prettyDistance,
  deliveryUrl,
  photoUrls,
  type AreaSuggestion,
  type Restaurant,
} from '../../lib/api'
import { getPlaceholderImage } from '../../lib/placeholderImages'
import { usePressed } from '../../lib/usePressed'

const { width: W, height: H } = Dimensions.get('window')
const THRESHOLD = W * 0.28
const SWIPE_OUT = W * 1.5
const SPRING = { damping: 18, stiffness: 180 }

/* ---------------- Deck paging ---------------- */

/** Rows per fetch. Small enough to be instant, big enough to outrun a thumb. */
const PAGE_SIZE = 20
/** Refill this many cards from the end, so the next batch lands before it's needed. */
const REFILL_AT = 3
/**
 * Radius ladder for a located deck. 5 km is the neighbourhood; 15 km is "still
 * worth the drive". Past that we stop pretending and widen to the whole city.
 */
const RADIUS_LADDER = [5, 15]
/** The server caps this too — matching it here keeps the URL honest. */
const EXCLUDE_CAP = 300

/** Height of the always-present "Liked" tray. Reserved so the deck never jumps. */
const TRAY_H = 86

type LocationMode = 'nearby' | 'anywhere' | 'area'

interface DeckLocation {
  mode: LocationMode
  /** Null for 'anywhere', and for 'nearby' until permission is granted. */
  coords: { lat: number; lng: number } | null
  /** The picked area's name, shown on the pill. Null unless mode is 'area'. */
  areaLabel: string | null
}

const ANYWHERE: DeckLocation = { mode: 'anywhere', coords: null, areaLabel: null }

/**
 * The location choice, remembered for the session.
 *
 * Module-level on purpose: the tab unmounts when you leave it, and re-deciding
 * "where am I eating" every time you come back to the deck is exactly the kind
 * of re-work this app exists to remove. It is NOT persisted to disk — a new
 * launch starts from Anywhere, because yesterday's area is rarely today's.
 */
let sessionLocation: DeckLocation = ANYWHERE

/* ---------------- Card photo slideshow ---------------- */

const CARD_W = W - 40
const SLIDE_MS = 2500 // time each photo is held
const FADE_MS = 400 // cross-fade duration
const BAR_PAD = 12
const BAR_GAP = 4
const BAR_H = 2.5

/**
 * One cross-fading layer of the slideshow.
 *
 * The active slide sits on top and fades IN; the outgoing slide stays fully
 * opaque underneath until the fade finishes, then snaps off while hidden. A
 * symmetric fade would dip to the dark card background mid-transition.
 */
function Slide({ uri, active }: { uri: string; active: boolean }) {
  const opacity = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    opacity.value = active
      ? withTiming(1, { duration: FADE_MS })
      : withDelay(FADE_MS, withTiming(0, { duration: 0 }))
  }, [active, opacity])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.Image
      source={{ uri }}
      resizeMode="cover"
      style={[StyleSheet.absoluteFill, { zIndex: active ? 2 : 1 }, style]}
    />
  )
}

type SegmentState = 'done' | 'active' | 'todo'

/** One bar of the stories-style progress indicator. */
function Segment({
  width,
  state,
  paused,
}: {
  width: number
  state: SegmentState
  paused: boolean
}) {
  const p = useSharedValue(state === 'done' ? 1 : 0)

  useEffect(() => {
    if (state === 'done') {
      cancelAnimation(p)
      p.value = 1
      return
    }
    if (state === 'todo') {
      cancelAnimation(p)
      p.value = 0
      return
    }
    // Active: pausing freezes the fill where it is; resuming finishes the
    // remaining time so the bar stays in step with the photo timer.
    if (paused) {
      cancelAnimation(p)
      return
    }
    p.value = withTiming(1, {
      duration: Math.max(0, SLIDE_MS * (1 - p.value)),
      easing: Easing.linear,
    })
  }, [state, paused, p])

  const fill = useAnimatedStyle(() => ({ width: p.value * width }))

  return (
    <View
      style={{
        width,
        height: BAR_H,
        borderRadius: BAR_H,
        backgroundColor: 'rgba(255,255,255,0.22)',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          { height: '100%', borderRadius: BAR_H, backgroundColor: 'rgba(255,255,255,0.85)' },
          fill,
        ]}
      />
    </View>
  )
}

/**
 * Auto-advancing photo slideshow for the swipe card.
 *
 * Mount it with `key={restaurant.id}` — a new card remounts this, which resets
 * to photo 1 and disposes the timer in one step. `paused` holds the timer while
 * the card is being dragged, preserving the elapsed time so resuming doesn't
 * restart the current photo.
 */
function CardSlideshow({ photos, paused }: { photos: string[]; paused: boolean }) {
  const [index, setIndex] = useState(0)
  // Time left on the current photo, carried across pause/resume.
  const remainingRef = useRef(SLIDE_MS)
  const startedRef = useRef(0)

  useEffect(() => {
    if (photos.length < 2) return

    if (paused) {
      // The previous effect's cleanup already cleared the timer; bank whatever
      // time was left so the next resume picks up where it stopped.
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedRef.current),
      )
      return
    }

    startedRef.current = Date.now()
    const id = setTimeout(() => {
      remainingRef.current = SLIDE_MS
      setIndex((i) => (i + 1) % photos.length)
    }, remainingRef.current)

    return () => clearTimeout(id)
  }, [index, paused, photos.length])

  if (photos.length === 0) return null

  const segW =
    (CARD_W - BAR_PAD * 2 - BAR_GAP * (photos.length - 1)) / photos.length

  return (
    // Own stacking context: the slides' zIndex must order them against each
    // other WITHOUT lifting them above the card's scrim and info overlay.
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {photos.map((uri, i) => (
        <Slide key={uri} uri={uri} active={i === index} />
      ))}

      {/* Segmented progress — only meaningful with more than one photo */}
      {photos.length > 1 ? (
        <View
          style={{
            position: 'absolute',
            top: 12,
            left: BAR_PAD,
            right: BAR_PAD,
            zIndex: 3,
            flexDirection: 'row',
            gap: BAR_GAP,
          }}
        >
          {photos.map((uri, i) => (
            <Segment
              key={uri}
              width={segW}
              state={i < index ? 'done' : i === index ? 'active' : 'todo'}
              paused={paused}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

/**
 * A transient line over the top of the card.
 *
 * ⚠️ ABSOLUTELY POSITIONED on purpose. Its predecessor sat in the layout flow,
 * so the card jumped every time it appeared or was dismissed. Nothing about the
 * deck's geometry may depend on whether there is something to say.
 */
function Notice({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={{
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        zIndex: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 6,
        backgroundColor: 'rgba(20,20,20,0.96)',
        borderWidth: 1,
        borderColor: '#242424',
        borderRadius: 12,
      }}
    >
      <Ionicons name="information-circle-outline" size={16} color="#FFB547" />
      <Text
        style={{
          flex: 1,
          fontFamily: 'DMSans_400Regular',
          fontSize: 12,
          lineHeight: 16,
          color: '#8A847E',
        }}
      >
        {text}
      </Text>
      <Pressable
        {...pressHandlers}
        onPress={onDismiss}
        hitSlop={8}
        style={{ padding: 6, opacity: pressed ? 0.6 : 1 }}
      >
        <Ionicons name="close" size={16} color="#504B47" />
      </Pressable>
    </Animated.View>
  )
}

/** One option in the location filter. */
function LocationPill({
  icon,
  label,
  active,
  flex,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  active: boolean
  flex?: boolean
  onPress: () => void
}) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
      style={{
        ...(flex ? { flexShrink: 1 } : {}),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 34,
        paddingHorizontal: 13,
        borderRadius: 999,
        backgroundColor: active ? '#1a0d0d' : '#141414',
        borderWidth: 1,
        borderColor: active ? '#E8272A' : '#242424',
        opacity: pressed ? 0.75 : 1,
      }}
    >
      <Ionicons name={icon} size={14} color={active ? '#E8272A' : '#8A847E'} />
      <Text
        numberOfLines={1}
        style={{
          fontFamily: active ? 'DMSans_700Bold' : 'DMSans_500Medium',
          fontSize: 13,
          color: active ? '#E8272A' : '#8A847E',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/** One thumbnail in the "Liked" tray. Its own component so it can hold press state. */
function LikedThumb({
  name,
  imageIndex,
  imageUrl,
  onPress,
}: {
  name: string
  imageIndex: number
  /** Google Places photo; falls back to the placeholder when absent. */
  imageUrl?: string
  onPress: () => void
}) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
      style={{ width: 52, alignItems: 'center', opacity: pressed ? 0.7 : 1 }}
    >
      <Image
        source={{ uri: imageUrl ?? getPlaceholderImage(imageIndex) }}
        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#141414' }}
      />
      <Text
        numberOfLines={1}
        style={{
          fontFamily: 'DMSans_400Regular',
          fontSize: 9,
          color: '#666',
          marginTop: 4,
          textAlign: 'center',
          maxWidth: 52,
        }}
      >
        {name}
      </Text>
    </Pressable>
  )
}

export default function TinderScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [index, setIndex] = useState(0)
  const [likedIds, setLikedIds] = useState<string[]>([])
  const [swipeCount, setSwipeCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  // The restaurant shown in the detail sheet — the current card, or a tapped
  // "Liked" tray thumbnail.
  const [sheetRestaurant, setSheetRestaurant] = useState<Restaurant | null>(null)
  // Holds the slideshow timer while the card is being dragged.
  const [dragging, setDragging] = useState(false)

  /* ---------------- Location filter ---------------- */
  const [location, setLocation] = useState<DeckLocation>(sessionLocation)
  const [areaSheetOpen, setAreaSheetOpen] = useState(false)

  /* ---------------- Deck paging ---------------- */
  /** True once the server has no more rows for this filter — the loop's cue. */
  const [exhausted, setExhausted] = useState(false)
  /** One transient line over the card: widened radius, or "seen them all". */
  const [notice, setNotice] = useState<string | null>(null)

  /** Rows received from the server for the CURRENT filter — i.e. the next offset. */
  const fetchedCount = useRef(0)
  /** Guards against two refills racing each other into duplicate cards. */
  const fetching = useRef(false)
  /** Bumped on every filter change; in-flight responses for older tokens are dropped. */
  const loadToken = useRef(0)
  /** What the refills should ask for — set once the load settles on a radius. */
  const activeQuery = useRef<{ coords: { lat: number; lng: number } | null; radiusKm: number }>({
    coords: null,
    radiusKm: RADIUS_LADDER[0],
  })
  /**
   * Every swipe this session, in order, repeats included. It is what orders the
   * loop (least-recently-swiped first) and what a filter change excludes.
   */
  const swipeLog = useRef<string[]>([])
  /** Snapshot taken per filter load, so paging stays consistent within it. */
  const excludeSnapshot = useRef<string[]>([])
  /**
   * Liked restaurants by id.
   *
   * ⚠️ The tray CANNOT resolve its thumbnails from the current deck: changing
   * the location filter replaces the deck, and everything liked under the old
   * filter would silently vanish from the tray while still counting towards
   * Suggest 3. Likes belong to the session, not to a deck.
   */
  const likedById = useRef(new Map<string, Restaurant>())
  /** The "showing them again" line is worth saying once, not every lap. */
  const loopAnnounced = useRef(false)

  const translateX = useSharedValue(0)

  const fetchPage = (offset: number) =>
    getNearbyRestaurants(activeQuery.current.coords, {
      radiusKm: activeQuery.current.radiusKm,
      limit: PAGE_SIZE,
      offset,
      exclude: excludeSnapshot.current,
    })

  /**
   * Loads the first page for a location choice, replacing the deck.
   *
   * A located deck climbs the radius ladder before giving up and going
   * city-wide: an empty deck is never an acceptable answer, and "nothing within
   * 5 km" is a statement about the radius, not about Dubai.
   */
  const loadDeck = useCallback(async (loc: DeckLocation) => {
    const token = ++loadToken.current
    setLoading(true)
    setNotice(null)
    setRestaurants([])
    setIndex(0)
    setExhausted(false)
    fetchedCount.current = 0
    fetching.current = false
    loopAnnounced.current = false
    // Switching filters should feel like fresh cards, not a re-run of what was
    // just swiped. Capped — past the cap `offset` carries the paging anyway.
    excludeSnapshot.current = [...new Set(swipeLog.current)].slice(-EXCLUDE_CAP)

    try {
      let rows: Restaurant[] = []
      let message: string | null = null

      if (loc.coords) {
        for (const km of RADIUS_LADDER) {
          activeQuery.current = { coords: loc.coords, radiusKm: km }
          rows = await fetchPage(0)
          if (token !== loadToken.current) return
          if (rows.length) {
            if (km !== RADIUS_LADDER[0]) {
              message = `Nothing within ${RADIUS_LADDER[0]} km — widened to ${km} km`
            }
            break
          }
        }
        if (!rows.length) {
          // Outside Dubai entirely (the simulator defaults to San Francisco),
          // or a very quiet corner of it.
          activeQuery.current = { coords: null, radiusKm: RADIUS_LADDER[0] }
          rows = await fetchPage(0)
          if (token !== loadToken.current) return
          if (rows.length) message = 'Nothing nearby — showing all of Dubai'
        }
      } else {
        activeQuery.current = { coords: null, radiusKm: RADIUS_LADDER[0] }
        rows = await fetchPage(0)
        if (token !== loadToken.current) return
      }

      setRestaurants(rows)
      fetchedCount.current = rows.length
      setExhausted(rows.length < PAGE_SIZE)
      if (message) setNotice(message)
    } catch {
      if (token !== loadToken.current) return
      setRestaurants([]) // graceful — empty deck, Suggest still works
      setExhausted(true)
    } finally {
      if (token === loadToken.current) setLoading(false)
    }
    // fetchPage reads refs only, so it needs no dependency of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // First load. Restores whatever the session last chose.
  useEffect(() => {
    loadDeck(sessionLocation)
  }, [loadDeck])

  /**
   * Refill BEFORE the deck runs out, so the next card is always already there.
   * A short page means the pool is spent, which hands over to the loop below.
   */
  useEffect(() => {
    if (loading || exhausted || fetching.current) return
    if (restaurants.length - index > REFILL_AT) return

    const token = loadToken.current
    fetching.current = true
    ;(async () => {
      try {
        const rows = await fetchPage(fetchedCount.current)
        if (token !== loadToken.current) return
        fetchedCount.current += rows.length
        if (rows.length) setRestaurants((prev) => [...prev, ...rows])
        if (rows.length < PAGE_SIZE) setExhausted(true)
      } catch {
        // Keep what we have; the loop below means the deck still never dies.
        if (token === loadToken.current) setExhausted(true)
      } finally {
        fetching.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants.length, index, loading, exhausted])

  /**
   * THE DECK NEVER DIES. Once the pool is spent, go round again — least
   * recently swiped first, so the card you just passed on is the last one back.
   */
  useEffect(() => {
    if (loading || !exhausted || restaurants.length === 0) return
    if (index < restaurants.length) return

    const lastSwipedAt = new Map<string, number>()
    swipeLog.current.forEach((id, i) => lastSwipedAt.set(id, i))
    const looped = [...restaurants].sort(
      (a, b) => (lastSwipedAt.get(a.id) ?? -1) - (lastSwipedAt.get(b.id) ?? -1),
    )

    setRestaurants(looped)
    setIndex(0)
    if (!loopAnnounced.current) {
      loopAnnounced.current = true
      setNotice(
        location.mode === 'anywhere'
          ? "You've seen every restaurant — showing them again"
          : "You've seen everyone nearby — showing them again",
      )
    }
  }, [index, restaurants, loading, exhausted, location.mode])

  /** Notices say their piece and get out of the way. */
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  /* ---------------- Changing the filter ---------------- */

  const applyLocation = useCallback(
    async (next: DeckLocation) => {
      sessionLocation = next
      setLocation(next)
      await loadDeck(next)
    },
    [loadDeck],
  )

  const chooseNearby = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        // Denied permission is a fine answer — fall back rather than nag.
        await applyLocation(ANYWHERE)
        setNotice('Location is off — showing all of Dubai')
        return
      }
      // Last known is instant; only pay for a fresh fix if there isn't one.
      let pos = await Location.getLastKnownPositionAsync()
      if (!pos) {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      }
      if (!pos) {
        await applyLocation(ANYWHERE)
        setNotice("Couldn't get your location — showing all of Dubai")
        return
      }
      await applyLocation({
        mode: 'nearby',
        coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        areaLabel: null,
      })
    } catch {
      await applyLocation(ANYWHERE)
    }
  }

  const chooseArea = async (s: AreaSuggestion) => {
    setAreaSheetOpen(false)
    await applyLocation({
      mode: 'area',
      coords: { lat: s.lat, lng: s.lng },
      areaLabel: s.name,
    })
  }

  const current = restaurants[index]
  const currentPhotos = photoUrls(current)
  // With the loop in place this only happens when the filter genuinely has
  // nothing in it — not merely because everything has been swiped.
  const done = !loading && restaurants.length === 0

  // Advance to the next card (runs on the JS thread from the gesture callback).
  const advance = (dir: 'left' | 'right') => {
    const r = restaurants[index]
    Haptics.impactAsync(
      dir === 'right'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    )
    // Every swipe is logged, re-swipes on looped cards included: they order the
    // next lap, and a card seen twice is a card the user has now judged twice.
    if (r) swipeLog.current.push(r.id)
    // The liked SET is what Suggest 3 sends, so a second right-swipe on the
    // same restaurant is not a second entry (the server de-duplicates it too).
    if (dir === 'right' && r) {
      likedById.current.set(r.id, r)
      setLikedIds((prev) => (prev.includes(r.id) ? prev : [...prev, r.id]))
    }
    setSwipeCount((c) => c + 1)
    setIndex((i) => i + 1)
    translateX.value = 0
  }

  const openSheetFor = (r: Restaurant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSheetRestaurant(r)
    setSheetOpen(true)
  }

  // Open the sheet for the card currently in the deck (from tap / long-press).
  const openCurrentSheet = () => {
    if (current) openSheetFor(current)
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onStart(() => {
      runOnJS(setDragging)(true)
    })
    // onFinalize covers both a completed drag and a cancelled one.
    .onFinalize(() => {
      runOnJS(setDragging)(false)
    })
    .onUpdate((e) => {
      translateX.value = e.translationX
    })
    .onEnd((e) => {
      if (e.translationX > THRESHOLD || e.velocityX > 800) {
        translateX.value = withTiming(SWIPE_OUT, { duration: 200 }, (f) => {
          if (f) runOnJS(advance)('right')
        })
      } else if (e.translationX < -THRESHOLD || e.velocityX < -800) {
        translateX.value = withTiming(-SWIPE_OUT, { duration: 200 }, (f) => {
          if (f) runOnJS(advance)('left')
        })
      } else {
        translateX.value = withSpring(0, SPRING)
      }
    })

  const tap = Gesture.Tap().maxDuration(250).onEnd(() => {
    runOnJS(openCurrentSheet)()
  })

  const longPress = Gesture.LongPress().minDuration(400).onStart(() => {
    runOnJS(openCurrentSheet)()
  })

  const gesture = Gesture.Race(pan, longPress, tap)

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-W, W],
      [-15, 15],
      Extrapolation.CLAMP,
    )
    return {
      transform: [{ translateX: translateX.value }, { rotateZ: `${rotate}deg` }],
    }
  })

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }))
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }))

  // Sheet action handlers — act on whichever restaurant the sheet is showing.
  const mapsUrl = (r: Restaurant) =>
    `https://maps.google.com/?q=${encodeURIComponent(
      `${r.name} ${displayArea(r)} Dubai`,
    )}`
  const openDirections = () => {
    if (sheetRestaurant) Linking.openURL(mapsUrl(sheetRestaurant))
  }
  const call = () => {
    if (!sheetRestaurant) return
    if (sheetRestaurant.phone) Linking.openURL(`tel:${sheetRestaurant.phone}`)
    else Linking.openURL(mapsUrl(sheetRestaurant))
  }
  const order = () => {
    if (!sheetRestaurant) return
    Linking.openURL(deliveryUrl(sheetRestaurant) ?? mapsUrl(sheetRestaurant))
  }

  // Restaurants swiped right on this session — newest last — for the "Liked"
  // tray. Resolved from the session map, so a filter change never loses them.
  const likedRestaurants = likedIds
    .map((id) => likedById.current.get(id))
    .filter((r): r is Restaurant => !!r)

  const suggest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push({
      pathname: '/results',
      params: {
        mode: 'tinder',
        likedIds: JSON.stringify(likedIds),
        title: swipeCount >= 10 ? 'Picked for your taste' : 'Your 3 picks',
      },
    })
  }

  const suggestLabel =
    swipeCount >= 10 ? 'Suggest 3 (Based on your taste)' : 'Suggest 3'

  return (
    <View style={{ flex: 1, backgroundColor: '#080808', paddingTop: insets.top + 12 }}>
      {/* Header — fixed-height block the card can never overlap */}
      <View style={{ height: 60, paddingHorizontal: 20, justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: 'DMSans_700Bold',
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 2,
            color: '#504B47',
            marginBottom: 6,
          }}
        >
          SWIPE RIGHT TO SAVE · LEFT TO SKIP
        </Text>
        <Text
          style={{
            fontFamily: 'DMSans_800ExtraBold',
            fontSize: 30,
            color: '#F2EDE8',
            letterSpacing: -1,
          }}
        >
          Food Tinder
        </Text>
      </View>

      {/* Location filter — FIXED height, always mounted. Nothing below it may
          move because of what is (or isn't) selected. */}
      <View
        style={{
          height: 34,
          marginTop: 10,
          marginBottom: 2,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <LocationPill
          icon="navigate-outline"
          label="Nearby"
          active={location.mode === 'nearby'}
          onPress={chooseNearby}
        />
        <LocationPill
          icon="map-outline"
          label="Anywhere"
          active={location.mode === 'anywhere'}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            void applyLocation(ANYWHERE)
          }}
        />
        <LocationPill
          icon="search-outline"
          label={location.areaLabel ?? 'Pick an area'}
          active={location.mode === 'area'}
          flex
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setAreaSheetOpen(true)
          }}
        />
      </View>

      {/* Card area — flexes to fill the space between the header and the tray.
          The fixed paddingTop is a barrier the (fixed-height) card can't cross. */}
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingTop: 12,
        }}
      >
        {/* `!current` covers the gap between the last card of a page and the
            refill landing — without it the deck would render an undefined
            restaurant instead of waiting the half-second out. */}
        {loading || (!current && !done) ? (
          <ActivityIndicator color="#E8272A" />
        ) : done ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Ionicons name="flame-outline" size={48} color="#242424" />
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#8A847E' }}>
              Nothing to swipe here
            </Text>
            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 13,
                color: '#504B47',
                textAlign: 'center',
              }}
            >
              Try Anywhere, or pick a different area
            </Text>
          </View>
        ) : (
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[
                {
                  width: W - 40,
                  // ⚠️ FLEX, not a fixed height. The card used to be H * 0.52
                  // outright, which fitted only as long as nothing else was
                  // added above it — the location filter took the last 46pt of
                  // slack and the card started overlapping the pills and the
                  // tray. It now takes the space it is given and no more.
                  flex: 1,
                  maxHeight: H * 0.52,
                  borderRadius: 28,
                  overflow: 'hidden',
                  backgroundColor: '#141414',
                  borderWidth: 1,
                  borderColor: '#242424',
                },
                cardStyle,
              ]}
            >
              {/* Auto-playing slideshow of the real Places photos; branded
                  gradient when the restaurant has none. Keyed by restaurant id
                  so each new card restarts at photo 1 with a fresh timer. */}
              <LinearGradient colors={['#2A1114', '#141414']} style={StyleSheet.absoluteFill} />
              {currentPhotos.length > 0 ? (
                <CardSlideshow
                  key={current.id}
                  photos={currentPhotos}
                  paused={dragging}
                />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { alignItems: 'center', justifyContent: 'center' },
                  ]}
                >
                  <Ionicons name="restaurant" size={110} color="rgba(232,39,42,0.12)" />
                </View>
              )}

              {/* Bottom scrim for text legibility. Needs to be deeper/darker than
                  the old placeholder gradient — real Places photos are often bright. */}
              <LinearGradient
                colors={['transparent', 'rgba(8,8,8,0.62)', 'rgba(8,8,8,0.97)']}
                locations={[0, 0.45, 1]}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 320 }}
              />

              {/* Info overlay */}
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24 }}>
                <Text
                  style={{
                    fontFamily: 'DMSans_800ExtraBold',
                    fontSize: 34,
                    color: '#F2EDE8',
                    letterSpacing: -1,
                    marginBottom: 8,
                  }}
                >
                  {current.name}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#8A847E' }}>
                    {current.cuisineType}
                  </Text>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A' }} />
                  <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#FFB547' }}>
                    AED {current.priceMin}–{current.priceMax}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="location-outline" size={14} color="#8A847E" />
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#8A847E' }}>
                    {displayArea(current)}
                  </Text>
                  {prettyDistance(current.distanceKm) ? (
                    <>
                      <View
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: 1.5,
                          backgroundColor: '#5a5a5a',
                        }}
                      />
                      <Text
                        style={{
                          fontFamily: 'DMSans_600SemiBold',
                          fontSize: 14,
                          color: '#8A847E',
                        }}
                      >
                        {prettyDistance(current.distanceKm)}
                      </Text>
                    </>
                  ) : null}
                </View>
              </View>

              {/* Swipe tint — green (interested) on the right, red (pass) on the left */}
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: 28, borderWidth: 4, borderColor: '#2DCE89' },
                  likeStyle,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: 28, borderWidth: 4, borderColor: '#E8272A' },
                  nopeStyle,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    top: 24,
                    left: 24,
                    borderWidth: 3,
                    borderColor: '#2DCE89',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    transform: [{ rotate: '-14deg' }],
                  },
                  likeStyle,
                ]}
              >
                <Text style={{ fontFamily: 'DMSans_800ExtraBold', fontSize: 20, color: '#2DCE89', letterSpacing: 1 }}>
                  INTERESTED
                </Text>
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    top: 24,
                    right: 24,
                    borderWidth: 3,
                    borderColor: '#E8272A',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    transform: [{ rotate: '14deg' }],
                  },
                  nopeStyle,
                ]}
              >
                <Text style={{ fontFamily: 'DMSans_800ExtraBold', fontSize: 20, color: '#E8272A', letterSpacing: 1 }}>
                  PASS
                </Text>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        )}

        {/* Floats over the card — see Notice; it must never shift the deck.
            ⚠️ Rendered LAST on purpose. As the first child it sat UNDER the
            card (which is inset less than the notice, so it covered it
            completely) and no message was ever actually visible — zIndex alone
            did not save it. */}
        {notice ? <Notice text={notice} onDismiss={() => setNotice(null)} /> : null}
      </View>

      {/* "Liked" tray — session right-swipes.
          ⚠️ ALWAYS RENDERED at a fixed height. It used to appear on the first
          like, which shoved the whole deck upward mid-swipe. Reserving the slot
          costs one band of empty space and buys a layout that never moves. */}
      <View style={{ height: TRAY_H, paddingTop: 4 }}>
        <Text
          style={{
            fontFamily: 'DMSans_700Bold',
            fontSize: 11,
            color: '#555',
            letterSpacing: 1,
            paddingHorizontal: 20,
            marginBottom: 8,
          }}
        >
          LIKED
        </Text>
        {likedRestaurants.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {likedRestaurants.map((r, i) => (
              <Animated.View key={r.id} entering={SlideInRight.springify().damping(14)}>
                <LikedThumb
                  name={r.name}
                  imageIndex={i}
                  imageUrl={photoUrls(r)[0]}
                  onPress={() => openSheetFor(r)}
                />
              </Animated.View>
            ))}
          </ScrollView>
        ) : (
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 12,
              color: '#3a3a3a',
              paddingHorizontal: 20,
            }}
          >
            Swipe right to save a place here
          </Text>
        )}
      </View>

      {/* Suggest 3 — always visible */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
        <RedButton label={suggestLabel} onPress={suggest} style={{ paddingVertical: 16 }} />
      </View>

      <AreaSearchSheet
        visible={areaSheetOpen}
        onClose={() => setAreaSheetOpen(false)}
        onPick={chooseArea}
      />

      {sheetRestaurant ? (
        <RestaurantDetailSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          name={sheetRestaurant.name}
          cuisine={sheetRestaurant.cuisineType}
          priceRange={`AED ${sheetRestaurant.priceMin}–${sheetRestaurant.priceMax}`}
          area={displayArea(sheetRestaurant)}
          tags={sheetRestaurant.tags}
          googleRating={sheetRestaurant.googleRating}
          distanceKm={sheetRestaurant.distanceKm}
          calories={sheetRestaurant.averageCalories}
          images={photoUrls(sheetRestaurant)}
          onDirections={openDirections}
          onCall={call}
          onOrder={order}
        />
      ) : null}
    </View>
  )
}
