/**
 * The budget selector, as a bottom sheet.
 *
 * ONE selector, two call sites: Profile → Preferences and the Decide flow's
 * budget pill. Both change the same setting, so they must not be two slightly
 * different lists of bands (the whole reason lib/budget.ts exists).
 *
 * Shaped like RestaurantDetailSheet — RN Modal, dark backdrop, spring slide-up,
 * drag handle, backdrop-tap to dismiss. Deliberately NOT a full screen: this is
 * a four-option setting, not a destination.
 */
import { Modal, Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated'
import { BUDGET_OPTIONS, type BudgetChoice } from '../lib/budget'
import { usePressed } from '../lib/usePressed'

export interface BudgetSheetProps {
  visible: boolean
  /** The band currently in force. 'ANY' is "No budget". */
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

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(160)} style={{ flex: 1 }}>
        {/* Backdrop — tapping anywhere off the sheet dismisses it. */}
        <Pressable
          onPress={onClose}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
        />

        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(180)}
          style={{
            backgroundColor: '#0F0F0F',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: '#242424',
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: insets.bottom + 18,
            gap: 14,
          }}
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

          <View style={{ gap: 8 }}>
            {BUDGET_OPTIONS.map((o) => (
              <BudgetRow
                key={o.value}
                label={o.label}
                sub={o.sub}
                selected={value === o.value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onSelect(o.value)
                }}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

/** One band. Its own component because it holds press state (hooks in a map). */
function BudgetRow({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string
  sub: string
  selected: boolean
  onPress: () => void
}) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable onPress={onPress} {...pressHandlers} style={{ alignSelf: 'stretch' }}>
      {/* Unstyled Pressable, styled inner View — see lib/usePressed. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: selected ? '#E63946' : '#242424',
          backgroundColor: selected ? '#1a0d0d' : '#141414',
          opacity: pressed ? 0.75 : 1,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize: 15,
              color: selected ? '#E63946' : '#F2EDE8',
            }}
          >
            {label}
          </Text>
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 12,
              color: '#8A847E',
              marginTop: 2,
            }}
          >
            {sub}
          </Text>
        </View>

        {selected ? (
          <Ionicons name="checkmark-circle" size={20} color="#E63946" />
        ) : null}
      </View>
    </Pressable>
  )
}
