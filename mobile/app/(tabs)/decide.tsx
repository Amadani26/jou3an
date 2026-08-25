import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated'
import RedButton from '../../components/RedButton'

type LocationChoice = 'Nearby' | 'Anywhere in Dubai'
type Format = 'Delivery' | 'Dine In'
type Vibe = 'Casual' | 'Fancy'

interface Cuisine {
  name: string
  descriptor: string
}

const CUISINES: Cuisine[] = [
  { name: 'Lebanese', descriptor: 'Mezze & Grills' },
  { name: 'Japanese', descriptor: 'Sushi & Ramen' },
  { name: 'American', descriptor: 'Burgers & Comfort' },
  { name: 'Pakistani', descriptor: 'Curries & Rice' },
  { name: 'Emirati', descriptor: 'Local & Traditional' },
  { name: 'Healthy', descriptor: 'Clean & Light' },
  { name: 'Pizza', descriptor: 'Wood-fired & Delivery' },
  { name: 'Asian', descriptor: 'Pan-Asian Fusion' },
]

const SURPRISE: Cuisine = { name: 'Surprise me', descriptor: 'Let us decide' }

// Chunk the cuisines into rows of two for the 2-column grid.
const CUISINE_ROWS: Cuisine[][] = []
for (let i = 0; i < CUISINES.length; i += 2) {
  CUISINE_ROWS.push(CUISINES.slice(i, i + 2))
}

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

/* ---------------------------------------------------------------- */

function ProgressDots({ active, count = 4 }: { active: number; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 18 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === active ? '#E8272A' : '#242424',
          }}
        />
      ))}
    </View>
  )
}

function BigCard({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  selected?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={() => {
        tap()
        onPress()
      }}
      style={({ pressed }) => [
        {
          backgroundColor: '#141414',
          borderWidth: 1,
          borderColor: selected ? '#E8272A' : '#242424',
          borderRadius: 24,
          paddingVertical: 26,
          paddingHorizontal: 22,
          gap: 10,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Ionicons name={icon} size={28} color={selected ? '#E8272A' : '#F2EDE8'} />
      <Text
        style={{
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: 22,
          color: '#F2EDE8',
          letterSpacing: -0.5,
        }}
      >
        {title}
      </Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#8A847E' }}>
        {subtitle}
      </Text>
    </Pressable>
  )
}

function CuisineCard({
  name,
  descriptor,
  selected,
  onPress,
}: {
  name: string
  descriptor: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={() => {
        tap()
        onPress()
      }}
      style={({ pressed }) => [
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: 1,
          overflow: 'hidden',
          backgroundColor: selected ? '#1a0a0a' : '#111111',
          borderColor: selected ? '#E63946' : '#1e1e1e',
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      {/* Subtle top-light → dark gradient sheen */}
      <LinearGradient
        colors={['rgba(255,255,255,0.025)', 'rgba(0,0,0,0.28)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 16,
          fontWeight: '700',
          color: '#FFFFFF',
          textAlign: 'center',
        }}
      >
        {name}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_400Regular',
          fontSize: 12,
          color: '#555',
          textAlign: 'center',
          marginTop: 5,
        }}
      >
        {descriptor}
      </Text>
    </Pressable>
  )
}

function StepHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 2,
          color: '#504B47',
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: 32,
          color: '#F2EDE8',
          letterSpacing: -1,
        }}
      >
        {title}
      </Text>
    </View>
  )
}

/* ---------------------------------------------------------------- */

