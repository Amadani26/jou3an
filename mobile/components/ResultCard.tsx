import { Image, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { getPlaceholderImage } from '../lib/placeholderImages'
import { usePressed } from '../lib/usePressed'

export interface ResultCardProps {
  rank: number
  name: string
  cuisine: string
  priceRange: string
  area: string
  /** Google Places photo URL; falls back to the placeholder when absent. */
  imageUrl?: string
  // Tap the card body to open the inline confirmation.
  onSelect?: () => void
  // Long-press to open the read-only detail sheet.
  onLongPress?: () => void
  // Quick actions on the compact card (open external links directly).
  onDirections?: () => void
  onCall?: () => void
  onOrder?: () => void
}

function Dot() {
  return (
    <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#3a3a3a' }} />
  )
}

/** One column of the full-width action footer (flex:1 so the three split evenly). */
function ActionCol({
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
    <View style={{ flex: 1 }}>
      <Pressable
        onPress={onPress}
        {...pressHandlers}
        // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          minHeight: 34,
          opacity: pressed ? 0.6 : 1,
        }}
      >
        <Ionicons name={icon} size={18} color="#666" />
        <Text
          style={{
            fontFamily: 'DMSans_600SemiBold',
            fontSize: 9,
            color: '#555',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  )
}

export default function ResultCard({
  rank,
  name,
  cuisine,
  priceRange,
  area,
  imageUrl,
  onSelect,
  onLongPress,
  onDirections,
  onCall,
  onOrder,
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
        marginBottom: 10,
        shadowColor: '#000000',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
    >
      {/* Body — tap to select (confirmation), long-press for detail sheet */}
      <Pressable onPress={onSelect} onLongPress={handleLongPress} delayLongPress={400}>
        {/* Image header with rank overlay */}
        <View
          style={{
            height: 120,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            overflow: 'hidden',
          }}
        >
          <Image
            source={{ uri: imageUrl ?? getPlaceholderImage(rank - 1) }}
            style={{ width: '100%', height: 120 }}
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
        <View style={{ paddingHorizontal: 14, paddingTop: 7, paddingBottom: 7 }}>
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
              marginTop: 2,
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
          </View>
        </View>
      </Pressable>

      {/* Quick action row */}
      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: '#1e1e1e',
          paddingTop: 5,
          paddingBottom: 6,
          paddingHorizontal: 14,
        }}
      >
        <ActionCol icon="navigate-outline" label="Directions" onPress={onDirections} />
        <ActionCol icon="call-outline" label="Reserve" onPress={onCall} />
        <ActionCol icon="fast-food-outline" label="Order" onPress={onOrder} />
      </View>
    </View>
  )
}
