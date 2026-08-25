import { Pressable, Text } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface RedButtonProps {
  label: string
  onPress?: () => void
  disabled?: boolean
  small?: boolean
  style?: StyleProp<ViewStyle>
}

export default function RedButton({
  label,
  onPress,
  disabled,
  small,
  style,
}: RedButtonProps) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress?.()
  }

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 300 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 })
      }}
      onPress={handlePress}
      disabled={disabled}
      style={[
        {
          backgroundColor: '#E8272A',
          borderRadius: 100,
          paddingVertical: small ? 10 : 14,
          paddingHorizontal: small ? 18 : 24,
          width: small ? undefined : '100%',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.6 : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontFamily: 'DMSans_700Bold',
          fontSize: small ? 11 : 13,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  )
}
