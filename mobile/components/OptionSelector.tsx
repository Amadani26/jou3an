import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { usePressed } from '../lib/usePressed'

export interface SelectOption<V extends string> {
  value: V
  title: string
  sub?: string
  icon?: keyof typeof Ionicons.glyphMap
}

/** Uniform, so the sliding highlight's offset is arithmetic rather than measured. */
export const OPTION_ROW_H = 64
const GAP = 8
const SPRING = { damping: 18, stiffness: 200, mass: 0.6 }

const UNSELECTED_BG = '#141414'
const SELECTED_BG = '#1a0d0d'
const UNSELECTED_BORDER = '#242424'
const SELECTED_BORDER = '#E63946'
const TITLE = '#F2EDE8'
const ACCENT = '#E63946'

/**
 * A single-choice list where the selection SLIDES between rows.
 *
 * ⚠️ One highlight, not a highlight per row. Every row used to repaint its own
 * border and fill the instant the value changed, so switching options was two
 * simultaneous hard cuts — the old selection vanished and the new one appeared,
 * with nothing connecting them. A single highlight that travels makes the two
 * events one movement, which is the thing the user is actually doing: moving a
 * choice from there to here.
 *
 * That is also why the rows themselves are TRANSPARENT and the highlight sits
 * behind them: a row that painted its own fill would cover the travelling one.
 * Row height is fixed (OPTION_ROW_H) so the highlight's position is
 * `index * (height + gap)` — measuring four rows to animate between them would
 * be a layout pass per frame for a number that cannot change.
 *
 * Shared by the taste quiz (budget + adventurousness), the budget sheet that
 * Profile and the Decide pill both open, so the transition is identical
 * wherever a band is chosen.
 */
export default function OptionSelector<V extends string>({
  options,
  value,
  onSelect,
}: {
  options: SelectOption<V>[]
  /** null = nothing chosen yet; the highlight stays hidden. */
  value: V | null
  onSelect: (value: V) => void
}) {
  const index = options.findIndex((o) => o.value === value)
  const selected = index >= 0

  // Held separately from `index` so the highlight can fade out in place rather
  // than snapping to row 0 when the selection is cleared.
  const position = useSharedValue(selected ? index : 0)
  const presence = useSharedValue(selected ? 1 : 0)

  useEffect(() => {
    if (selected) {
      // First appearance drops in without travelling from a row nobody chose.
      if (presence.value === 0) position.value = index
      else position.value = withSpring(index, SPRING)
      presence.value = withTiming(1, { duration: 160 })
    } else {
      presence.value = withTiming(0, { duration: 160 })
    }
  }, [index, selected, position, presence])

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: position.value * (OPTION_ROW_H + GAP) }],
    opacity: presence.value,
  }))

  return (
    <View style={{ gap: GAP }}>
      {/* The travelling highlight, behind every row. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: OPTION_ROW_H,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: SELECTED_BORDER,
            backgroundColor: SELECTED_BG,
          },
          highlightStyle,
        ]}
      />

      {options.map((o, i) => (
        <OptionRow
          key={o.value}
          option={o}
          selected={selected && i === index}
          onPress={() => onSelect(o.value)}
        />
      ))}
    </View>
  )
}

/** One row. Its own component because it holds press state (hooks in a map). */
function OptionRow<V extends string>({
  option,
  selected,
  onPress,
}: {
  option: SelectOption<V>
  selected: boolean
  onPress: () => void
}) {
  const { pressed, pressHandlers } = usePressed()

  // Colour is the one thing the row still animates itself: the highlight can
  // travel behind the text, but the text has to meet it when it arrives.
  const t = useDerivedValue(() => withTiming(selected ? 1 : 0, { duration: 180 }))

  const titleStyle = useAnimatedStyle(() => ({
    color: interpolateColor(t.value, [0, 1], [TITLE, ACCENT]),
  }))
  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], ['#1F1F1F', '#E6394622']),
  }))
  const iconStyle = useAnimatedStyle(() => ({
    color: interpolateColor(t.value, [0, 1], ['#8A847E', ACCENT]),
  }))
  const checkStyle = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scale: 0.7 + t.value * 0.3 }],
  }))
  // Only the UNSELECTED border is drawn here; the selected one belongs to the
  // travelling highlight, and painting both would double the stroke.
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(t.value, [0, 1], [UNSELECTED_BORDER, 'transparent']),
    backgroundColor: interpolateColor(t.value, [0, 1], [UNSELECTED_BG, 'transparent']),
  }))

  return (
    // Unstyled Pressable, styled inner view — see lib/usePressed.
    <Pressable onPress={onPress} {...pressHandlers} style={{ alignSelf: 'stretch' }}>
      <Animated.View
        style={[
          {
            height: OPTION_ROW_H,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            paddingHorizontal: 16,
            borderRadius: 16,
            borderWidth: 1,
            opacity: pressed ? 0.75 : 1,
          },
          borderStyle,
        ]}
      >
        {option.icon ? (
          <Animated.View
            style={[
              {
                width: 34,
                height: 34,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
              },
              chipStyle,
            ]}
          >
            <AnimatedIcon name={option.icon} size={18} style={iconStyle} />
          </Animated.View>
        ) : null}

        <View style={{ flex: 1 }}>
          <Animated.Text
            style={[
              { fontFamily: 'DMSans_700Bold', fontSize: 15 },
              titleStyle,
            ]}
          >
            {option.title}
          </Animated.Text>
          {option.sub ? (
            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 12,
                color: '#8A847E',
                marginTop: 2,
              }}
            >
              {option.sub}
            </Text>
          ) : null}
        </View>

        <Animated.View style={checkStyle}>
          <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}

const AnimatedIcon = Animated.createAnimatedComponent(Ionicons)
