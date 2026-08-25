import { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  FlatList,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { prettyTag, visibleTags, prettyDistance } from '../lib/api'
import { usePressed } from '../lib/usePressed'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const SPRING = { damping: 20, stiffness: 200, mass: 0.6 }

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export interface RestaurantDetailSheetProps {
  visible: boolean
  onClose: () => void
  name: string
  cuisine: string
  priceRange: string
  area: string
  tags?: string[]
  /** Google's 0–5 rating. Omit/null hides the rating row entirely. */
  googleRating?: number | null
  /** Km from the user, shown next to the area when known. */
  distanceKm?: number
  calories?: number | null
  description?: string | null
  /** Photo URLs — when provided, real Images render instead of placeholder slots. */
  images?: string[]
  onDirections?: () => void
  onCall?: () => void
  onOrder?: () => void
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
}) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        minHeight: 44,
        paddingHorizontal: 4,
        opacity: pressed ? 0.6 : 1,
      }}
    >
      <Ionicons name={icon} size={22} color="#999999" />
      <Text
        numberOfLines={1}
        style={{
          fontFamily: 'DMSans_600SemiBold',
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
          color: '#999999',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Full-width paging carousel at the top of the sheet. Renders real Images when
 * `images` is passed, otherwise 3 placeholder slots (ready for Google Places URLs).
 */
function ImageCarousel({ images }: { images?: string[] }) {
  const [active, setActive] = useState(0)
  const slides: (string | null)[] =
    images && images.length > 0 ? images : [null, null, null]

  return (
    <View style={{ marginTop: 14 }}>
      <FlatList
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) =>
          setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
        }
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_W, paddingHorizontal: 22 }}>
            {item ? (
              <Image
                source={{ uri: item }}
                style={{ width: '100%', height: 180, borderRadius: 16 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  height: 180,
                  borderRadius: 16,
                  backgroundColor: '#1A1A1A',
                  borderWidth: 1,
                  borderColor: '#242424',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera-outline" size={22} color="#2A2A2A" />
              </View>
            )}
          </View>
        )}
      />

      {/* Dot pagination */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
          marginTop: 12,
        }}
      >
        {slides.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === active ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === active ? '#E8272A' : '#242424',
            }}
          />
        ))}
      </View>
    </View>
  )
}

/**
 * Bottom-sheet restaurant detail overlay. Slides up with a spring, dims the
 * backdrop, and can be dismissed by tapping the backdrop or swiping the header
 * down. Reusable — used by ResultCard's long-press and (future) the Tinder screen.
 */
export default function RestaurantDetailSheet({
  visible,
  onClose,
  name,
  cuisine,
  priceRange,
  area,
  tags = [],
  googleRating,
  distanceKm,
  calories,
  description,
  images,
  onDirections,
  onCall,
  onOrder,
}: RestaurantDetailSheetProps) {
  const insets = useSafeAreaInsets()
  const translateY = useSharedValue(SCREEN_H)

  useEffect(() => {
    if (visible) {
      translateY.value = SCREEN_H
      translateY.value = withSpring(0, SPRING)
    }
  }, [visible, translateY])

  const dismiss = () => {
    translateY.value = withTiming(SCREEN_H, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)()
    })
  }

  // Drag-to-dismiss on the header/handle area (keeps the scroll view free).
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        translateY.value = withTiming(SCREEN_H, { duration: 200 }, (finished) => {
          if (finished) runOnJS(onClose)()
        })
      } else {
        translateY.value = withSpring(0, SPRING)
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, SCREEN_H],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }))

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <AnimatedPressable
            onPress={dismiss}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(0,0,0,0.7)' },
              backdropStyle,
            ]}
          />

          {/* Sheet */}
          <Animated.View
            style={[
              {
                backgroundColor: '#141414',
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderTopWidth: 1,
                borderColor: '#242424',
                maxHeight: SCREEN_H * 0.85,
                overflow: 'hidden',
              },
              sheetStyle,
            ]}
          >
            {/* Drag handle (drag it down to dismiss) */}
            <GestureDetector gesture={pan}>
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#333',
                  }}
                />
              </View>
            </GestureDetector>

            {/* Scrollable content — flexShrink bounds it under the sheet's maxHeight */}
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 0 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Image carousel */}
              <ImageCarousel images={images} />

              <View style={{ paddingHorizontal: 22, marginTop: 18 }}>
                {/* Name + meta */}
              <Text
                style={{
                  fontFamily: 'DMSans_800ExtraBold',
                  fontSize: 30,
                  color: '#F2EDE8',
                  letterSpacing: -1,
                }}
              >
                {name}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                  marginTop: 8,
                  marginBottom: 18,
                }}
              >
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#8A847E' }}>
                  {cuisine}
                </Text>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#242424' }} />
                <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#FFB547' }}>
                  {priceRange}
                </Text>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#242424' }} />
                <Ionicons name="location-outline" size={13} color="#8A847E" />
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#8A847E' }}>
                  {area}
                </Text>
                {prettyDistance(distanceKm) ? (
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
                        fontFamily: 'DMSans_600SemiBold',
                        fontSize: 14,
                        color: '#8A847E',
                      }}
                    >
                      {prettyDistance(distanceKm)}
                    </Text>
                  </>
                ) : null}
              </View>

              {/* Google rating (0–5). Hidden entirely when not synced. */}
              {typeof googleRating === 'number' ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="star" size={16} color="#FFB547" />
                  <Text
                    style={{
                      fontFamily: 'DMSans_800ExtraBold',
                      fontSize: 18,
                      color: '#F2EDE8',
                    }}
                  >
                    {googleRating.toFixed(1)}
                  </Text>
                  <Text
                    style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#504B47' }}
                  >
                    on Google
                  </Text>
                </View>
              ) : null}

              {/* Tags */}
              {visibleTags(tags).length > 0 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  {visibleTags(tags).map((t) => (
                    <View
                      key={t}
                      style={{
                        backgroundColor: '#2a0a0a',
                        borderRadius: 100,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'DMSans_600SemiBold',
                          fontSize: 11,
                          color: '#E8272A',
                        }}
                      >
                        {prettyTag(t)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Calories */}
              {typeof calories === 'number' ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  <Ionicons name="flame-outline" size={15} color="#8A847E" />
                  <Text
                    style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#8A847E' }}
                  >
                    ~{calories} kcal (estimated)
                  </Text>
                </View>
              ) : null}

              {/* Description */}
              {description ? (
                <Text
                  style={{
                    fontFamily: 'DMSans_400Regular',
                    fontSize: 15,
                    lineHeight: 22,
                    color: '#8A847E',
                  }}
                >
                  {description}
                </Text>
              ) : null}
              </View>
              </ScrollView>

              {/* Action row — direct sibling of ScrollView, inside the sheet container */}
              <View
                style={{
                  flexDirection: 'row',
                  borderTopWidth: 1,
                  borderTopColor: '#1e1e1e',
                  paddingTop: 12,
                  paddingBottom: insets.bottom + 16,
                  paddingHorizontal: 24,
                  justifyContent: 'space-between',
                }}
              >
                <ActionButton icon="navigate-outline" label="DIRECTIONS" onPress={onDirections} />
                <ActionButton icon="call-outline" label="RESERVE" onPress={onCall} />
                <ActionButton icon="fast-food-outline" label="ORDER" onPress={onOrder} />
              </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}
