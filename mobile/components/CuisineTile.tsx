/**
 * One cuisine in a 2-column grid.
 *
 * Lifted out of decide.tsx so the onboarding taste quiz renders the same tile
 * rather than a lookalike — the two screens ask the same question, and the
 * second one being subtly different is exactly the kind of thing nobody notices
 * until it looks cheap.
 *
 * ⚠️ NOTHING here is centred. Eight centred boxes of identical grey read as a
 * flat stack — the left-aligned chip/name/descriptor column is what gives the
 * grid a direction to scan in.
 */
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { accentFor } from '../lib/cuisines'
import { usePressed } from '../lib/usePressed'

export interface CuisineTileProps {
  name: string
  descriptor: string
  icon: keyof typeof Ionicons.glyphMap
  selected: boolean
  onPress: () => void
  /**
   * What a SELECTED tile means.
   *
   * 'include' (default) is the Decide flow: "I want this". 'exclude' is the
   * taste quiz's step 1: "I'd rather skip this" — the name is struck through
   * and the corner carries an ✕ instead of a dot.
   *
   * ⚠️ This prop exists because the same tick cannot mean both. The quiz's
   * avoid step used the include styling and the first question anyone asked
   * was "do I tap what I want, or what I don't?" — a grid of identically
   * highlighted tiles cannot answer that, so the selected state has to.
   */
  tone?: 'include' | 'exclude'
  /**
   * Dims the tile and blocks the tap — used by the quiz once its 5-pick cap is
   * reached, so the limit is visible before it is hit rather than being a
   * silent no-op.
   */
  disabled?: boolean
}

export default function CuisineTile({
  name,
  descriptor,
  icon,
  selected,
  onPress,
  tone = 'include',
  disabled = false,
}: CuisineTileProps) {
  const { pressed, pressHandlers } = usePressed()
  const scale = useSharedValue(1)

  const accent = accentFor(name)
  const excluded = selected && tone === 'exclude'

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const handlePress = () => {
    if (disabled) return
    // A dip and a spring back — confirmation you can feel at a glance, on the
    // card you actually touched rather than somewhere else on screen.
    scale.value = withSequence(
      withTiming(0.97, { duration: 70 }),
      withSpring(1, { damping: 11, stiffness: 280 }),
    )
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      {...pressHandlers}
      disabled={disabled}
      // NOTE: must be a PLAIN style, not the ({ pressed }) => ... function form
      // — the function form is dropped on Pressable in this setup, which is why
      // cards used to collapse to their text width. See lib/usePressed.
      style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, alignSelf: 'stretch' }}
    >
      {/* Inner View carries all visual styling — Pressable drops backgroundColor
          on some RN versions, so keep the fill/border/radius here. */}
      <Animated.View
        style={[
          {
            flex: 1,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: selected ? '#E63946' : '#242424',
            backgroundColor: selected ? '#1a0d0d' : '#141414',
            paddingHorizontal: 14,
            // ⚠️ Vertical padding is tighter than horizontal, and the spacer
            // below is what absorbs a short row. Four rows of 96 + two utility
            // rows + the button do not fit an iPhone's Decide step, so the card
            // has to stay legible when the grid is squeezed to ~80 rather than
            // clipping its descriptor (which is exactly what it did at first).
            paddingVertical: 9,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            overflow: 'hidden',
            opacity: disabled && !selected ? 0.4 : pressed ? 0.75 : 1,
          },
          popStyle,
        ]}
      >
        {/* Icon chip — the only place a cuisine's own colour appears. */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: selected ? '#E6394622' : '#1F1F1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={excluded ? 'close' : icon}
            size={18}
            color={selected ? '#E63946' : accent}
          />
        </View>

        {/* Breathing room when the row is tall, the first thing to go when it
            is not — so the copy is never the thing that gets cut. */}
        <View style={{ flexGrow: 1, minHeight: 6 }} />

        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'DMSans_700Bold',
            fontSize: 16,
            lineHeight: 19,
            color: selected ? '#E63946' : '#F2EDE8',
            // The one unambiguous way to say "not this one" on a tile that is
            // also highlighted — see the `tone` prop.
            textDecorationLine: excluded ? 'line-through' : 'none',
            textDecorationColor: '#E63946',
          }}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 11,
            lineHeight: 13,
            color: '#8A847E',
            marginTop: 1,
          }}
        >
          {descriptor}
        </Text>

        {/* Corner marker — the selected state read from the far side of the
            grid. A dot for "I want this", an ✕ for "skip this". */}
        {selected ? (
          excluded ? (
            <View style={{ position: 'absolute', top: 7, right: 8 }}>
              <Ionicons name="close-circle" size={15} color="#E63946" />
            </View>
          ) : (
            <View
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#E63946',
              }}
            />
          )
        ) : null}
      </Animated.View>
    </Pressable>
  )
}
