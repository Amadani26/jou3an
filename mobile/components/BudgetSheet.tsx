/**
 * The budget selector, as a bottom sheet.
 *
 * ONE selector, two call sites: Profile → Preferences and the Decide flow's
 * budget pill. Both change the same setting, so they must not be two slightly
 * different lists of bands (the whole reason lib/budget.ts exists).
 *
 * RN Modal, dark backdrop, drag handle, backdrop-tap to dismiss. Deliberately
 * NOT a full screen: this is a four-option setting, not a destination.
 *
 * The rows are an `OptionSelector`, so the selection SLIDES from the old band
 * to the new one instead of two rows repainting at once — and so the taste
 * quiz, which asks the same question, animates identically.
 *
 * ⚠️ THE ANIMATION IS DRIVEN BY HAND, not by `entering`/`exiting`, and the two
 * reasons are worth keeping:
 *
 *   1. It used to jump. `SlideInDown.springify()` paints the first frame at the
 *      sheet's FINAL position before the animation takes over, and the spring
 *      (damping 18 / stiffness 180, i.e. underdamped) then overshot the top
 *      edge and wobbled back. Jump, then bounce — on a settings panel.
 *   2. There was no exit at all. `Modal visible={false}` unmounts the tree
 *      immediately, so an `exiting` animation has nothing left to animate; the
 *      sheet vanished mid-air. Holding the Modal mounted through a `rendered`
 *      flag is what lets the dismissal mirror the entrance.
 *
 * One `progress` shared value (0 = down and transparent, 1 = up and opaque)
 * drives both the sheet and the backdrop, so they can never disagree.
 */
import { useEffect, useState } from 'react'
import { Dimensions, Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import OptionSelector from './OptionSelector'
import { BUDGET_OPTIONS, type BudgetChoice } from '../lib/budget'

const { height: SCREEN_H } = Dimensions.get('window')

/** Up. Ease-out so it arrives decelerating and stops dead — no overshoot. */
const OPEN_MS = 280
/** Down. Slightly quicker, ease-in: leaving should not dawdle. */
const CLOSE_MS = 220
const EASE_OUT = Easing.out(Easing.cubic)
const EASE_IN = Easing.in(Easing.cubic)

export interface BudgetSheetProps {
  visible: boolean
  /** The band currently in force. 'ANY' is "Any budget". */
  value: BudgetChoice
  onSelect: (choice: BudgetChoice) => void
  onClose: () => void
  /**
   * Shown under the title. The caller owns this line because the consequence
   * differs: from Profile it changes the saved setting, from the Decide flow it
   * changes the setting AND the decision being made right now.
   */
  note?: string
}

export default function BudgetSheet({
  visible,
  value,
  onSelect,
  onClose,
  note,
}: BudgetSheetProps) {
  const insets = useSafeAreaInsets()

  /** Keeps the Modal mounted through the exit, so there is something to slide. */
  const [rendered, setRendered] = useState(visible)
  /**
   * Whether the sheet's real height is known yet.
   *
   * ⚠️ The entrance waits for it. `progress` interpolates against the measured
   * height, so starting before the measurement would slide the sheet in from
   * the wrong offset — which is the "jump" in a different costume.
   */
  const [measured, setMeasured] = useState(false)

  const progress = useSharedValue(0)
  /** Off-screen until measured, so nothing can flash at the wrong position. */
  const sheetH = useSharedValue(SCREEN_H)

  useEffect(() => {
    if (visible) setRendered(true)
  }, [visible])

  useEffect(() => {
    if (!rendered) return

    if (visible) {
      if (!measured) return
      progress.value = withTiming(1, { duration: OPEN_MS, easing: EASE_OUT })
      return
    }

    progress.value = withTiming(
      0,
      { duration: CLOSE_MS, easing: EASE_IN },
      (finished) => {
        // Unmount only once it has actually left, or the next open would
        // start from a half-dismissed position.
        if (finished) runOnJS(setRendered)(false)
      },
    )
  }, [visible, rendered, measured, progress])

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetH.value }],
  }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }))

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* Backdrop — tapping anywhere off the sheet dismisses it. Its fade is
            the same `progress`, so it can never lag the sheet. */}
        <Animated.View style={[{ flex: 1 }, backdropStyle]}>
          <Pressable
            onPress={onClose}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
          />
        </Animated.View>

        <Animated.View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height
            if (h > 0 && !measured) {
              sheetH.value = h
              // Park it exactly one height below the edge before the first
              // frame of the entrance, rather than a screen away.
              progress.value = 0
              setMeasured(true)
            }
          }}
          style={[
            {
              backgroundColor: '#0F0F0F',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: '#242424',
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: insets.bottom + 18,
              gap: 14,
            },
            sheetStyle,
          ]}
        >
          {/* Drag handle — reads as "this came up, it can go down". */}
          <View
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#242424',
              alignSelf: 'center',
            }}
          />

          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontFamily: 'DMSans_800ExtraBold',
                fontSize: 20,
                letterSpacing: -0.5,
                color: '#F2EDE8',
              }}
            >
              Usual spend
            </Text>
            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 12,
                lineHeight: 17,
                color: '#8A847E',
              }}
            >
              {/* ⚠️ Never promise a cap — a band leans the picks, it does not
                  filter. See lib/budget.ts. */}
              {note ?? 'Per person, everyday meals. It nudges our picks — it never caps them.'}
            </Text>
          </View>

          <OptionSelector
            options={BUDGET_OPTIONS.map((o) => ({
              value: o.value,
              title: o.label,
              sub: o.sub,
            }))}
            value={value}
            onSelect={(choice) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onSelect(choice)
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  )
}
