import { Pressable, Text } from 'react-native'
import * as Haptics from 'expo-haptics'

interface ChipProps {
  label: string
  active?: boolean
  compact?: boolean
  onPress?: () => void
}

export default function Chip({ label, active, compact, onPress }: ChipProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.()
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: compact ? 12 : 14,
          paddingVertical: compact ? 7 : 8,
          borderRadius: 100,
          borderWidth: 1,
          backgroundColor: active ? 'rgba(232,39,42,0.06)' : '#141414',
          borderColor: active ? 'rgba(232,39,42,0.45)' : '#242424',
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text
        style={{
          fontFamily: 'DMSans_600SemiBold',
          fontSize: 13,
          fontWeight: '600',
          color: active ? '#E8272A' : '#8A847E',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
