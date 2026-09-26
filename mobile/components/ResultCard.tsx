import { Image, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { getPlaceholderImage } from '../lib/placeholderImages'
import { prettyDistance } from '../lib/api'

export interface ResultCardProps {
  rank: number
  name: string
  cuisine: string
  priceRange: string
  area: string
  /** Km from the user, shown next to the area when known. */
  distanceKm?: number
  /**
   * DecisionEngine v2's one-line "why this pick". Absent on the v1 path, so the
   * card must lay out correctly without it.
   */
  reason?: string
  /** Google Places photo URL; falls back to the placeholder when absent. */
  imageUrl?: string
  /**
   * Tap the card body — in results.tsx this IS the decision: it saves the
   * SELECT and opens the full-screen reward.
   */
  onSelect?: () => void
  /** Long-press for the read-only detail sheet. Looking is not choosing. */
  onLongPress?: () => void
}

/**
 * ⚠️ NO ACTION ROW. Directions / Reserve / Order live on the full-screen
 * SelectionReward, which is only reachable by choosing — so an action can no
 * longer be taken from a card the user never picked. It also gave the compact
 * card ~46pt back, which is why the image and padding here are roomier than
 * they were.
 */

function Dot() {
  return (
    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#3a3a3a' }} />
  )
}

export default function ResultCard({
  rank,
  name,
  cuisine,
  priceRange,
  area,
  distanceKm,
  reason,
  imageUrl,
  onSelect,
  onLongPress,
}: ResultCardProps) {
  const handleLongPress = onLongPress
    ? () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onLongPress()
      }
    : undefined
  return (
    <View
      style={{
        backgroundColor: '#111111',
        borderRadius: 16,
        marginHorizontal: 20,
        marginBottom: 12,
        shadowColor: '#000000',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
    >
      {/* Body — tap to select (the decision), long-press for the preview sheet */}
      <Pressable onPress={onSelect} onLongPress={handleLongPress} delayLongPress={400}>
        {/* Image header with rank overlay */}
        <View
          style={{
            height: 132,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            overflow: 'hidden',
          }}
        >
          <Image
            source={{ uri: imageUrl ?? getPlaceholderImage(rank - 1) }}
            style={{ width: '100%', height: 132 }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }}
            pointerEvents="none"
          />
          <Text
            style={{
              position: 'absolute',
              left: 14,
              bottom: 6,
              fontFamily: 'DMSans_800ExtraBold',
              fontSize: 34,
              lineHeight: 38,
              color: '#E63946',
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowRadius: 8,
              textShadowOffset: { width: 0, height: 2 },
            }}
          >
            {rank}
          </Text>
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: 16, paddingTop: 11, paddingBottom: 13 }}>
          <Text
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize: 16,
              fontWeight: '700',
              color: '#FFFFFF',
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {name}
          </Text>

          {/* Cuisine · price · area */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 4,
            }}
          >
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#888888' }}>
              {cuisine}
            </Text>
            <Dot />
            <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: '#F4A261' }}>
              {priceRange}
            </Text>
            <Dot />
            <Ionicons name="location-outline" size={11} color="#888888" />
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#888888' }}>
              {area}
            </Text>
            {prettyDistance(distanceKm) ? (
              <>
                <Dot />
                <Text
                  style={{
                    fontFamily: 'DMSans_600SemiBold',
                    fontSize: 12,
                    color: '#8A847E',
                  }}
                >
                  {prettyDistance(distanceKm)}
                </Text>
              </>
            ) : null}
          </View>

          {/* Why this pick — engine v2 only, so it is rendered conditionally. */}
          {reason ? (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: 'rgba(232,39,42,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(232,39,42,0.30)',
              }}
            >
              <Text
                style={{
                  fontFamily: 'DMSans_500Medium',
                  fontSize: 11,
                  color: '#E8272A',
                }}
                numberOfLines={1}
              >
                {reason}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  )
}
