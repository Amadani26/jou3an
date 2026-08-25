import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DisplayText, MutedText } from '../components/Typography'
import RedButton from '../components/RedButton'
import GhostButton from '../components/GhostButton'

export default function ProScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#080808',
        paddingTop: insets.top + 40,
        paddingHorizontal: 20,
        gap: 14,
      }}
    >
      <DisplayText size={34} style={{ lineHeight: 36 }}>
        Upgrade to Pro
      </DisplayText>
      <MutedText size={15}>
        Unlimited decisions, priority AI and exclusive picks.
      </MutedText>

      <View style={{ flex: 1 }} />
      <RedButton label="Get Pro Access" onPress={() => router.push('/(auth)/signup')} />
      <GhostButton
        label="Maybe later"
        onPress={() => router.back()}
        style={{ alignSelf: 'flex-start' }}
      />
    </View>
  )
}
