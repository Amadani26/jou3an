import { Pressable, Text } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

interface GhostButtonProps {
  label: string
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export default function GhostButton({ label, onPress, style }: GhostButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderWidth: 1,
          borderColor: '#242424',
          backgroundColor: 'transparent',
          borderRadius: 100,
          paddingVertical: 10,
          paddingHorizontal: 18,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <Text
        style={{
          color: '#8A847E',
          fontFamily: 'DMSans_700Bold',
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
