import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import RedButton from '../../components/RedButton'
import { searchAreas, type AreaSuggestion } from '../../lib/api'
import AreaRow from '../../components/AreaRow'
import { usePressed } from '../../lib/usePressed'

type LocationChoice = 'Nearby' | 'Anywhere in Dubai' | `Near ${string}`
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

/**
 * A quiet identity colour per cuisine, used ONLY for the icon inside its chip.
 *
 * Muted and desaturated on purpose: eight saturated hues on a #080808 screen
 * reads as a toy, and the red is the brand's — nothing here may compete with
 * it. The two exceptions are design-system tokens already in use elsewhere
 * (#2DCE89 green, #FFB547 gold).
 */
const CUISINE_ACCENT: Record<string, string> = {
  Lebanese: '#D9A05B',
  Japanese: '#D96C6C',
  American: '#B2705B',
  Pakistani: '#C9963F',
  Emirati: '#9AA0C9',
  Healthy: '#2DCE89',
  Pizza: '#FFB547',
  Asian: '#5FB3A6',
}

/** Fallback for a cuisine added to CUISINES without an accent. */
const ACCENT_FALLBACK = '#8A847E'

const SURPRISE: Cuisine = {
  name: 'Surprise me',
  descriptor: 'Let us decide',
  icon: 'shuffle-outline',
}

const NO_PREFERENCE: Cuisine = {
  name: 'No preference',
  descriptor: 'Show me anything',
  icon: 'help-circle-outline',
}

// Chunk the cuisines into rows of two for the 2-column grid.
const CUISINE_ROWS: Cuisine[][] = []
for (let i = 0; i < CUISINES.length; i += 2) {
  CUISINE_ROWS.push(CUISINES.slice(i, i + 2))
}

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

/** Shared look for the area search's "nothing to show" messages. */
const emptyStateStyle = {
  fontFamily: 'DMSans_400Regular',
  fontSize: 13,
  color: '#504B47',
  paddingTop: 18,
  lineHeight: 19,
} as const

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

/**
 * One cuisine in the 2-column grid.
 *
 * ⚠️ NOTHING here is centred. Eight centred boxes of identical grey read as a
 * flat stack — the left-aligned chip/name/descriptor column is what gives the
 * grid a direction to scan in.
 */
function CuisineTile({
  name,
  descriptor,
  icon,
  selected,
  onPress,
}: {
  name: string
  descriptor: string
  icon: keyof typeof Ionicons.glyphMap
  selected: boolean
  onPress: () => void
}) {
  const { pressed, pressHandlers } = usePressed()
  const scale = useSharedValue(1)

  const accent = CUISINE_ACCENT[name] ?? ACCENT_FALLBACK

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const handlePress = () => {
    // A dip and a spring back — confirmation you can feel at a glance, on the
    // card you actually touched rather than somewhere else on screen.
    scale.value = withSequence(
      withTiming(0.97, { duration: 70 }),
      withSpring(1, { damping: 11, stiffness: 280 }),
    )
    tap()
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      {...pressHandlers}
      // NOTE: must be a PLAIN style, not the ({ pressed }) => ... function form
      // — the function form is dropped on Pressable in this setup, which is why
      // cards used to collapse to their text width. See lib/usePressed.
      style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, alignSelf: 'stretch' }}
    >
      {/* Inner View carries all visual styling — Pressable drops backgroundColor
          on some RN versions, so keep the fill/border/radius here. */}
      <Animated.View
        style={[
          {
            flex: 1,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: selected ? '#E63946' : '#242424',
            backgroundColor: selected ? '#1a0d0d' : '#141414',
            paddingHorizontal: 14,
            // ⚠️ Vertical padding is tighter than horizontal, and the spacer
            // below is what absorbs a short row. Four rows of 96 + two utility
            // rows + the button do not fit an iPhone's Decide step, so the card
            // has to stay legible when the grid is squeezed to ~80 rather than
            // clipping its descriptor (which is exactly what it did at first).
            paddingVertical: 9,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            overflow: 'hidden',
            opacity: pressed ? 0.75 : 1,
          },
          popStyle,
        ]}
      >
        {/* Icon chip — the only place a cuisine's own colour appears. */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: selected ? '#E6394622' : '#1F1F1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color={selected ? '#E63946' : accent} />
        </View>

        {/* Breathing room when the row is tall, the first thing to go when it
            is not — so the copy is never the thing that gets cut. */}
        <View style={{ flexGrow: 1, minHeight: 6 }} />

        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'DMSans_700Bold',
            fontSize: 16,
            lineHeight: 19,
            color: selected ? '#E63946' : '#F2EDE8',
          }}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 11,
            lineHeight: 13,
            color: '#8A847E',
            marginTop: 1,
          }}
        >
          {descriptor}
        </Text>

        {/* Corner dot — the selected state read from the far side of the grid. */}
        {selected ? (
          <View
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#E63946',
            }}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  )
}

