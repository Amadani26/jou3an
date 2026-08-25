import { Pressable, View } from 'react-native'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

interface CardProps {
  children?: ReactNode
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

const baseStyle: ViewStyle = {
  backgroundColor: '#141414',
  borderWidth: 1,
  borderColor: '#242424',
  borderRadius: 24,
  overflow: 'hidden',
}

export default function Card({ children, onPress, style }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          pressed && { opacity: 0.75 },
          style,
        ]}
      >
        {children}
      </Pressable>
    )
  }
  return <View style={[baseStyle, style]}>{children}</View>
}
