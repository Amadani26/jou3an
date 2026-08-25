import { Image, Pressable, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { getPlaceholderImage } from '../lib/placeholderImages'
import { usePressed } from '../lib/usePressed'

interface DailyCardProps {
  rank: number
  name: string
  cuisine: string
  area: string
  priceMin: number
  priceMax: number
  /** Google Places photo URL; falls back to the placeholder when absent. */
  imageUrl?: string
  /** Shorter card so three fit under the Home hero without a long scroll. */
  compact?: boolean
  onPress?: () => void
}

export default function DailyCard({
  rank,
  name,
  cuisine,
  area,
  priceMin,
  priceMax,
  imageUrl,
  compact,
  onPress,
}: DailyCardProps) {
  const { pressed, pressHandlers } = usePressed()
  const imgH = compact ? 100 : 160

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      style={[
        {
          backgroundColor: '#141414',
          borderWidth: 1,
          borderColor: '#242424',
          borderRadius: 24,
        },
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {/* Image header with rank overlay */}
      <View
        style={{
          height: imgH,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: imageUrl ?? getPlaceholderImage(rank - 1) }}
          style={{ width: '100%', height: imgH }}
          resizeMode="cover"
        />
        {/* Dark gradient so the rank stays readable */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }}
          pointerEvents="none"
        />
        <Text
          style={{
            position: 'absolute',
            left: 16,
            bottom: 6,
            fontFamily: 'DMSans_800ExtraBold',
            fontSize: compact ? 30 : 38,
            color: '#E8272A',
            textShadowColor: 'rgba(0,0,0,0.6)',
            textShadowRadius: 8,
            textShadowOffset: { width: 0, height: 2 },
          }}
        >
          {rank}
        </Text>
      </View>

      {/* Content */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: compact ? 9 : 12,
          paddingBottom: compact ? 12 : 16,
        }}
      >
        <Text
          style={{
            fontFamily: 'DMSans_700Bold',
            fontSize: 15,
            color: '#F2EDE8',
            marginBottom: compact ? 2 : 4,
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 12,
            color: '#504B47',
            marginBottom: compact ? 5 : 8,
          }}
        >
          {cuisine} · {area}
        </Text>
        <Text
          style={{
            fontFamily: 'DMSans_600SemiBold',
            fontSize: 13,
            color: '#FFB547',
          }}
        >
          AED {priceMin}–{priceMax}
        </Text>
      </View>
    </Pressable>
  )
}
