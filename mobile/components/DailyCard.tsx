import { Image, Pressable, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { getPlaceholderImage } from '../lib/placeholderImages'
import { usePressed } from '../lib/usePressed'
import RatingBadge from './RatingBadge'

interface DailyCardProps {
  rank: number
  name: string
  cuisine: string
  area: string
  priceMin: number
  priceMax: number
  /** Google Places photo URL; falls back to the placeholder when absent. */
  imageUrl?: string
  /** Google's 0–5 score. Absent on the static FALLBACK_PICKS, so the badge
   *  simply isn't rendered there. */
  googleRating?: number | null
  /** Review count behind that score; shown in brackets when present. */
  googleRatingCount?: number | null
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
  googleRating,
  googleRatingCount,
  onPress,
}: DailyCardProps) {
  const { pressed, pressHandlers } = usePressed()

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
          height: 160,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: imageUrl ?? getPlaceholderImage(rank - 1) }}
          style={{ width: '100%', height: 160 }}
          resizeMode="cover"
        />
        {/* Dark gradient so the rank stays readable */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }}
          pointerEvents="none"
        />
        {/* Bottom-left: rank + Google's rating, in one row so a wide badge
            can never land on the numeral. */}
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 6,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
          }}
        >
          <Text
            style={{
              fontFamily: 'DMSans_800ExtraBold',
              fontSize: 38,
              lineHeight: 42,
              color: '#E8272A',
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowRadius: 8,
              textShadowOffset: { width: 0, height: 2 },
            }}
          >
            {rank}
          </Text>
          <View style={{ marginBottom: 8 }}>
            <RatingBadge rating={googleRating} count={googleRatingCount} />
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
        <Text
          style={{
            fontFamily: 'DMSans_700Bold',
            fontSize: 15,
            color: '#F2EDE8',
            marginBottom: 4,
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 12,
            color: '#504B47',
            marginBottom: 8,
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
