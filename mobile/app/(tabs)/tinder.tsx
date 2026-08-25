import { useEffect, useState } from 'react'
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
  Extrapolation,
  SlideInRight,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import RedButton from '../../components/RedButton'
import RestaurantDetailSheet from '../../components/RestaurantDetailSheet'
import {
  getNearbyRestaurants,
  prettyArea,
  deliveryUrl,
  photoUrls,
  type Restaurant,
} from '../../lib/api'
import { getPlaceholderImage } from '../../lib/placeholderImages'
import { usePressed } from '../../lib/usePressed'

const { width: W, height: H } = Dimensions.get('window')
const THRESHOLD = W * 0.28
const SWIPE_OUT = W * 1.5
const SPRING = { damping: 18, stiffness: 180 }

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

  const translateX = useSharedValue(0)

  useEffect(() => {
    let active = true
    ;(async () => {
      let coords: { lat: number; lng: number } | undefined
      try {
        const perm = await Location.getForegroundPermissionsAsync()
        if (perm.granted) {
          const last = await Location.getLastKnownPositionAsync()
          if (last) {
            coords = { lat: last.coords.latitude, lng: last.coords.longitude }
          }
        }
      } catch {
        /* no location — fetch all */
      }
      try {
        const data = await getNearbyRestaurants(coords)
        if (active) setRestaurants(data)
      } catch {
        if (active) setRestaurants([]) // graceful — empty deck, Suggest still works
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const current = restaurants[index]
  const currentPhoto = photoUrls(current)[0]
  const done = !loading && (restaurants.length === 0 || index >= restaurants.length)

  // Advance to the next card (runs on the JS thread from the gesture callback).
  const advance = (dir: 'left' | 'right') => {
    const r = restaurants[index]
    Haptics.impactAsync(
      dir === 'right'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    )
    if (dir === 'right' && r) setLikedIds((prev) => [...prev, r.id])
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
      `${r.name} ${prettyArea(r.area)} Dubai`,
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

  // Restaurants swiped right on this session — newest last — for the "Liked" tray.
  const likedRestaurants = likedIds
    .map((id) => restaurants.find((r) => r.id === id))
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
        {loading ? (
          <ActivityIndicator color="#E8272A" />
        ) : done ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Ionicons name="flame-outline" size={48} color="#242424" />
            <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#8A847E' }}>
              You&apos;ve swiped through them all
            </Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#504B47' }}>
              Tap Suggest 3 for your picks
            </Text>
          </View>
        ) : (
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[
                {
                  width: W - 40,
                  height: H * 0.52,
                  borderRadius: 28,
                  overflow: 'hidden',
                  backgroundColor: '#141414',
                  borderWidth: 1,
                  borderColor: '#242424',
                },
                cardStyle,
              ]}
            >
              {/* Real Google Places photo when synced; branded gradient otherwise. */}
              <LinearGradient colors={['#2A1114', '#141414']} style={StyleSheet.absoluteFill} />
              {currentPhoto ? (
                <Image
                  source={{ uri: currentPhoto }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
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
                    {prettyArea(current.area)}
                  </Text>
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
      </View>

      {/* "Liked" tray — session right-swipes; hidden until there's at least one */}
      {likedRestaurants.length > 0 ? (
        <View style={{ paddingTop: 4 }}>
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
            Liked
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {likedRestaurants.map((r) => (
              <Animated.View key={r.id} entering={SlideInRight.springify().damping(14)}>
                <LikedThumb
                  name={r.name}
                  imageIndex={restaurants.indexOf(r)}
                  imageUrl={photoUrls(r)[0]}
                  onPress={() => openSheetFor(r)}
                />
              </Animated.View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Suggest 3 — always visible */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
        <RedButton label={suggestLabel} onPress={suggest} style={{ paddingVertical: 16 }} />
      </View>

      {sheetRestaurant ? (
        <RestaurantDetailSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          name={sheetRestaurant.name}
          cuisine={sheetRestaurant.cuisineType}
          priceRange={`AED ${sheetRestaurant.priceMin}–${sheetRestaurant.priceMax}`}
          area={prettyArea(sheetRestaurant.area)}
          tags={sheetRestaurant.tags}
          googleRating={sheetRestaurant.googleRating}
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
