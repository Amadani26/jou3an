import { useEffect } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

const SPRING = { damping: 14, stiffness: 180, mass: 0.6 }

interface Props {
  visible: boolean
  /** The chosen restaurant, named under the headline so the pick is confirmed. */
  name: string
}

/**
 * "Enjoy your meal" celebration — the beat between choosing and the reward.
 *
 * Deliberately BRIEF (~1s, timed by the parent) and deliberately dumb: it owns
 * no navigation and no persistence. By the time it appears the selection has
 * already been sent, so it is a confirmation the user can trust rather than a
 * progress indicator that might be lying.
 *
 * Replaces the old SelectionConfirmCard, whose "This is it →" button made the
 * selection conditional on a second tap.
 */
export default function SelectionCelebration({ visible, name }: Props) {
  const p = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      p.value = 0
      p.value = withSpring(1, SPRING)
    } else {
      p.value = withTiming(0, { duration: 120 })
    }
  }, [visible, p])

  const markStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.6 + p.value * 0.4 }],
  }))
  const copyStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 14 }],
  }))

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#080808',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            gap: 18,
          },
        ]}
      >
        <Animated.View
          style={[
            {
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#1a0d0d',
              alignItems: 'center',
              justifyContent: 'center',
            },
            markStyle,
          ]}
        >
          <Ionicons name="checkmark" size={30} color="#E8272A" />
        </Animated.View>

        <Animated.View style={[{ alignItems: 'center', gap: 8 }, copyStyle]}>
          <Text
            style={{
              // Mobile has no Syne (web-only); DM Sans 800 is the display face.
              fontFamily: 'DMSans_800ExtraBold',
              fontSize: 36,
              color: '#FFFFFF',
              letterSpacing: -1,
              textAlign: 'center',
            }}
          >
            Enjoy your meal
          </Text>
          {name ? (
            <Text
              style={{
                fontFamily: 'DMSans_500Medium',
                fontSize: 15,
                color: '#8A847E',
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {name}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  )
}
