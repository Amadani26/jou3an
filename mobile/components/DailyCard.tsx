import { Image, Pressable, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { getPlaceholderImage } from '../lib/placeholderImages'

interface DailyCardProps {
  rank: number
  name: string
  cuisine: string
  area: string
  priceMin: number
  priceMax: number
  onPress?: () => void
}

export default function DailyCard({
  rank,
  name,
  cuisine,
  area,
  priceMin,
  priceMax,
  onPress,
}: DailyCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: '#141414',
          borderWidth: 1,
          borderColor: '#242424',
          borderRadius: 24,
        },
        pressed && { opacity: 0.75 },
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
          source={{ uri: getPlaceholderImage(rank - 1) }}
          style={{ width: '100%', height: 160 }}
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
            fontSize: 38,
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