export default function DecideScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [step, setStep] = useState(0)
  const [back, setBack] = useState(false)

  const [locationChoice, setLocationChoice] = useState<LocationChoice | null>(null)
  const [cuisines, setCuisines] = useState<string[]>([])
  const [format, setFormat] = useState<Format | null>(null)

  const goNext = () => {
    setBack(false)
    setStep((s) => Math.min(3, s + 1))
  }

  const goBack = () => {
    if (step === 0) {
      // First step — leave the flow back to Home.
      router.navigate('/(tabs)')
      return
    }
    setBack(true)
    setStep((s) => Math.max(0, s - 1))
  }

  // Step 1 — Location (Nearby requests GPS permission; denial falls back silently).
  const chooseLocation = async (choice: LocationChoice) => {
    if (choice === 'Nearby') {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        setLocationChoice(status === 'granted' ? 'Nearby' : 'Anywhere in Dubai')
      } catch {
        setLocationChoice('Anywhere in Dubai')
      }
    } else {
      setLocationChoice('Anywhere in Dubai')
    }
    goNext()
  }

  const toggleCuisine = (c: string) =>
    setCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    )

  const chooseFormat = (f: Format) => {
    setFormat(f)
    goNext()
  }

  // Step 4 — Vibe is the final choice: build the prompt string and go to results.
  const chooseVibe = (vibe: Vibe) => {
    const cuisineParts = cuisines.filter((c) => c !== 'Surprise me')
    const parts = [
      locationChoice ?? 'Anywhere in Dubai',
      ...cuisineParts,
      format ?? 'Dine In',
      vibe,
    ]
    const prompt = parts.join(', ')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push({
      pathname: '/results',
      params: { prompt, chips: '[]' },
    })
  }

  const entering = back ? SlideInLeft : SlideInRight

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      {/* Header: back arrow + progress dots */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={goBack}
          hitSlop={12}
          accessibilityLabel="Back"
          style={{ width: 40, height: 40, justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={22} color="#8A847E" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <ProgressDots active={step} />
        </View>
        {/* Spacer to keep the dots centred */}
        <View style={{ width: 40 }} />
      </View>

      <Animated.View key={step} entering={entering.duration(260)} style={{ flex: 1 }}>
        {step === 0 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
            <StepHeading eyebrow="STEP 1 · LOCATION" title="Where to?" />
            <View style={{ gap: 12 }}>
              <BigCard
                icon="location-outline"
                title="Nearby"
                subtitle="Uses your location · within 5km"
                selected={locationChoice === 'Nearby'}
                onPress={() => chooseLocation('Nearby')}
              />
              <BigCard
                icon="map-outline"
                title="Anywhere in Dubai"
                subtitle="Search across the whole city"
                selected={locationChoice === 'Anywhere in Dubai'}
                onPress={() => chooseLocation('Anywhere in Dubai')}
              />
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 }}>
            <StepHeading eyebrow="STEP 2 · CUISINE" title="Any cuisine?" />

            {/* Grid fills the available vertical space — rows split it evenly */}
            <View style={{ flex: 1, gap: 10 }}>
              {CUISINE_ROWS.map((row, ri) => (
                <View key={ri} style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
                  {row.map((c) => (
                    <CuisineCard
                      key={c.name}
                      name={c.name}
                      descriptor={c.descriptor}
                      selected={cuisines.includes(c.name)}
                      onPress={() => toggleCuisine(c.name)}
                    />
                  ))}
                </View>
              ))}
              {/* "Surprise me" — full-width row, same height as the others */}
              <View style={{ flex: 1, flexDirection: 'row' }}>
                <CuisineCard
                  name={SURPRISE.name}
                  descriptor={SURPRISE.descriptor}
                  selected={cuisines.includes(SURPRISE.name)}
                  onPress={() => toggleCuisine(SURPRISE.name)}
                />
              </View>
            </View>

            <View style={{ marginTop: 16, gap: 14, alignItems: 'center' }}>
              {cuisines.length > 0 ? (
                <RedButton
                  label="Continue →"
                  onPress={goNext}
                  style={{ paddingVertical: 16 }}
                />
              ) : null}
              <Pressable
                onPress={() => {
                  tap()
                  setCuisines([])
                  goNext()
                }}
                hitSlop={10}
              >
                <Text
                  style={{
                    fontFamily: 'DMSans_600SemiBold',
                    fontSize: 13,
                    color: '#444',
                  }}
                >
                  Skip cuisine →
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
            <StepHeading eyebrow="STEP 3 · FORMAT" title="How are you eating?" />
            <View style={{ gap: 12 }}>
              <BigCard
                icon="bicycle-outline"
                title="Delivery"
                subtitle="Bring it to me"
                selected={format === 'Delivery'}
                onPress={() => chooseFormat('Delivery')}
              />
              <BigCard
                icon="restaurant-outline"
                title="Dine In"
                subtitle="I'm heading out"
                selected={format === 'Dine In'}
                onPress={() => chooseFormat('Dine In')}
              />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
            <StepHeading eyebrow="STEP 4 · VIBE" title="What's the vibe?" />
            <View style={{ gap: 12 }}>
              <BigCard
                icon="cafe-outline"
                title="Casual"
                subtitle="Easy and relaxed"
                onPress={() => chooseVibe('Casual')}
              />
              <BigCard
                icon="wine-outline"
                title="Fancy"
                subtitle="Make it special"
                onPress={() => chooseVibe('Fancy')}
              />
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  )
}
