import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated'
import RedButton from '../../components/RedButton'
import { usePressed } from '../../lib/usePressed'

type LocationChoice = 'Nearby' | 'Anywhere in Dubai'
type Format = 'Delivery' | 'Dine In'
type Vibe = 'Casual' | 'Fancy'

interface Cuisine {
  name: string
  descriptor: string
  icon: keyof typeof Ionicons.glyphMap
}

const CUISINES: Cuisine[] = [
  { name: 'Lebanese', descriptor: 'Mezze & Grills', icon: 'flame-outline' },
  { name: 'Japanese', descriptor: 'Sushi & Ramen', icon: 'fish-outline' },
  { name: 'American', descriptor: 'Burgers & Comfort', icon: 'fast-food-outline' },
  { name: 'Pakistani', descriptor: 'Curries & Rice', icon: 'restaurant-outline' },
  { name: 'Emirati', descriptor: 'Local & Traditional', icon: 'moon-outline' },
  { name: 'Healthy', descriptor: 'Clean & Light', icon: 'leaf-outline' },
  { name: 'Pizza', descriptor: 'Wood-fired & Delivery', icon: 'pizza-outline' },
  { name: 'Asian', descriptor: 'Pan-Asian Fusion', icon: 'nutrition-outline' },
]

const SURPRISE: Cuisine = {
  name: 'Surprise me',
  descriptor: 'Let us decide',
  icon: 'shuffle-outline',
}

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
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={() => {
        tap()
        onPress()
      }}
      {...pressHandlers}
      // Plain style, NOT the ({ pressed }) => ... function form — that form is
      // dropped on Pressable here, which left these cards with no fill/border.
      style={{
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: selected ? '#E8272A' : '#242424',
        borderRadius: 24,
        paddingVertical: 26,
        paddingHorizontal: 22,
        gap: 10,
        opacity: pressed ? 0.75 : 1,
      }}
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
  icon,
  selected,
  onPress,
  surprise,
}: {
  name: string
  descriptor: string
  icon: keyof typeof Ionicons.glyphMap
  selected: boolean
  onPress: () => void
  surprise?: boolean
}) {
  // Icon + name go red on selection; "Surprise me" is red at rest.
  const accent = selected || surprise ? '#E63946' : undefined
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={() => {
        tap()
        onPress()
      }}
      {...pressHandlers}
      style={
        // NOTE: must be a PLAIN style, not the ({ pressed }) => ... function
        // form — the function form is dropped on Pressable in this setup, which
        // is why cards used to collapse to their text width. Press feedback is
        // handled by the inner View via onPressIn/onPressOut instead.
        surprise
          ? { alignSelf: 'stretch', height: 64 }
          : { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignSelf: 'stretch' }
      }
    >
      {/* Inner View carries all visual styling — Pressable drops backgroundColor
          on some RN versions, so keep the fill/border/radius here. flex: 1 makes
          it fill whatever width/height the Pressable was given. */}
      <View
        style={{
          flex: 1,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: selected ? '#E63946' : surprise ? '#E6394666' : '#242424',
          backgroundColor: selected ? '#1a0d0d' : '#141414',
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 14,
          gap: surprise ? 0 : 8,
          flexDirection: surprise ? 'row' : 'column',
          opacity: pressed ? 0.75 : 1,
        }}
      >
        <Ionicons
          name={icon}
          size={surprise ? 18 : 26}
          color={accent ?? '#8A847E'}
          style={surprise ? { marginRight: 10 } : undefined}
        />

        <View style={surprise ? undefined : { width: '100%' }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize: 16,
              color: accent ?? '#F2EDE8',
              textAlign: surprise ? 'left' : 'center',
            }}
          >
            {name}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 11,
              color: '#8A847E',
              textAlign: surprise ? 'left' : 'center',
              marginTop: 2,
            }}
          >
            {descriptor}
          </Text>
        </View>
      </View>
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
  // Cuisine is MULTI-select: tapping toggles, "Continue →" advances.
  const [cuisines, setCuisines] = useState<string[]>([])
  // "Surprise me" is mutually exclusive with any picked cuisine.
  const [surprise, setSurprise] = useState(false)
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

  // Step 2 — tapping a cuisine toggles it; the flow waits for "Continue →".
  const toggleCuisine = (name: string) => {
    setSurprise(false)
    setCuisines((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    )
  }

  // "Surprise me" and "Skip" both advance immediately and clear any picks —
  // neither contributes a cuisine to the prompt.
  const chooseSurprise = () => {
    setCuisines([])
    setSurprise(true)
    goNext()
  }

  const skipCuisine = () => {
    setCuisines([])
    setSurprise(false)
    goNext()
  }

  const chooseFormat = (f: Format) => {
    setFormat(f)
    goNext()
  }

  // Step 4 — Vibe is the final choice: build the prompt string and go to results.
  const chooseVibe = (vibe: Vibe) => {
    // Every selected cuisine goes into the prompt; "Surprise me" / Skip add none.
    const parts = [
      locationChoice ?? 'Anywhere in Dubai',
      ...cuisines,
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
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
            <StepHeading eyebrow="STEP 2 · CUISINE" title="Any cuisine?" />

            {/* 2-col grid — 4 rows + "Surprise me" fill the space, no scrolling.
                Rows grow to share the height, clamped so cards stay ~100-110.
                Multi-select: tapping toggles, "Continue →" advances. */}
            <View style={{ flex: 1, gap: 12, paddingBottom: 14 }}>
              {CUISINE_ROWS.map((row, ri) => (
                <View
                  key={ri}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    gap: 12,
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    minHeight: 80,
                    maxHeight: 106,
                  }}
                >
                  {row.map((c) => (
                    <CuisineCard
                      key={c.name}
                      name={c.name}
                      descriptor={c.descriptor}
                      icon={c.icon}
                      selected={cuisines.includes(c.name)}
                      onPress={() => toggleCuisine(c.name)}
                    />
                  ))}
                </View>
              ))}

              {/* "Surprise me" — full-width, sits at the bottom of the grid.
                  Advances immediately and clears any selection. */}
              <CuisineCard
                surprise
                name={SURPRISE.name}
                descriptor={SURPRISE.descriptor}
                icon={SURPRISE.icon}
                selected={surprise}
                onPress={chooseSurprise}
              />

              {/* Primary advance — dimmed until at least one cuisine is picked */}
              <RedButton
                label="Continue →"
                disabled={cuisines.length === 0}
                onPress={goNext}
              />

              <Pressable
                onPress={() => {
                  tap()
                  skipCuisine()
                }}
                hitSlop={10}
              >
                <Text
                  style={{
                    fontFamily: 'DMSans_600SemiBold',
                    fontSize: 13,
                    color: '#444',
                    textAlign: 'center',
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
