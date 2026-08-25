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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { prettyTag, visibleTags, photoUrls, type Restaurant, prettyArea } from '../lib/api'
import { getPlaceholderImage } from '../lib/placeholderImages'
import RedButton from './RedButton'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const CARD_W = SCREEN_W - 40
const SPRING = { damping: 18, stiffness: 200, mass: 0.7 }

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface Props {
  visible: boolean
  restaurant: Restaurant | null
  rank: number
  /** When true, a full-screen "Enjoy your meal" flash covers the card. */
  flashVisible: boolean
  onClose: () => void
  onConfirm: () => void
}

/**
 * Edge-to-edge paging carousel inside the card. Uses the restaurant's real
 * Google Places photos when it has been synced, else placeholder food photos.
 */
function Carousel({ rank, photos }: { rank: number; photos: string[] }) {
  const [active, setActive] = useState(0)
  const images = photos.length
    ? photos
    : [
        getPlaceholderImage(rank - 1),
        getPlaceholderImage(rank),
        getPlaceholderImage(rank + 1),
      ]
  return (
    <View style={{ marginTop: 16 }}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) =>
          setActive(Math.round(e.nativeEvent.contentOffset.x / CARD_W))
        }
        renderItem={({ item }) => (
          <View style={{ width: CARD_W, paddingHorizontal: 20 }}>
            <Image
              source={{ uri: item }}
              style={{ width: '100%', height: 150, borderRadius: 16 }}
              resizeMode="cover"
            />
          </View>
        )}
      />
      <View
        style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}
      >
        {images.map((_, i) => (
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
 * Full-screen selection confirmation. The tapped result "expands" into a
 * centered card (spring scale-up + rise) over a dark backdrop, showing the full
 * detail inline plus a single "This is it →" confirm button. Confirming shows a
 * full-screen "Enjoy your meal" flash (driven by the parent) before navigating.
 */
export default function SelectionConfirmCard({
  visible,
  restaurant,
  rank,
  flashVisible,
  onClose,
  onConfirm,
}: Props) {
  const p = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      p.value = 0
      p.value = withSpring(1, SPRING)
    } else {
      p.value = withTiming(0, { duration: 160 })
    }
  }, [visible, p])

  const backdropStyle = useAnimatedStyle(() => ({ opacity: p.value }))
  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [
      { translateY: (1 - p.value) * 30 },
      { scale: 0.9 + p.value * 0.1 },
    ],
  }))

  if (!restaurant) return null
  const tags = visibleTags(restaurant.tags)

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
        {/* Dark backdrop */}
        <AnimatedPressable
          onPress={onClose}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: 'rgba(0,0,0,0.85)' },
            backdropStyle,
          ]}
        />

        {/* Expanded card */}
        <Animated.View
          style={[
            {
              width: CARD_W,
              maxHeight: SCREEN_H * 0.82,
              backgroundColor: '#141414',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: '#242424',
              overflow: 'hidden',
            },
            cardStyle,
          ]}
        >
          {/* Dismiss X */}
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              zIndex: 10,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(0,0,0,0.5)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color="#F2EDE8" />
          </Pressable>

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Confirmation header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingRight: 52 }}>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#666' }}>
                You&apos;re going to
              </Text>
              <Text
                style={{
                  fontFamily: 'DMSans_700Bold',
                  fontSize: 24,
                  fontWeight: '700',
                  color: '#FFFFFF',
                  letterSpacing: -0.5,
                  marginTop: 2,
                }}
              >
                {restaurant.name}
              </Text>
            </View>

            {/* Image carousel */}
            <Carousel rank={rank} photos={photoUrls(restaurant)} />

            <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
              {/* Cuisine · price · area */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#8A847E' }}>
                  {restaurant.cuisineType}
                </Text>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#242424' }} />
                <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#FFB547' }}>
                  AED {restaurant.priceMin}–{restaurant.priceMax}
                </Text>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#242424' }} />
                <Ionicons name="location-outline" size={13} color="#8A847E" />
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#8A847E' }}>
                  {prettyArea(restaurant.area)}
                </Text>
              </View>

              {/* Rating */}
              {typeof restaurant.ratingScore === 'number' ? (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#2DCE89' }} />
                  <Text style={{ fontFamily: 'DMSans_800ExtraBold', fontSize: 18, color: '#F2EDE8' }}>
                    {restaurant.ratingScore.toFixed(1)}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#504B47' }}>
                    rating
                  </Text>
                </View>
              ) : null}

              {/* Tags */}
              {tags.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                  {tags.map((t) => (
                    <View
                      key={t}
                      style={{
                        backgroundColor: '#2a0a0a',
                        borderRadius: 100,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: '#E8272A' }}>
                        {prettyTag(t)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Calories */}
              {typeof restaurant.averageCalories === 'number' ? (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}
                >
                  <Ionicons name="flame-outline" size={15} color="#8A847E" />
                  <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#8A847E' }}>
                    ~{restaurant.averageCalories} kcal (estimated)
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          {/* Single confirm CTA pinned at the bottom of the card */}
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: '#1e1e1e',
              paddingTop: 14,
              paddingBottom: 16,
              paddingHorizontal: 20,
            }}
          >
            <RedButton
              label="This is it →"
              onPress={onConfirm}
              style={{ paddingVertical: 18 }}
            />
          </View>
        </Animated.View>

        {/* Full-screen "Enjoy your meal" flash on confirm */}
        {flashVisible ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: '#080808',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
              },
            ]}
          >
            <Text
              style={{
                // Mobile has no Syne (web-only); DM Sans 800 is the display face.
                fontFamily: 'DMSans_800ExtraBold',
                fontSize: 40,
                color: '#FFFFFF',
                letterSpacing: -1,
                textAlign: 'center',
              }}
            >
              Enjoy your meal
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  )
}
