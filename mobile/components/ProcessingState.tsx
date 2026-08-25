import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

const WORDS = ['Thinking...', 'Deciding...', 'Almost...']

function BounceDot({ delay }: { delay: number }) {
  const ty = useSharedValue(0)

  useEffect(() => {
    ty.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-9, { duration: 300 }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
      ),
    )
  }, [ty, delay])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }))

  return (
    <Animated.View
      style={[
        { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E8272A' },
        style,
      ]}
    />
  )
}

export default function ProcessingState() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % WORDS.length)
    }, 700)
    return () => clearInterval(id)
  }, [])

  return (
    <View style={{ alignItems: 'center', gap: 20, paddingVertical: 48 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <BounceDot delay={0} />
        <BounceDot delay={150} />
        <BounceDot delay={300} />
      </View>
      <Text
        style={{
          fontFamily: 'DMSans_600SemiBold',
          fontSize: 18,
          color: '#F2EDE8',
        }}
      >
        {WORDS[index]}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_500Medium',
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: '#504B47',
        }}
      >
        Analysing your vibe
      </Text>
    </View>
  )
}
