import { useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DisplayText, MutedText } from '../components/Typography'
import Chip from '../components/Chip'
import RedButton from '../components/RedButton'

const CUISINES = ['Lebanese', 'Japanese', 'Italian', 'Indian', 'Emirati', 'Thai']

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (c: string) =>
    setSelected((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    )

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#080808',
        paddingTop: insets.top + 40,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 20,
        gap: 16,
      }}
    >
      <DisplayText size={28}>What do you love?</DisplayText>
      <MutedText size={15}>Pick a few cuisines to get started.</MutedText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {CUISINES.map((c) => (
          <Chip
            key={c}
            label={c}
            active={selected.includes(c)}
            onPress={() => toggle(c)}
          />
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <RedButton label="Let's Eat" onPress={() => router.replace('/(tabs)')} />
    </View>
  )
}
