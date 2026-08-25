import { Pressable, Text } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { usePressed } from '../lib/usePressed'

interface GhostButtonProps {
  label: string
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export default function GhostButton({ label, onPress, style }: GhostButtonProps) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      // Plain array, NOT ({ pressed }) => [...] — see lib/usePressed.
      style={[
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
        { opacity: pressed ? 0.75 : 1 },
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
