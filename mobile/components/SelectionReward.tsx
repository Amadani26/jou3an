import { useEffect, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import {
  displayArea,
  photoUrls,
  prettyDistance,
  prettyTag,
  visibleTags,
  type Restaurant,
} from '../lib/api'
import { getPlaceholderImage } from '../lib/placeholderImages'
import { usePressed } from '../lib/usePressed'
import { useAuth } from '../contexts/AuthContext'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

/** The hero owns the top of the screen; the payoff should read as a poster. */
const HERO_H = Math.round(SCREEN_H * 0.45)

const SPRING = { damping: 15, stiffness: 170, mass: 0.7 }
/** Width of the red rule that draws itself in under the name. */
const RULE_W = 64

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface Props {
  visible: boolean
  /** The restaurant the user just chose. Null while nothing is selected. */
  restaurant: Restaurant | null
  /** X or swipe-down — the caller sends the user home; the decision is final. */
  onClose: () => void
  onDirections: () => void
  onCall: () => void
  onOrder: () => void
}

/** Edge-to-edge paging hero. Falls back to placeholder food photography. */
function Hero({ restaurant }: { restaurant: Restaurant }) {
  const [active, setActive] = useState(0)
  const photos = photoUrls(restaurant)
  const images = photos.length ? photos : [getPlaceholderImage(0), getPlaceholderImage(1)]

  return (
    <View style={{ height: HERO_H, backgroundColor: '#0F0F0F' }}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) =>
          setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
        }
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width: SCREEN_W, height: HERO_H }}
            resizeMode="cover"
          />
        )}
      />

      {/* Top scrim so the X stays legible over a bright photo. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140 }}
        pointerEvents="none"
      />

      {/* The photo dissolving into the page — the hero has no hard edge. */}
      <LinearGradient
        colors={['transparent', 'rgba(8,8,8,0.72)', '#080808']}
        locations={[0, 0.62, 1]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: Math.round(HERO_H * 0.62),
        }}
        pointerEvents="none"
      />

      {images.length > 1 ? (
        <View
          style={{
            position: 'absolute',
            // Clear of the title block, which deliberately overlaps the
            // hero's bottom 54pt so the photo bleeds into the copy.
            bottom: 78,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {images.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === active ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === active ? '#E8272A' : 'rgba(242,237,232,0.28)',
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** One tile of the payoff CTA row. */
function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 68,
        borderRadius: 16,
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: '#242424',
        opacity: pressed ? 0.75 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color="#E8272A" />
      <Text
        numberOfLines={1}
        style={{
          fontFamily: 'DMSans_600SemiBold',
          fontSize: 11,
          letterSpacing: 1,
          color: '#F2EDE8',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/** The way out. The X and a swipe down do the same thing; this one is findable. */
function DoneButton({ onPress }: { onPress: () => void }) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
      style={{
        height: 50,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#242424',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: 'DMSans_600SemiBold',
          fontSize: 15,
          letterSpacing: 0.3,
          color: '#8A847E',
        }}
      >
        Done
      </Text>
    </Pressable>
  )
}

function MetaRow({
  icon,
  iconColor = '#504B47',
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor?: string
  children: React.ReactNode
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {children}
      </View>
    </View>
  )
}

/**
 * The payoff: a FULL-SCREEN celebration of the decision the user just made.
 *
 * This is not a detail sheet. The long-press preview stays a half-screen
 * RestaurantDetailSheet, and that contrast — sheet for looking, whole screen
 * for choosing — is what tells the two apart at a glance, so never present
 * this one for a preview.
 *
 * By the time it appears the SELECT has already been sent (see results.tsx), so
 * everything here celebrates and informs; nothing here is a confirmation step.
 * The actions only open their link and upgrade `actionTaken`.
 *
 * It does, though, have to SAY the decision was kept — celebrating a choice and
 * then dropping the user on an unchanged Home screen is what made the flow feel
 * unfinished. Hence the receipt line and the explicit Done. All three exits
 * (Done, X, swipe) do the same thing: back to Home, decision final.
 */
export default function SelectionReward({
  visible,
  restaurant,
  onClose,
  onDirections,
  onCall,
  onOrder,
}: Props) {
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuth()

  /** Entrance progress; also drives the exit when the sheet is dragged away. */
  const enter = useSharedValue(0)
  const translateY = useSharedValue(0)
  /** One-shot flourish: a red bloom that swells behind the name and fades. */
  const bloom = useSharedValue(0)
  /** The rule under the name, drawing itself in from the left. */
  const rule = useSharedValue(0)

  useEffect(() => {
    if (!visible) return
    enter.value = 0
    translateY.value = 0
    bloom.value = 0
    rule.value = 0

    enter.value = withSpring(1, SPRING)
    // Swell, then settle to nothing — celebration, not decoration.
    bloom.value = withSequence(
      withTiming(1, { duration: 420 }),
      withDelay(180, withTiming(0, { duration: 900 })),
    )
    rule.value = withDelay(200, withSpring(1, { damping: 18, stiffness: 140 }))
  }, [visible, enter, translateY, bloom, rule])

  const dismiss = () => {
    translateY.value = withTiming(SCREEN_H, { duration: 240 }, (finished) => {
      if (finished) runOnJS(onClose)()
    })
  }

  // Swipe down anywhere on the hero to leave — the same exit as the X.
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        translateY.value = withTiming(SCREEN_H, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onClose)()
        })
      } else {
        translateY.value = withSpring(0, SPRING)
      }
    })

  const screenStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [0, SCREEN_H], [1, 0.2], Extrapolation.CLAMP),
  }))
  const heroStyle = useAnimatedStyle(() => ({
    // A hair of settle, so the photo lands rather than snaps.
    transform: [{ scale: interpolate(enter.value, [0, 1], [1.06, 1]) }],
  }))
  const eyebrowStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }))
  const nameStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: (1 - enter.value) * 22 },
      { scale: interpolate(enter.value, [0, 1], [0.94, 1]) },
    ],
  }))
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloom.value,
    transform: [{ scale: interpolate(bloom.value, [0, 1], [0.86, 1]) }],
  }))
  const ruleStyle = useAnimatedStyle(() => ({ width: RULE_W * rule.value }))
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0.3, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: (1 - enter.value) * 16 }],
  }))

  if (!restaurant) return null

  const tags = visibleTags(restaurant.tags)
  const distance = prettyDistance(restaurant.distanceKm)

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#080808' }}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#080808' }, screenStyle]}>
          {/* Hero — swipe it down to leave. */}
          <GestureDetector gesture={pan}>
            <Animated.View style={heroStyle}>
              <Hero restaurant={restaurant} />
            </Animated.View>
          </GestureDetector>

          {/* Exit, top-left. */}
          <AnimatedPressable
            onPress={dismiss}
            hitSlop={12}
            style={[
              {
                position: 'absolute',
                top: insets.top + 8,
                left: 20,
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: 'rgba(8,8,8,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(242,237,232,0.14)',
                alignItems: 'center',
                justifyContent: 'center',
              },
              eyebrowStyle,
            ]}
          >
            <Ionicons name="close" size={20} color="#F2EDE8" />
          </AnimatedPressable>

          <ScrollView
            style={{ flex: 1, marginTop: -54 }}
            contentContainerStyle={{ paddingBottom: 28 }}
            showsVerticalScrollIndicator={false}
          >
            {/* --- The moment ------------------------------------------ */}
            <View style={{ paddingHorizontal: 24 }}>
              {/* One-shot red bloom behind the name. A GRADIENT, not a filled
                  shape: a solid block reads as a coloured slab with visible
                  edges, which is the opposite of a flourish. */}
              <Animated.View
                style={[
                  { position: 'absolute', left: -40, right: -40, top: -44, height: 210 },
                  bloomStyle,
                ]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['transparent', 'rgba(232,39,42,0.34)', 'transparent']}
                  locations={[0, 0.5, 1]}
                  style={{ flex: 1 }}
                />
              </Animated.View>

              <Animated.View
                style={[
                  { flexDirection: 'row', alignItems: 'center', gap: 7 },
                  eyebrowStyle,
                ]}
              >
                <Ionicons name="checkmark-circle" size={15} color="#E8272A" />
                <Text
                  style={{
                    fontFamily: 'DMSans_700Bold',
                    fontSize: 10,
                    letterSpacing: 2,
                    color: '#E8272A',
                  }}
                >
                  YOU&apos;RE GOING TO
                </Text>
              </Animated.View>

              <Animated.View style={nameStyle}>
                <Text
                  // Capped at 3 lines: a handful of imported rows carry a full
                  // marketing sentence as their name, and five lines of it
                  // shoves the detail behind the pinned action row.
                  numberOfLines={3}
                  style={{
                    fontFamily: 'DMSans_800ExtraBold',
                    fontSize: 34,
                    lineHeight: 38,
                    letterSpacing: -1.2,
                    color: '#F2EDE8',
                    marginTop: 10,
                  }}
                >
                  {restaurant.name}
                </Text>
              </Animated.View>

              <Animated.View
                style={[
                  {
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: '#E63946',
                    marginTop: 14,
                  },
                  ruleStyle,
                ]}
              />

              <Animated.View style={[{ marginTop: 14 }, bodyStyle]}>
                <Text
                  style={{
                    fontFamily: 'DMSans_500Medium',
                    fontSize: 14,
                    fontStyle: 'italic',
                    color: '#8A847E',
                  }}
                >
                  Enjoy your meal.
                </Text>

                {/* The receipt. The decision was recorded the instant the card
                    was tapped — this is the only place the app says so, and
                    without it the flow celebrates without ever confirming.
                    ⚠️ Signed out there is nothing to promise: the pick belongs
                    to an anonymous session that History (auth-gated) can never
                    show, so the copy is an invitation, never "saved". */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    marginTop: 12,
                  }}
                >
                  <Ionicons
                    name={isAuthenticated ? 'checkmark-circle' : 'time-outline'}
                    size={14}
                    color={isAuthenticated ? '#2DCE89' : '#504B47'}
                  />
                  <Text
                    style={{
                      fontFamily: 'DMSans_500Medium',
                      fontSize: 13,
                      color: isAuthenticated ? '#8A847E' : '#504B47',
                    }}
                  >
                    {isAuthenticated
                      ? 'Saved to your decisions'
                      : 'Sign in to keep your decisions'}
                  </Text>
                </View>
              </Animated.View>
            </View>

            {/* --- The detail ------------------------------------------ */}
            <Animated.View
              style={[{ paddingHorizontal: 24, marginTop: 34, gap: 22 }, bodyStyle]}
            >
              <MetaRow icon="location-outline">
                <Text
                  style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#F2EDE8' }}
                >
                  {displayArea(restaurant)}
                </Text>
                {distance ? (
                  <>
                    <View
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: '#3a3a3a',
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: 'DMSans_400Regular',
                        fontSize: 15,
                        color: '#8A847E',
                      }}
                    >
                      {distance} away
                    </Text>
                  </>
                ) : null}
              </MetaRow>

              {/* Google's 0–5 rating. Hidden entirely when the row is unsynced. */}
              {typeof restaurant.googleRating === 'number' ? (
                <MetaRow icon="star" iconColor="#FFB547">
                  <Text
                    style={{
                      fontFamily: 'DMSans_800ExtraBold',
                      fontSize: 20,
                      color: '#F2EDE8',
                    }}
                  >
                    {restaurant.googleRating.toFixed(1)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'DMSans_400Regular',
                      fontSize: 13,
                      color: '#504B47',
                    }}
                  >
                    on Google
                  </Text>
                </MetaRow>
              ) : null}

              <MetaRow icon="pricetag-outline">
                <Text
                  style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#FFB547' }}
                >
                  AED {restaurant.priceMin}–{restaurant.priceMax}
                </Text>
                <View
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 1.5,
                    backgroundColor: '#3a3a3a',
                  }}
                />
                <Text
                  style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#8A847E' }}
                >
                  {restaurant.cuisineType}
                </Text>
              </MetaRow>

              {tags.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map((t) => (
                    <View
                      key={t}
                      style={{
                        backgroundColor: '#1a0d0d',
                        borderWidth: 1,
                        borderColor: 'rgba(232,39,42,0.30)',
                        borderRadius: 999,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'DMSans_600SemiBold',
                          fontSize: 12,
                          color: '#E8272A',
                        }}
                      >
                        {prettyTag(t)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {typeof restaurant.averageCalories === 'number' ? (
                <MetaRow icon="flame-outline">
                  <Text
                    style={{
                      fontFamily: 'DMSans_500Medium',
                      fontSize: 15,
                      color: '#8A847E',
                    }}
                  >
                    ~{restaurant.averageCalories} kcal (estimated)
                  </Text>
                </MetaRow>
              ) : null}
            </Animated.View>
          </ScrollView>

          {/* --- The payoff CTA row, pinned above the safe area --------- */}
          <Animated.View
            style={[
              {
                gap: 10,
                paddingHorizontal: 20,
                paddingTop: 14,
                paddingBottom: insets.bottom + 14,
                borderTopWidth: 1,
                borderTopColor: '#1C1C1C',
                backgroundColor: '#080808',
              },
              bodyStyle,
            ]}
          >
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ActionTile icon="navigate-outline" label="DIRECTIONS" onPress={onDirections} />
              <ActionTile icon="call-outline" label="RESERVE" onPress={onCall} />
              <ActionTile icon="fast-food-outline" label="ORDER" onPress={onOrder} />
            </View>
            <DoneButton onPress={dismiss} />
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}
