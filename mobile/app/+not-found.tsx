import { View } from 'react-native'
import { Link, Stack } from 'expo-router'
import { DisplayText, MutedText } from '../components/Typography'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View
        style={{
          flex: 1,
          backgroundColor: '#080808',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
        }}
      >
        <DisplayText size={28}>Lost?</DisplayText>
        <MutedText size={15}>This screen doesn&apos;t exist.</MutedText>
        <Link href="/(tabs)" style={{ color: '#E8272A', marginTop: 8 }}>
          Go home
        </Link>
      </View>
    </>
  )
}
