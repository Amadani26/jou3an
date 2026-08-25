import { Text } from 'react-native'
import type { TextProps, TextStyle, StyleProp } from 'react-native'

interface TypoProps extends TextProps {
  size?: number
  style?: StyleProp<TextStyle>
}

export function DisplayText({ size = 28, style, ...rest }: TypoProps) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: 'DMSans_800ExtraBold', color: '#F2EDE8', fontSize: size },
        style,
      ]}
    />
  )
}

export function BodyText({ size = 15, style, ...rest }: TypoProps) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: 'DMSans_400Regular', color: '#F2EDE8', fontSize: size },
        style,
      ]}
    />
  )
}

export function MutedText({ size = 13, style, ...rest }: TypoProps) {
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: 'DMSans_400Regular', color: '#8A847E', fontSize: size },
        style,
      ]}
    />
  )
}
