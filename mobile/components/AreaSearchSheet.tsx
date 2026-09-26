import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import AreaRow from './AreaRow'
import { searchAreas, type AreaSuggestion } from '../lib/api'

const { height: SCREEN_H } = Dimensions.get('window')
const SPRING = { damping: 20, stiffness: 200, mass: 0.6 }

/** Long enough that typing doesn't bill a Text Search on every keystroke. */
const DEBOUNCE_MS = 350

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface Props {
  visible: boolean
  onClose: () => void
  onPick: (suggestion: AreaSuggestion) => void
}

/**
 * "Pick an area" as a bottom sheet.
 *
 * The Decide flow runs the same search inline, in place of its location cards.
 * Food Tinder has a card filling the screen and nothing to swap out, so the
 * search comes to the user instead — same endpoint, same rows, no card space
 * given up.
 */
export default function AreaSearchSheet({ visible, onClose, onPick }: Props) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)

  const translateY = useSharedValue(SCREEN_H)

  useEffect(() => {
    if (visible) {
      setQuery('')
      setSuggestions([])
      setFailed(false)
      translateY.value = SCREEN_H
      translateY.value = withSpring(0, SPRING)
    }
  }, [visible, translateY])

  // Debounced search. The `cancelled` flag drops responses from superseded
  // keystrokes, so a slow early request can never overwrite a newer result.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSuggestions([])
      setSearching(false)
      setFailed(false)
      return
    }

    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const results = await searchAreas(q)
        if (!cancelled) {
          setSuggestions(results)
          setFailed(false)
        }
      } catch {
        if (!cancelled) {
          setSuggestions([])
          setFailed(true)
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const dismiss = () => {
    translateY.value = withTiming(SCREEN_H, { duration: 200 })
    onClose()
  }

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const trimmed = query.trim()

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <AnimatedPressable
          onPress={dismiss}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]}
        />

        <Animated.View
          style={[
            {
              backgroundColor: '#0F0F0F',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderTopWidth: 1,
              borderColor: '#242424',
              paddingBottom: insets.bottom + 16,
              maxHeight: SCREEN_H * 0.7,
            },
            sheetStyle,
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 12,
            }}
          >
            <Text
              style={{ fontFamily: 'DMSans_800ExtraBold', fontSize: 20, color: '#F2EDE8' }}
            >
              Pick an area
            </Text>
            <Pressable onPress={dismiss} hitSlop={12}>
              <Ionicons name="close" size={22} color="#504B47" />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 20 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#141414',
                borderWidth: 1,
                borderColor: '#242424',
                borderRadius: 16,
                paddingHorizontal: 14,
                height: 52,
              }}
            >
              <Ionicons name="search-outline" size={18} color="#504B47" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoFocus
                placeholder="Search any spot in Dubai"
                placeholderTextColor="#504B47"
                returnKeyType="search"
                style={{
                  flex: 1,
                  fontFamily: 'DMSans_500Medium',
                  fontSize: 15,
                  color: '#F2EDE8',
                }}
              />
              {searching ? <ActivityIndicator size="small" color="#504B47" /> : null}
            </View>
          </View>

          <ScrollView
            style={{ marginTop: 6 }}
            contentContainerStyle={{ paddingHorizontal: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {suggestions.map((s) => (
              <AreaRow
                key={`${s.name}-${s.lat}-${s.lng}`}
                suggestion={s}
                onPress={() => onPick(s)}
              />
            ))}

            {/* Empty input says nothing at all — a prompt under a prompt is noise. */}
            {trimmed.length >= 2 && !searching && !failed && suggestions.length === 0 ? (
              <Text
                style={{
                  fontFamily: 'DMSans_400Regular',
                  fontSize: 13,
                  color: '#504B47',
                  paddingVertical: 18,
                }}
              >
                No places found in Dubai.
              </Text>
            ) : null}

            {failed ? (
              <Text
                style={{
                  fontFamily: 'DMSans_400Regular',
                  fontSize: 13,
                  color: '#504B47',
                  paddingVertical: 18,
                }}
              >
                Couldn&apos;t search right now — try again.
              </Text>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}