/**
 * A slim full-width option above or below the grid.
 *
 * Both of these used to be grid-sized cards, which made three different kinds
 * of choice look like one kind. They are utilities: shorter, hairline-bordered,
 * single-line, and visibly not part of the grid.
 */
function UtilityRow({
  icon,
  title,
  height,
  accent,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  height: number
  /** Red-tinted treatment ("Surprise me"); quiet and secondary otherwise. */
  accent?: boolean
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
      // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
      style={{ alignSelf: 'stretch', height }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: accent ? '#E6394666' : '#1C1C1C',
          backgroundColor: accent ? 'rgba(230,57,70,0.06)' : 'transparent',
          opacity: pressed ? 0.75 : 1,
        }}
      >
        <Ionicons name={icon} size={17} color={accent ? '#E63946' : '#8A847E'} />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: accent ? 'DMSans_700Bold' : 'DMSans_500Medium',
            fontSize: 14,
            color: accent ? '#E63946' : '#8A847E',
          }}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  )
}

/**
 * One search hit in the area picker. Its own component so it can hold press
 * state — hooks can't run inside the results `.map`.
 */
function StepHeading({
  eyebrow,
  title,
  compact,
}: {
  eyebrow: string
  title: string
  /** Tighter heading for a step whose content has to fight for height. */
  compact?: boolean
}) {
  return (
    <View style={{ marginBottom: compact ? 14 : 24 }}>
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 2,
          color: '#504B47',
          marginBottom: compact ? 8 : 10,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: compact ? 28 : 32,
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
  // Captured when the user picks "Nearby" or an area; forwarded to the query.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  // "Pick an area" — inline search that replaces the three location cards.
  const [areaMode, setAreaMode] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)

  // Debounced search. The `cancelled` flag drops responses from superseded
  // keystrokes so a slow early request can't overwrite a newer result.
  useEffect(() => {
    const q = query.trim()
    if (!areaMode || q.length < 2) {
      setSuggestions([])
      setSearching(false)
      setSearchFailed(false)
      return
    }

    let cancelled = false
    setSearching(true)
    setSearchFailed(false)

    const id = setTimeout(async () => {
      try {
        const results = await searchAreas(q)
        if (!cancelled) setSuggestions(results)
      } catch {
        if (!cancelled) {
          setSuggestions([])
          setSearchFailed(true)
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [query, areaMode])

  const openAreaSearch = () => {
    tap()
    setAreaMode(true)
  }

  const closeAreaSearch = () => {
    setAreaMode(false)
    setQuery('')
    setSuggestions([])
    setSearchFailed(false)
  }

  // Picking an area behaves exactly like "Nearby" downstream: its coordinates
  // feed the 5 → 10 → city ladder and the distance display.
  const chooseArea = (s: AreaSuggestion) => {
    setCoords({ lat: s.lat, lng: s.lng })
    setLocationChoice(`Near ${s.name}`)
    closeAreaSearch()
    goNext()
  }
  // Cuisine is MULTI-select: tapping toggles, "Continue →" advances.
  const [cuisines, setCuisines] = useState<string[]>([])
  // "Surprise me" is mutually exclusive with any picked cuisine.

  const [format, setFormat] = useState<Format | null>(null)

  const goNext = () => {
    setBack(false)
    setStep((s) => Math.min(3, s + 1))
  }

  const goBack = () => {
    // The area search is a sub-view of step 1 — back closes it first.
    if (areaMode) {
      closeAreaSearch()
      return
    }
    if (step === 0) {
      // First step — leave the flow back to Home.
      router.navigate('/(tabs)')
      return
    }
    setBack(true)
    setStep((s) => Math.max(0, s - 1))
  }

  // Step 1 — Location. "Nearby" asks for GPS and captures the coordinates that
  // get sent with the decision query; any failure degrades silently to a
  // city-wide search rather than blocking the flow.
  const chooseLocation = async (choice: LocationChoice) => {
    if (choice === 'Nearby') {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          setCoords(null)
          setLocationChoice('Anywhere in Dubai')
          goNext()
          return
        }

        // Last known is instant; only pay for a fresh fix if there isn't one.
        let pos = await Location.getLastKnownPositionAsync()
        if (!pos) {
          pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          })
        }

        if (pos) {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setLocationChoice('Nearby')
        } else {
          setCoords(null)
          setLocationChoice('Anywhere in Dubai')
        }
      } catch {
        setCoords(null)
        setLocationChoice('Anywhere in Dubai')
      }
    } else {
      setCoords(null)
      setLocationChoice('Anywhere in Dubai')
    }
    goNext()
  }

  // Step 2 — tapping a cuisine toggles it; the flow waits for "Continue".
  const toggleCuisine = (name: string) => {
    setCuisines((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    )
  }

  // "Surprise me" and "No preference" both advance immediately and clear any
  // picks — neither contributes a cuisine to the prompt.
  // Neither has a selected state to render: both advance on the tap, so the
  // flag the old card needed for its highlight had no reader left.
  const chooseSurprise = () => {
    setCuisines([])
    goNext()
  }

  const chooseNoPreference = () => {
    setCuisines([])
    goNext()
  }

  const chooseFormat = (f: Format) => {
    setFormat(f)
    goNext()
  }

  // Step 4 — Vibe is the final choice: build the brief and go to results.
  const chooseVibe = (vibe: Vibe) => {
    // Every selected cuisine goes into the prompt; "Surprise me" / Skip add none.
    const parts = [
      locationChoice ?? 'Anywhere in Dubai',
      ...cuisines,
      format ?? 'Dine In',
      vibe,
    ]
    const prompt = parts.join(', ')

    // "Near JBR" -> "JBR". Display only: the coords are what actually filter.
    const areaName = locationChoice?.startsWith('Near ')
      ? locationChoice.slice('Near '.length)
      : undefined

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push({
      pathname: '/results',
      params: {
        // The prompt survives for DISPLAY and history only — DecisionEngine v2
        // ranks off the structured fields below, not off this string.
        prompt,
        chips: '[]',
        // Only sent for "Nearby" — "Anywhere in Dubai" stays city-wide.
        ...(coords ? { lat: String(coords.lat), lng: String(coords.lng) } : {}),
        // --- structured filters for the engine ---
        // Router params are strings, so the array is JSON-encoded here and
        // parsed back in results.tsx.
        cuisines: JSON.stringify(cuisines),
        format: format ?? 'Dine In',
        vibe,
        ...(areaName ? { areaName } : {}),
      },
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
            <StepHeading
              eyebrow="STEP 1 · LOCATION"
              title={areaMode ? 'Which area?' : 'Where to?'}
            />

            {areaMode ? (
              // Slides in the same direction as a forward step, so the inline
              // search reads as part of the wizard rather than a modal.
              <Animated.View entering={SlideInRight.duration(220)} style={{ flex: 1 }}>
                <Pressable
                  onPress={() => {
                    tap()
                    closeAreaSearch()
                  }}
                  hitSlop={10}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 14,
                  }}
                >
                  <Ionicons name="chevron-back" size={16} color="#8A847E" />
                  <Text
                    style={{
                      fontFamily: 'DMSans_600SemiBold',
                      fontSize: 13,
                      color: '#8A847E',
                    }}
                  >
                    Location options
                  </Text>
                </Pressable>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: '#141414',
                    borderWidth: 1,
                    borderColor: '#242424',
                    borderRadius: 16,
                    paddingHorizontal: 16,
                  }}
                >
                  <Ionicons name="search-outline" size={18} color="#504B47" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                    autoCorrect={false}
                    returnKeyType="search"
                    placeholder="JBR, Deira, Business Bay…"
                    placeholderTextColor="#504B47"
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      fontFamily: 'DMSans_500Medium',
                      fontSize: 16,
                      color: '#F2EDE8',
                    }}
                  />
                  {searching ? <ActivityIndicator size="small" color="#504B47" /> : null}
                </View>

                <View style={{ flex: 1, marginTop: 8 }}>
                  {suggestions.length > 0 ? (
                    <Animated.View entering={FadeIn.duration(180)}>
                      {suggestions.map((s) => (
                        <AreaRow
                          key={`${s.name}-${s.lat}-${s.lng}`}
                          suggestion={s}
                          onPress={() => chooseArea(s)}
                        />
                      ))}
                    </Animated.View>
                  ) : searchFailed ? (
                    <Text style={emptyStateStyle}>
                      Couldn&apos;t search just now — check your connection and try again.
                    </Text>
                  ) : query.trim().length >= 2 && !searching ? (
                    <Text style={emptyStateStyle}>No places found in Dubai.</Text>
                  ) : null}
                </View>
              </Animated.View>
            ) : (
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
                <BigCard
                  icon="search-outline"
                  title="Pick an area"
                  subtitle="Search any spot in Dubai"
                  selected={locationChoice?.startsWith('Near ') ?? false}
                  onPress={openAreaSearch}
                />
              </View>
            )}
          </View>
        )}

        {step === 1 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 14 }}>
            {/* `compact` only here: this is the one step with eight cards plus
                two utility rows plus a button to fit above the tab bar. */}
            <StepHeading compact eyebrow="STEP 2 · CUISINE" title="Any cuisine?" />

            {/* Utility row + 2-col grid + utility row + Continue, all without
                scrolling. The GRID takes the leftover height (rows flex between
                80 and 96); the utility rows and the button are fixed, so the
                grid is what absorbs a shorter screen.
                Multi-select: tapping a grid card toggles, "Continue" advances. */}
            <View style={{ flex: 1, gap: 12, paddingBottom: 8 }}>
              {/* Escape hatch for "I don't know" — advances with no cuisine.
                  Deliberately the quietest thing on the step. */}
              <UtilityRow
                icon={NO_PREFERENCE.icon}
                title={`${NO_PREFERENCE.name} · ${NO_PREFERENCE.descriptor}`}
                height={52}
                onPress={chooseNoPreference}
              />

              <View style={{ flex: 1, gap: 12 }}>
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
                      maxHeight: 96,
                    }}
                  >
                    {row.map((c) => (
                      <CuisineTile
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
              </View>

              {/* "Surprise me" — advances immediately and clears any selection. */}
              <UtilityRow
                accent
                icon={SURPRISE.icon}
                title="Surprise me — let us decide"
                height={56}
                onPress={chooseSurprise}
              />

              {/* Primary advance — dimmed until at least one cuisine is picked.
                  The count is the only confirmation that multi-select took. */}
              <RedButton
                label={
                  cuisines.length > 0 ? `Continue with ${cuisines.length} →` : 'Continue →'
                }
                disabled={cuisines.length === 0}
                onPress={goNext}
                style={{ paddingVertical: 14 }}
              />
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
