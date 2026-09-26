import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import type { AreaSuggestion } from '../lib/api'
import { usePressed } from '../lib/usePressed'

/**
 * One hit in a "Pick an area" search.
 *
 * Shared by the Decide flow's inline search and Food Tinder's sheet — the two
 * presentations differ, the row does not, and a result row that looked
 * different in the two places would read as two different features.
 */
export default function AreaRow({
  suggestion,
  onPress,
}: {
  suggestion: AreaSuggestion
  onPress: () => void
}) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      {...pressHandlers}
      // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1C1C1C',
        opacity: pressed ? 0.75 : 1,
      }}
    >
      <Ionicons name="location-outline" size={18} color="#504B47" />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: '#F2EDE8' }}
        >
          {suggestion.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 12,
            color: '#8A847E',
            marginTop: 2,
          }}
        >
          {suggestion.area}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#3a3a3a" />
    </Pressable>
  )
}
